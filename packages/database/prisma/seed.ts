import { type Prisma, StructureLevel, UserRole } from '../generated/prisma/client.js';
import { createDatabaseClient } from '../src/client.js';

interface StructureSeed {
  ssoCode: string;
  displayName: string;
  level: StructureLevel;
  parentSsoCode?: string;
}

interface UserSeed {
  igcidHash: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  workStructureSsoCode?: string;
  adminStructureSsoCode?: string;
  serviceSlug?: string;
}

const structureData: StructureSeed[] = [
  {
    ssoCode: '00000001',
    displayName: 'Cour d’appel de Douai',
    level: StructureLevel.REGIONAL,
  },
  {
    ssoCode: '00000002',
    displayName: 'Tribunal judiciaire de Lille',
    level: StructureLevel.JURISDICTION,
    parentSsoCode: '00000001',
  },
  {
    ssoCode: '00000003',
    displayName: 'Tribunal judiciaire d’Arras',
    level: StructureLevel.JURISDICTION,
    parentSsoCode: '00000001',
  },
  {
    ssoCode: '00000004',
    displayName: 'Tribunal judiciaire de Douai',
    level: StructureLevel.JURISDICTION,
    parentSsoCode: '00000001',
  },
  {
    ssoCode: '00000005',
    displayName: 'Tribunal de proximité de Tourcoing',
    level: StructureLevel.SUB_JURISDICTION,
    parentSsoCode: '00000002',
  },
];

const serviceStructureCodes = new Set(['00000001', '00000002', '00000003', '00000004']);

const serviceData: Prisma.ServiceCreateWithoutStructureInput[] = [
  {
    slug: 'baj',
    displayName: 'Bureau d’aide juridictionnelle',
    isActive: true,
  },
  { slug: 'bog', displayName: 'Bureau d’ordre général', isActive: true },
  { slug: 'jaf', displayName: 'Juge aux affaires familiales', isActive: true },
  {
    slug: 'jap',
    displayName: 'Juge de l’application des peines',
    isActive: true,
  },
];

const userData: UserSeed[] = [
  {
    igcidHash: 'a'.repeat(64),
    firstName: 'Alice',
    lastName: 'Administration',
    email: 'alice.admin-general@example.invalid',
    role: UserRole.ADMINISTRATEUR_GENERAL,
  },
  {
    igcidHash: 'b'.repeat(64),
    firstName: 'Rémi',
    lastName: 'Régional',
    email: 'remi.admin-regional@example.invalid',
    role: UserRole.ADMINISTRATEUR_REGIONAL,
    workStructureSsoCode: '00000002',
    adminStructureSsoCode: '00000001',
  },
  {
    igcidHash: 'c'.repeat(64),
    firstName: 'Louise',
    lastName: 'Locale',
    email: 'louise.admin-local@example.invalid',
    role: UserRole.ADMINISTRATEUR_LOCAL,
    workStructureSsoCode: '00000002',
    adminStructureSsoCode: '00000002',
  },
  {
    igcidHash: 'd'.repeat(64),
    firstName: 'Amandine',
    lastName: 'Agent',
    email: 'amandine.agent@example.invalid',
    role: UserRole.AGENT,
    workStructureSsoCode: '00000002',
    serviceSlug: 'baj',
  },
  {
    igcidHash: 'e'.repeat(64),
    firstName: 'Thomas',
    lastName: 'Proximité',
    email: 'thomas.admin-tprox@example.invalid',
    role: UserRole.ADMINISTRATEUR_LOCAL,
    workStructureSsoCode: '00000005',
    adminStructureSsoCode: '00000005',
  },
  {
    igcidHash: 'f'.repeat(64),
    firstName: 'Claire',
    lastName: 'Cour',
    email: 'claire.admin-ca@example.invalid',
    role: UserRole.ADMINISTRATEUR_LOCAL,
    workStructureSsoCode: '00000001',
    adminStructureSsoCode: '00000001',
  },
  {
    igcidHash: 'g'.repeat(64),
    firstName: 'Camille',
    lastName: 'Appel',
    email: 'camille.agent-ca@example.invalid',
    role: UserRole.AGENT,
    workStructureSsoCode: '00000001',
    serviceSlug: 'baj',
  },
];

export async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl?.trim()) {
    throw new Error('DATABASE_URL is required to initialize Prisma');
  }

  const prisma = createDatabaseClient(databaseUrl);

  try {
    await prisma.$transaction(async (transaction) => {
      for (const structureInput of structureData) {
        const parent = structureInput.parentSsoCode
          ? await transaction.structure.findUniqueOrThrow({
              where: { ssoCode: structureInput.parentSsoCode },
              select: { id: true },
            })
          : null;

        const structure = await transaction.structure.upsert({
          where: { ssoCode: structureInput.ssoCode },
          update: {
            displayName: structureInput.displayName,
            level: structureInput.level,
            parentId: parent?.id ?? null,
            isActive: true,
          },
          create: {
            ssoCode: structureInput.ssoCode,
            displayName: structureInput.displayName,
            level: structureInput.level,
            parentId: parent?.id ?? null,
            isActive: true,
          },
        });

        if (!serviceStructureCodes.has(structure.ssoCode)) {
          continue;
        }

        for (const serviceInput of serviceData) {
          await transaction.service.upsert({
            where: {
              structureId_slug: {
                structureId: structure.id,
                slug: serviceInput.slug,
              },
            },
            update: {
              slug: serviceInput.slug,
              displayName: serviceInput.displayName,
              isActive: true,
            },
            create: {
              ...serviceInput,
              structureId: structure.id,
            },
          });
        }
      }

      for (const userInput of userData) {
        const workStructure = userInput.workStructureSsoCode
          ? await transaction.structure.findUniqueOrThrow({
              where: { ssoCode: userInput.workStructureSsoCode },
              select: { id: true },
            })
          : null;

        const adminStructure = userInput.adminStructureSsoCode
          ? await transaction.structure.findUniqueOrThrow({
              where: { ssoCode: userInput.adminStructureSsoCode },
              select: { id: true },
            })
          : null;

        const service =
          workStructure && userInput.serviceSlug
            ? await transaction.service.findUniqueOrThrow({
                where: {
                  structureId_slug: {
                    structureId: workStructure.id,
                    slug: userInput.serviceSlug,
                  },
                },
                select: { id: true },
              })
            : null;

        await transaction.user.upsert({
          where: { igcidHash: userInput.igcidHash },
          update: {
            firstName: userInput.firstName,
            lastName: userInput.lastName,
            email: userInput.email,
            role: userInput.role,
            isActive: true,
            workStructureId: workStructure?.id ?? null,
            adminStructureId: adminStructure?.id ?? null,
            serviceId: service?.id ?? null,
          },
          create: {
            igcidHash: userInput.igcidHash,
            firstName: userInput.firstName,
            lastName: userInput.lastName,
            email: userInput.email,
            role: userInput.role,
            isActive: true,
            workStructureId: workStructure?.id ?? null,
            adminStructureId: adminStructure?.id ?? null,
            serviceId: service?.id ?? null,
          },
        });
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

void main()
  .then(() => {
    process.stdout.write(
      `Seed completed: ${structureData.length} structures, ${serviceStructureCodes.size * serviceData.length} services and ${userData.length} users.\n`,
    );
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Database seed failed: ${message}\n`);
    process.exitCode = 1;
  });
