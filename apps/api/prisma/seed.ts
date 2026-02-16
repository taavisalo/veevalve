import { PrismaClient, type PlaceType, type QualityStatus } from '@prisma/client';

const prisma = new PrismaClient();

interface SeedSample {
  type: PlaceType;
  externalId: string;
  nameEt: string;
  municipality: string;
  address: string;
  sampledAt: Date;
  status: QualityStatus;
  statusRaw: string;
  indicatorName: string;
  indicatorValue: string;
  indicatorUnit: string;
}

const seedSamples: SeedSample[] = [
  {
    type: 'BEACH',
    externalId: '119',
    nameEt: 'Pirita rand',
    municipality: 'Tallinn',
    address: 'Merivälja tee 1, Tallinn',
    sampledAt: new Date('2026-02-15T09:00:00.000Z'),
    status: 'GOOD',
    statusRaw: 'vastab nõuetele',
    indicatorName: 'Escherichia coli',
    indicatorValue: '30',
    indicatorUnit: 'PMÜ/100 ml',
  },
  {
    type: 'POOL',
    externalId: '244',
    nameEt: 'Adeli Terviseklubi bassein',
    municipality: 'Tallinn',
    address: 'Endla tn 4, Tallinn',
    sampledAt: new Date('2026-02-15T09:00:00.000Z'),
    status: 'BAD',
    statusRaw: 'ei vasta nõuetele',
    indicatorName: 'Nitraatioon',
    indicatorValue: '78',
    indicatorUnit: 'mg/l',
  },
];

const run = async (): Promise<void> => {
  for (const sample of seedSamples) {
    const place = await prisma.place.upsert({
      where: { externalKey: `${sample.type}:${sample.externalId}` },
      update: {
        externalId: sample.externalId,
        nameEt: sample.nameEt,
        nameEn: sample.nameEt,
        municipality: sample.municipality,
        addressEt: sample.address,
        addressEn: sample.address,
      },
      create: {
        externalId: sample.externalId,
        externalKey: `${sample.type}:${sample.externalId}`,
        type: sample.type,
        nameEt: sample.nameEt,
        nameEn: sample.nameEt,
        municipality: sample.municipality,
        addressEt: sample.address,
        addressEn: sample.address,
      },
    });

    if (sample.type === 'POOL') {
      await prisma.poolProfile.upsert({
        where: { externalId: sample.externalId },
        update: {
          placeId: place.id,
          assessmentRaw: sample.statusRaw,
          assessmentStatus: sample.status,
        },
        create: {
          externalId: sample.externalId,
          placeId: place.id,
          assessmentRaw: sample.statusRaw,
          assessmentStatus: sample.status,
        },
      });
    } else {
      await prisma.beachProfile.upsert({
        where: { externalId: sample.externalId },
        update: {
          placeId: place.id,
          latestQualityRaw: sample.statusRaw,
          latestSampleAt: sample.sampledAt,
        },
        create: {
          externalId: sample.externalId,
          placeId: place.id,
          latestQualityRaw: sample.statusRaw,
          latestSampleAt: sample.sampledAt,
        },
      });
    }

    const point = await prisma.samplingPoint.upsert({
      where: {
        placeId_externalId: {
          placeId: place.id,
          externalId: `${sample.externalId}-point-1`,
        },
      },
      update: {
        name: sample.nameEt,
        address: sample.address,
      },
      create: {
        placeId: place.id,
        externalId: `${sample.externalId}-point-1`,
        name: sample.nameEt,
        address: sample.address,
      },
    });

    const sampleRow = await prisma.waterQualitySample.upsert({
      where: {
        placeId_externalId: {
          placeId: place.id,
          externalId: `${sample.externalId}-sample-1`,
        },
      },
      update: {
        sampledAt: sample.sampledAt,
        samplingPointId: point.id,
        sourceYear: 2026,
        sourceUrl: 'https://vtiav.sm.ee/index.php/opendata',
        overallAssessmentRaw: sample.statusRaw,
        overallStatus: sample.status,
      },
      create: {
        placeId: place.id,
        externalId: `${sample.externalId}-sample-1`,
        sampledAt: sample.sampledAt,
        samplingPointId: point.id,
        sourceYear: 2026,
        sourceUrl: 'https://vtiav.sm.ee/index.php/opendata',
        overallAssessmentRaw: sample.statusRaw,
        overallStatus: sample.status,
      },
    });

    await prisma.waterQualityProtocol.deleteMany({
      where: { sampleId: sampleRow.id },
    });

    const protocol = await prisma.waterQualityProtocol.create({
      data: {
        sampleId: sampleRow.id,
        protocolOrder: 0,
        protocolNumber: `${sample.externalId}-protocol-1`,
        assessmentRaw: sample.statusRaw,
        assessmentStatus: sample.status,
      },
    });

    await prisma.waterQualityIndicator.create({
      data: {
        protocolId: protocol.id,
        indicatorOrder: 0,
        indicatorExternalId: 'seed-indicator-1',
        name: sample.indicatorName,
        valueRaw: sample.indicatorValue,
        valueNumber: Number.parseFloat(sample.indicatorValue),
        unit: sample.indicatorUnit,
        assessmentRaw: sample.statusRaw,
        assessmentStatus: sample.status,
      },
    });

    await prisma.placeLatestStatus.upsert({
      where: { placeId: place.id },
      update: {
        sampleId: sampleRow.id,
        sampledAt: sample.sampledAt,
        status: sample.status,
        statusRaw: sample.statusRaw,
        statusReasonEt: sample.statusRaw,
        statusReasonEn: sample.statusRaw,
        sourceUrl: 'https://vtiav.sm.ee/index.php/opendata',
      },
      create: {
        placeId: place.id,
        sampleId: sampleRow.id,
        sampledAt: sample.sampledAt,
        status: sample.status,
        statusRaw: sample.statusRaw,
        statusReasonEt: sample.statusRaw,
        statusReasonEn: sample.statusRaw,
        sourceUrl: 'https://vtiav.sm.ee/index.php/opendata',
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
