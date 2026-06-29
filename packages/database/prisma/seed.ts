import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../src/client.js';

const jurisdictionData: Prisma.JurisdictionCreateInput[] = [
  {
    ssoCode: 'TJ-LILLE',
    slug: 'tj-lille',
    displayName: 'Tribunal judiciaire de Lille',
    isActive: true,
  },
  {
    ssoCode: 'TJ-ARRAS',
    slug: 'tj-arras',
    displayName: 'Tribunal judiciaire d’Arras',
    isActive: true,
  },
  {
    ssoCode: 'TJ-DOUAI',
    slug: 'tj-douai',
    displayName: 'Tribunal judiciaire de Douai',
    isActive: true,
  },
  {
    ssoCode: 'TJ-CAMBRAI',
    slug: 'tj-cambrai',
    displayName: 'Tribunal judiciaire de Cambrai',
    isActive: true,
  },
];

const serviceData: Prisma.ServiceCreateWithoutJurisdictionInput[] = [
  { ssoCode: 'AUD', slug: 'aud', displayName: 'AUD', isActive: true },
  { ssoCode: 'BAJ', slug: 'baj', displayName: 'BAJ', isActive: true },
  { ssoCode: 'BOG', slug: 'bog', displayName: 'BOG', isActive: true },
  { ssoCode: 'JAF', slug: 'jaf', displayName: 'JAF', isActive: true },
  { ssoCode: 'JAP', slug: 'jap', displayName: 'JAP', isActive: true },
];

export async function main(): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    for (const jurisdictionInput of jurisdictionData) {
      const jurisdiction = await transaction.jurisdiction.upsert({
        where: { ssoCode: jurisdictionInput.ssoCode },
        update: {
          slug: jurisdictionInput.slug,
          displayName: jurisdictionInput.displayName,
          isActive: true,
        },
        create: jurisdictionInput,
      });

      for (const serviceInput of serviceData) {
        await transaction.service.upsert({
          where: {
            jurisdictionId_ssoCode: {
              jurisdictionId: jurisdiction.id,
              ssoCode: serviceInput.ssoCode,
            },
          },
          update: {
            slug: serviceInput.slug,
            displayName: serviceInput.displayName,
            isActive: true,
          },
          create: {
            ...serviceInput,
            jurisdictionId: jurisdiction.id,
          },
        });
      }
    }
  });
}

try {
  await main();
  process.stdout.write(
    `Seed completed: ${jurisdictionData.length} jurisdictions and ${jurisdictionData.length * serviceData.length} services.\n`,
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Database seed failed: ${message}\n`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
