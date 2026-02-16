import { PrismaClient, type QualityStatus } from '@prisma/client';

const prisma = new PrismaClient();

const samplePlaces = [
  {
    externalId: 'pirita-beach',
    nameEt: 'Pirita rand',
    nameEn: 'Pirita Beach',
    type: 'BEACH' as const,
    municipality: 'Tallinn',
    addressEt: 'Merivälja tee 1, Tallinn',
    addressEn: 'Merivälja tee 1, Tallinn',
    latitude: 59.4697,
    longitude: 24.8405,
    status: 'GOOD' as QualityStatus,
    reasonEt: 'Suplusvesi vastab nõuetele.',
    reasonEn: 'Water quality meets requirements.',
  },
  {
    externalId: 'haabneeme-beach',
    nameEt: 'Haabneeme rand',
    nameEn: 'Haabneeme Beach',
    type: 'BEACH' as const,
    municipality: 'Viimsi',
    addressEt: 'Randvere tee 2, Viimsi',
    addressEn: 'Randvere tee 2, Viimsi',
    latitude: 59.5118,
    longitude: 24.8261,
    status: 'BAD' as QualityStatus,
    reasonEt: 'Bakterioloogiline näit ületab normi.',
    reasonEn: 'Bacteriological result exceeds threshold.',
  },
  {
    externalId: 'kalev-spa',
    nameEt: 'Kalev Spa bassein',
    nameEn: 'Kalev Spa Pool',
    type: 'POOL' as const,
    municipality: 'Tallinn',
    addressEt: 'Aia 18, Tallinn',
    addressEn: 'Aia 18, Tallinn',
    latitude: 59.4404,
    longitude: 24.7525,
    status: 'GOOD' as QualityStatus,
    reasonEt: 'Vesi on korras.',
    reasonEn: 'Water quality is compliant.',
  },
];

const run = async (): Promise<void> => {
  for (const sample of samplePlaces) {
    const place = await prisma.place.upsert({
      where: { externalId: sample.externalId },
      update: {
        nameEt: sample.nameEt,
        nameEn: sample.nameEn,
        type: sample.type,
        municipality: sample.municipality,
        addressEt: sample.addressEt,
        addressEn: sample.addressEn,
        latitude: sample.latitude,
        longitude: sample.longitude,
      },
      create: {
        externalId: sample.externalId,
        nameEt: sample.nameEt,
        nameEn: sample.nameEn,
        type: sample.type,
        municipality: sample.municipality,
        addressEt: sample.addressEt,
        addressEn: sample.addressEn,
        latitude: sample.latitude,
        longitude: sample.longitude,
      },
    });

    await prisma.waterQualityReading.upsert({
      where: {
        placeId_sampledAt_status: {
          placeId: place.id,
          sampledAt: new Date('2026-02-15T09:00:00.000Z'),
          status: sample.status,
        },
      },
      update: {
        statusReasonEt: sample.reasonEt,
        statusReasonEn: sample.reasonEn,
      },
      create: {
        placeId: place.id,
        sampledAt: new Date('2026-02-15T09:00:00.000Z'),
        status: sample.status,
        statusReasonEt: sample.reasonEt,
        statusReasonEn: sample.reasonEn,
        source: 'TERVISEAMET_XML',
        sourceUrl: 'https://vtiav.sm.ee/index.php/?active_tab_id=A',
      },
    });
  }
};

run()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
