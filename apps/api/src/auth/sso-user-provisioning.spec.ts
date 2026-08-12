import type { DatabaseClient } from '@depot-numerique/database';
import { describe, expect, it, jest } from '@jest/globals';
import {
  parseSsoUserProfile,
  SsoUserProvisioningError,
  synchronizeSsoUser,
} from './sso-user-provisioning';

const validUserInfo = {
  bureauIGC: 'ou=100094,ou=100009,ou=935161,ou=905907,ou=sites,dc=justice,dc=fr',
  email: 'Agent.Exemple@Justice.fr',
  firstName: ['Alice'],
  igcId: ['IGC-123'],
  lastName: ['Exemple'],
  roles: ['AUTRE_APPLICATION:AGENT', 'DEPOT_NUMERIQUE:AGENT'],
  siteDescription: 'Tribunal judiciaire de Bordeaux',
};

describe('parseSsoUserProfile', () => {
  it('should normalize claims and ignore roles from other applications', () => {
    expect(parseSsoUserProfile(validUserInfo)).toEqual({
      bureauIgc: {
        hierarchyCodes: ['905907', '935161', '100009', '100094'],
        regionalCode: '100009',
        workCode: '100094',
        workIsRegional: false,
      },
      email: 'agent.exemple@justice.fr',
      firstName: 'Alice',
      igcId: 'IGC-123',
      lastName: 'Exemple',
      role: 'AGENT',
      siteDescription: 'Tribunal judiciaire de Bordeaux',
    });
  });

  it.each([
    ['DEPOT_NUMERIQUE:ADMINISTRATEUR_NATIONAL', 'ADMINISTRATEUR_NATIONAL'],
    ['DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL', 'ADMINISTRATEUR_REGIONAL'],
    ['DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL', 'ADMINISTRATEUR_LOCAL'],
    ['DEPOT_NUMERIQUE:AGENT', 'AGENT'],
  ])('should map the SSO role %s to the internal role %s', (claim, expectedRole) => {
    expect(parseSsoUserProfile({ ...validUserInfo, roles: claim }).role).toBe(expectedRole);
  });

  it.each([
    { name: 'no application role', roles: ['AUTRE_APPLICATION:AGENT'] },
    {
      name: 'multiple application roles',
      roles: ['DEPOT_NUMERIQUE:AGENT', 'DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL'],
    },
    { name: 'an unknown application role', roles: ['DEPOT_NUMERIQUE:SUPER_ADMIN'] },
  ])('should reject $name', ({ roles }) => {
    expect(() => parseSsoUserProfile({ ...validUserInfo, roles })).toThrow(
      SsoUserProvisioningError,
    );
  });

  it.each([
    'email',
    'firstName',
    'igcId',
    'lastName',
  ] as const)('should reject a missing or multivalued required claim: %s', (claim) => {
    expect(() => parseSsoUserProfile({ ...validUserInfo, [claim]: [] })).toThrow(
      SsoUserProvisioningError,
    );
    expect(() =>
      parseSsoUserProfile({ ...validUserInfo, [claim]: ['premiere', 'seconde'] }),
    ).toThrow(SsoUserProvisioningError);
  });

  it('should reject claims that are not non-empty strings', () => {
    expect(() => parseSsoUserProfile({ ...validUserInfo, email: 42 })).toThrow(
      SsoUserProvisioningError,
    );
    expect(() => parseSsoUserProfile({ ...validUserInfo, firstName: '   ' })).toThrow(
      SsoUserProvisioningError,
    );
  });

  it('should reject claims that exceed their maximum length', () => {
    expect(() => parseSsoUserProfile({ ...validUserInfo, firstName: 'a'.repeat(101) })).toThrow(
      SsoUserProvisioningError,
    );
  });

  it('should not require an organization assignment for a national administrator', () => {
    const profile = parseSsoUserProfile({
      ...validUserInfo,
      bureauIGC: undefined,
      roles: 'DEPOT_NUMERIQUE:ADMINISTRATEUR_NATIONAL',
      siteDescription: undefined,
    });

    expect(profile).toEqual({
      email: 'agent.exemple@justice.fr',
      firstName: 'Alice',
      igcId: 'IGC-123',
      lastName: 'Exemple',
      role: 'ADMINISTRATEUR_NATIONAL',
    });
    expect(profile).not.toHaveProperty('bureauIgc');
    expect(profile).not.toHaveProperty('siteDescription');
  });

  it.each([
    'bureauIGC',
    'siteDescription',
  ] as const)('should reject a missing assignment claim for a non-national role: %s', (claim) => {
    expect(() => parseSsoUserProfile({ ...validUserInfo, [claim]: [] })).toThrow(
      SsoUserProvisioningError,
    );
  });

  it('should convert a bureauIGC error into a provisioning error', () => {
    expect(() => parseSsoUserProfile({ ...validUserInfo, bureauIGC: 'DN invalide' })).toThrow(
      SsoUserProvisioningError,
    );
  });
});

interface ExistingUser {
  authIdentityId: string | null;
  id: string;
  igcId: string;
  isActive: boolean;
  serviceId: string | null;
  workStructureId: string | null;
}

interface DatabaseMockOptions {
  userByAuthIdentity?: ExistingUser | null;
  userByIgcId?: ExistingUser | null;
}

function createExistingUser(overrides: Partial<ExistingUser> = {}): ExistingUser {
  return {
    authIdentityId: 'identity-1',
    id: 'user-1',
    igcId: 'IGC-123',
    isActive: true,
    serviceId: 'service-1',
    workStructureId: 'structure-100094',
    ...overrides,
  };
}

function createDatabaseMock(options: DatabaseMockOptions = {}) {
  const structureUpsert = jest.fn(async ({ create, where }: Record<string, unknown>) => {
    const code = (where as { ssoCode: string }).ssoCode;
    return { ...(create as object), id: `structure-${code}` };
  });
  const userFindUnique = jest.fn(
    async ({ where }: { where: { authIdentityId?: string; igcId?: string } }) => {
      if ('igcId' in where) {
        return options.userByIgcId ?? null;
      }

      return options.userByAuthIdentity ?? null;
    },
  );
  const userCreate = jest.fn(async (_args: unknown) => undefined);
  const userUpdate = jest.fn(async (_args: unknown) => undefined);
  const authIdentityUpdate = jest.fn(async (_args: unknown) => undefined);
  const transaction = {
    authIdentity: { update: authIdentityUpdate },
    structure: { upsert: structureUpsert },
    user: {
      create: userCreate,
      findUnique: userFindUnique,
      update: userUpdate,
    },
  };
  const runTransaction = jest.fn(async (callback: (client: typeof transaction) => Promise<void>) =>
    callback(transaction),
  );
  const database = {
    $transaction: runTransaction,
  } as unknown as DatabaseClient;

  return {
    authIdentityUpdate,
    database,
    runTransaction,
    structureUpsert,
    userCreate,
    userFindUnique,
    userUpdate,
  };
}

describe('synchronizeSsoUser', () => {
  it.each([
    {
      adminStructureId: null,
      role: 'DEPOT_NUMERIQUE:AGENT',
      workStructureId: 'structure-100094',
    },
    {
      adminStructureId: 'structure-100094',
      role: 'DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL',
      workStructureId: 'structure-100094',
    },
    {
      adminStructureId: 'structure-100009',
      role: 'DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL',
      workStructureId: 'structure-100094',
    },
  ])('should assign the expected structures for $role', async (testCase) => {
    const mock = createDatabaseMock();

    await synchronizeSsoUser(mock.database, 'identity-1', {
      ...validUserInfo,
      roles: testCase.role,
    });

    expect(mock.structureUpsert).toHaveBeenCalledTimes(2);
    expect(mock.userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminStructureId: testCase.adminStructureId,
        workStructureId: testCase.workStructureId,
      }),
    });
  });

  it('should create a complete user and synchronize the Better Auth identity', async () => {
    const mock = createDatabaseMock();

    await synchronizeSsoUser(mock.database, 'identity-1', validUserInfo);

    expect(mock.authIdentityUpdate).toHaveBeenCalledWith({
      data: {
        email: 'agent.exemple@justice.fr',
        name: 'Alice Exemple',
      },
      where: { id: 'identity-1' },
    });
    expect(mock.userCreate).toHaveBeenCalledWith({
      data: {
        adminStructureId: null,
        authIdentityId: 'identity-1',
        email: 'agent.exemple@justice.fr',
        firstName: 'Alice',
        igcId: 'IGC-123',
        lastLoginAt: expect.any(Date),
        lastName: 'Exemple',
        role: 'AGENT',
        workStructureId: 'structure-100094',
      },
    });
  });

  it('should not provision structures for a national administrator', async () => {
    const mock = createDatabaseMock();

    await synchronizeSsoUser(mock.database, 'identity-1', {
      ...validUserInfo,
      bureauIGC: undefined,
      roles: 'DEPOT_NUMERIQUE:ADMINISTRATEUR_NATIONAL',
      siteDescription: undefined,
    });

    expect(mock.structureUpsert).not.toHaveBeenCalled();
    expect(mock.userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminStructureId: null,
        role: 'ADMINISTRATEUR_NATIONAL',
        workStructureId: null,
      }),
    });
  });

  it('should create only one structure when the work assignment is the regional court', async () => {
    const mock = createDatabaseMock();

    await synchronizeSsoUser(mock.database, 'identity-1', {
      ...validUserInfo,
      bureauIGC: 'ou=100009,ou=935161,ou=905907,ou=sites,dc=justice,dc=fr',
      roles: 'DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL',
      siteDescription: 'Cour d’appel de Bordeaux',
    });

    expect(mock.structureUpsert).toHaveBeenCalledTimes(1);
    expect(mock.userCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        adminStructureId: 'structure-100009',
        workStructureId: 'structure-100009',
      }),
    });
  });

  it('should create the regional court with a placeholder without overwriting an existing name', async () => {
    const mock = createDatabaseMock();

    await synchronizeSsoUser(mock.database, 'identity-1', validUserInfo);

    expect(mock.structureUpsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        create: expect.objectContaining({
          displayName: 'Libellé indisponible — SRJ 100009',
        }),
        update: {
          level: 'REGIONAL',
          parentId: null,
        },
      }),
    );
  });

  it('should clear the service when the user work assignment changes', async () => {
    const existingUser = createExistingUser({ workStructureId: 'ancienne-structure' });
    const mock = createDatabaseMock({
      userByAuthIdentity: existingUser,
      userByIgcId: existingUser,
    });

    await synchronizeSsoUser(mock.database, 'identity-1', validUserInfo);

    expect(mock.userUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceId: null,
        workStructureId: 'structure-100094',
      }),
      where: { id: 'user-1' },
    });
    expect(mock.userCreate).not.toHaveBeenCalled();
  });

  it('should preserve the service when the user work assignment does not change', async () => {
    const existingUser = createExistingUser();
    const mock = createDatabaseMock({
      userByAuthIdentity: existingUser,
      userByIgcId: existingUser,
    });

    await synchronizeSsoUser(mock.database, 'identity-1', validUserInfo);

    expect(mock.userUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        serviceId: 'service-1',
        workStructureId: 'structure-100094',
      }),
      where: { id: 'user-1' },
    });
  });

  it('should reject an SSO identity already linked to another IGC identifier', async () => {
    const mock = createDatabaseMock({
      userByAuthIdentity: createExistingUser({ igcId: 'AUTRE-IGC' }),
    });

    await expect(synchronizeSsoUser(mock.database, 'identity-1', validUserInfo)).rejects.toThrow(
      /identité SSO est déjà liée à un autre identifiant IGC/,
    );
    expect(mock.authIdentityUpdate).not.toHaveBeenCalled();
    expect(mock.userCreate).not.toHaveBeenCalled();
  });

  it('should reject an IGC identifier already linked to another SSO identity', async () => {
    const mock = createDatabaseMock({
      userByIgcId: createExistingUser({ authIdentityId: 'autre-identite' }),
    });

    await expect(synchronizeSsoUser(mock.database, 'identity-1', validUserInfo)).rejects.toThrow(
      /identifiant IGC est déjà lié à une autre identité SSO/,
    );
    expect(mock.authIdentityUpdate).not.toHaveBeenCalled();
    expect(mock.userCreate).not.toHaveBeenCalled();
  });

  it('should reject the implicit reactivation of a disabled account', async () => {
    const inactiveUser = createExistingUser({ isActive: false });
    const mock = createDatabaseMock({
      userByAuthIdentity: inactiveUser,
      userByIgcId: inactiveUser,
    });

    await expect(synchronizeSsoUser(mock.database, 'identity-1', validUserInfo)).rejects.toThrow(
      /compte applicatif est désactivé/,
    );
    expect(mock.authIdentityUpdate).not.toHaveBeenCalled();
    expect(mock.userCreate).not.toHaveBeenCalled();
    expect(mock.userUpdate).not.toHaveBeenCalled();
  });
});
