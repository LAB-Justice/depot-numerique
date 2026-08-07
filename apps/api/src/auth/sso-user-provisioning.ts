import type { DatabaseClient } from '@depot-numerique/database';
import {
  BureauIgcError,
  type BureauIgcPath,
  parseBureauIgc,
  pendingStructureDisplayName,
} from './bureau-igc';

const APPLICATION_ROLE_PREFIX = 'DEPOT_NUMERIQUE:';

const USER_ROLES = {
  'DEPOT_NUMERIQUE:ADMINISTRATEUR_NATIONAL': 'ADMINISTRATEUR_NATIONAL',
  'DEPOT_NUMERIQUE:ADMINISTRATEUR_REGIONAL': 'ADMINISTRATEUR_REGIONAL',
  'DEPOT_NUMERIQUE:ADMINISTRATEUR_LOCAL': 'ADMINISTRATEUR_LOCAL',
  'DEPOT_NUMERIQUE:AGENT': 'AGENT',
} as const;

type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export interface SsoUserProfile {
  igcId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  bureauIgc?: BureauIgcPath;
  siteDescription?: string;
}

export class SsoUserProvisioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SsoUserProvisioningError';
  }
}

function claimValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];

  return values
    .filter((claim): claim is string => typeof claim === 'string')
    .map((claim) => claim.trim())
    .filter(Boolean);
}

function requiredSingleClaim(value: unknown, claimName: string, maximumLength: number): string {
  const values = claimValues(value);

  if (values.length !== 1) {
    throw new SsoUserProvisioningError(`Le claim SSO ${claimName} doit contenir une seule valeur.`);
  }

  const [claim] = values;
  if (!claim || claim.length > maximumLength) {
    throw new SsoUserProvisioningError(`Le claim SSO ${claimName} est invalide.`);
  }

  return claim;
}

export function parseSsoUserProfile(userInfo: Record<string, unknown>): SsoUserProfile {
  const applicationRoles = claimValues(userInfo.roles).filter((role) =>
    role.startsWith(APPLICATION_ROLE_PREFIX),
  );

  if (applicationRoles.length !== 1) {
    throw new SsoUserProvisioningError(
      `Le SSO doit fournir exactement un rôle pour Dépôt Numérique.`,
    );
  }

  const [applicationRole] = applicationRoles;
  const role = applicationRole ? USER_ROLES[applicationRole as keyof typeof USER_ROLES] : undefined;

  if (!role) {
    throw new SsoUserProvisioningError(`Le rôle SSO fourni pour Dépôt Numérique est inconnu.`);
  }

  const profile: SsoUserProfile = {
    igcId: requiredSingleClaim(userInfo.igcId, 'igcid', 255),
    email: requiredSingleClaim(userInfo.email, 'mail', 255).toLowerCase(),
    firstName: requiredSingleClaim(userInfo.firstName, 'prenom', 100),
    lastName: requiredSingleClaim(userInfo.lastName, 'nom', 100),
    role,
  };

  if (role === 'ADMINISTRATEUR_NATIONAL') {
    return profile;
  }

  try {
    profile.bureauIgc = parseBureauIgc(requiredSingleClaim(userInfo.bureauIGC, 'bureauIGC', 512));
  } catch (error) {
    if (error instanceof SsoUserProvisioningError) {
      throw error;
    }

    if (error instanceof BureauIgcError) {
      throw new SsoUserProvisioningError(error.message);
    }

    throw error;
  }

  profile.siteDescription = requiredSingleClaim(userInfo.siteDescription, 'siteDescription', 255);

  return profile;
}

export async function synchronizeSsoUser(
  database: DatabaseClient,
  authIdentityId: string,
  userInfo: Record<string, unknown>,
): Promise<void> {
  const profile = parseSsoUserProfile(userInfo);
  const lastLoginAt = new Date();

  await database.$transaction(async (transaction) => {
    const [userByIgcId, userByAuthIdentity] = await Promise.all([
      transaction.user.findUnique({ where: { igcId: profile.igcId } }),
      transaction.user.findUnique({ where: { authIdentityId } }),
    ]);

    if (userByAuthIdentity && userByAuthIdentity.igcId !== profile.igcId) {
      throw new SsoUserProvisioningError(
        `Cette identité SSO est déjà liée à un autre identifiant IGC.`,
      );
    }

    if (userByIgcId?.authIdentityId && userByIgcId.authIdentityId !== authIdentityId) {
      throw new SsoUserProvisioningError(
        `Cet identifiant IGC est déjà lié à une autre identité SSO.`,
      );
    }

    const existingUser = userByIgcId ?? userByAuthIdentity;
    if (existingUser && !existingUser.isActive) {
      throw new SsoUserProvisioningError(`Ce compte applicatif est désactivé.`);
    }

    await transaction.authIdentity.update({
      data: {
        email: profile.email,
        name: `${profile.firstName} ${profile.lastName}`,
      },
      where: { id: authIdentityId },
    });

    let workStructureId: string | null = null;
    let adminStructureId: string | null = null;

    if (profile.role !== 'ADMINISTRATEUR_NATIONAL') {
      const bureauIgc = profile.bureauIgc;
      const siteDescription = profile.siteDescription;

      if (!bureauIgc || !siteDescription) {
        throw new SsoUserProvisioningError(`Les informations de rattachement SSO sont absentes.`);
      }

      const regionalStructure = await transaction.structure.upsert({
        create: {
          displayName: bureauIgc.workIsRegional
            ? siteDescription
            : pendingStructureDisplayName(bureauIgc.regionalCode),
          level: 'REGIONAL',
          ssoCode: bureauIgc.regionalCode,
        },
        update: bureauIgc.workIsRegional
          ? {
              displayName: siteDescription,
              level: 'REGIONAL',
              parentId: null,
            }
          : {
              level: 'REGIONAL',
              parentId: null,
            },
        where: { ssoCode: bureauIgc.regionalCode },
      });

      const workStructure = bureauIgc.workIsRegional
        ? regionalStructure
        : await transaction.structure.upsert({
            create: {
              displayName: siteDescription,
              level: 'JURISDICTION',
              parentId: regionalStructure.id,
              ssoCode: bureauIgc.workCode,
            },
            update: {
              displayName: siteDescription,
              level: 'JURISDICTION',
              parentId: regionalStructure.id,
            },
            where: { ssoCode: bureauIgc.workCode },
          });

      workStructureId = workStructure.id;

      if (profile.role === 'ADMINISTRATEUR_LOCAL') {
        adminStructureId = workStructure.id;
      } else if (profile.role === 'ADMINISTRATEUR_REGIONAL') {
        adminStructureId = regionalStructure.id;
      }
    }

    const userData = {
      authIdentityId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      role: profile.role,
      adminStructureId,
      workStructureId,
      lastLoginAt,
    };

    if (existingUser) {
      await transaction.user.update({
        data: {
          ...userData,
          serviceId:
            existingUser.workStructureId === workStructureId ? existingUser.serviceId : null,
        },
        where: { id: existingUser.id },
      });
      return;
    }

    await transaction.user.create({
      data: {
        ...userData,
        igcId: profile.igcId,
      },
    });
  });
}
