-- CreateEnum
CREATE TYPE "PlaceType" AS ENUM ('BEACH', 'POOL');

-- CreateEnum
CREATE TYPE "QualityStatus" AS ENUM ('GOOD', 'BAD', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "WaterSource" AS ENUM ('TERVISEAMET_XML');

-- CreateEnum
CREATE TYPE "SourceFileKind" AS ENUM ('POOL_LOCATIONS', 'POOL_FACILITIES', 'POOL_SAMPLES', 'BEACH_LOCATIONS', 'BEACH_SAMPLES');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE', 'APPLE', 'MICROSOFT', 'TARA', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT,
    "preferredLocale" TEXT NOT NULL DEFAULT 'et',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "nameEt" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "type" "PlaceType" NOT NULL,
    "municipality" TEXT NOT NULL,
    "addressEt" TEXT,
    "addressEn" TEXT,
    "coordinateX" DOUBLE PRECISION,
    "coordinateY" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolFacility" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "type" TEXT,
    "sourceUrl" TEXT,
    "coordinateX" DOUBLE PRECISION,
    "coordinateY" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "userCount" INTEGER,
    "ownerExternalId" TEXT,
    "ownerName" TEXT,
    "ownerPhone" TEXT,
    "ownerEmail" TEXT,
    "lastInspectionAt" TIMESTAMP(3),
    "inspector" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolFacility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoolProfile" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "facilityId" TEXT,
    "poolType" TEXT,
    "loadText" TEXT,
    "waterExchangeType" TEXT,
    "areaM2" DOUBLE PRECISION,
    "volumeM3" DOUBLE PRECISION,
    "perimeterM" DOUBLE PRECISION,
    "minDepthCm" DOUBLE PRECISION,
    "maxDepthCm" DOUBLE PRECISION,
    "assessmentRaw" TEXT,
    "assessmentStatus" "QualityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "assessmentDate" TIMESTAMP(3),
    "lastInspectionAt" TIMESTAMP(3),
    "inspector" TEXT,
    "inspectorNotes" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PoolProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeachProfile" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "groupId" TEXT,
    "beachType" TEXT,
    "sourceUrl" TEXT,
    "profileUrl" TEXT,
    "waterBodyName" TEXT,
    "waterBodyType" TEXT,
    "visitorCount" INTEGER,
    "shorelineLengthM" DOUBLE PRECISION,
    "monitoringCalendarDate" TIMESTAMP(3),
    "lastInspectionAt" TIMESTAMP(3),
    "inspector" TEXT,
    "latestSampleAt" TIMESTAMP(3),
    "latestQualityRaw" TEXT,
    "latestQualityClassRaw" TEXT,
    "samplingProtocolNumber" TEXT,
    "coverLetterNumber" TEXT,
    "samplerRole" TEXT,
    "inspectorComments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeachProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SamplingPoint" (
    "id" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "coordinateX" DOUBLE PRECISION,
    "coordinateY" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "locationDetails" TEXT,
    "waterSourceType" TEXT,
    "pointType" TEXT,
    "pointClass" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SamplingPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterQualitySample" (
    "id" TEXT NOT NULL,
    "source" "WaterSource" NOT NULL DEFAULT 'TERVISEAMET_XML',
    "sourceYear" INTEGER,
    "sourceUrl" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "samplingPointId" TEXT,
    "sampledAt" TIMESTAMP(3) NOT NULL,
    "waterType" TEXT,
    "sampleType" TEXT,
    "samplerName" TEXT,
    "samplerRole" TEXT,
    "samplerCertificateNumber" TEXT,
    "samplingPurpose" TEXT,
    "samplingMethod" TEXT,
    "samplingProtocolNumber" TEXT,
    "overallAssessmentRaw" TEXT,
    "overallStatus" "QualityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterQualitySample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterQualityProtocol" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "protocolOrder" INTEGER NOT NULL,
    "coverLetterNumber" TEXT,
    "protocolNumber" TEXT,
    "assessmentRaw" TEXT,
    "assessmentStatus" "QualityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterQualityProtocol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterQualityIndicator" (
    "id" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "indicatorOrder" INTEGER NOT NULL,
    "indicatorExternalId" TEXT,
    "name" TEXT NOT NULL,
    "valueRaw" TEXT,
    "valueNumber" DOUBLE PRECISION,
    "unit" TEXT,
    "assessmentRaw" TEXT,
    "assessmentStatus" "QualityStatus" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterQualityIndicator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceLatestStatus" (
    "placeId" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "sampledAt" TIMESTAMP(3) NOT NULL,
    "status" "QualityStatus" NOT NULL,
    "statusRaw" TEXT,
    "statusReasonEt" TEXT,
    "statusReasonEn" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaceLatestStatus_pkey" PRIMARY KEY ("placeId")
);

-- CreateTable
CREATE TABLE "SourceSyncState" (
    "id" TEXT NOT NULL,
    "source" "WaterSource" NOT NULL DEFAULT 'TERVISEAMET_XML',
    "fileKind" "SourceFileKind" NOT NULL,
    "year" INTEGER NOT NULL DEFAULT 0,
    "url" TEXT NOT NULL,
    "etag" TEXT,
    "lastModified" TEXT,
    "contentHash" TEXT,
    "contentLength" INTEGER,
    "lastStatusCode" INTEGER,
    "lastCheckedAt" TIMESTAMP(3),
    "lastChangedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceSyncState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "placeId" TEXT,
    "pushToken" TEXT NOT NULL,
    "qualityChangeAlert" BOOLEAN NOT NULL DEFAULT true,
    "locationAlert" BOOLEAN NOT NULL DEFAULT false,
    "radiusMeters" INTEGER NOT NULL DEFAULT 1000,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL,
    "preferenceId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "previousStatus" "QualityStatus" NOT NULL,
    "currentStatus" "QualityStatus" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserIdentity_userId_idx" ON "UserIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_provider_providerUserId_key" ON "UserIdentity"("provider", "providerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Place_externalKey_key" ON "Place"("externalKey");

-- CreateIndex
CREATE INDEX "Place_type_idx" ON "Place"("type");

-- CreateIndex
CREATE INDEX "Place_municipality_idx" ON "Place"("municipality");

-- CreateIndex
CREATE INDEX "Place_type_nameEt_idx" ON "Place"("type", "nameEt");

-- CreateIndex
CREATE INDEX "Place_latitude_longitude_idx" ON "Place"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "Place_type_externalId_key" ON "Place"("type", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "PoolFacility_externalId_key" ON "PoolFacility"("externalId");

-- CreateIndex
CREATE INDEX "PoolFacility_name_idx" ON "PoolFacility"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PoolProfile_placeId_key" ON "PoolProfile"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "PoolProfile_externalId_key" ON "PoolProfile"("externalId");

-- CreateIndex
CREATE INDEX "PoolProfile_facilityId_idx" ON "PoolProfile"("facilityId");

-- CreateIndex
CREATE INDEX "PoolProfile_assessmentStatus_assessmentDate_idx" ON "PoolProfile"("assessmentStatus", "assessmentDate" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "BeachProfile_placeId_key" ON "BeachProfile"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "BeachProfile_externalId_key" ON "BeachProfile"("externalId");

-- CreateIndex
CREATE INDEX "BeachProfile_latestSampleAt_idx" ON "BeachProfile"("latestSampleAt" DESC);

-- CreateIndex
CREATE INDEX "BeachProfile_latestQualityRaw_idx" ON "BeachProfile"("latestQualityRaw");

-- CreateIndex
CREATE INDEX "SamplingPoint_placeId_idx" ON "SamplingPoint"("placeId");

-- CreateIndex
CREATE INDEX "SamplingPoint_latitude_longitude_idx" ON "SamplingPoint"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "SamplingPoint_name_idx" ON "SamplingPoint"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SamplingPoint_placeId_externalId_key" ON "SamplingPoint"("placeId", "externalId");

-- CreateIndex
CREATE INDEX "WaterQualitySample_placeId_sampledAt_idx" ON "WaterQualitySample"("placeId", "sampledAt" DESC);

-- CreateIndex
CREATE INDEX "WaterQualitySample_sampledAt_idx" ON "WaterQualitySample"("sampledAt" DESC);

-- CreateIndex
CREATE INDEX "WaterQualitySample_overallStatus_sampledAt_idx" ON "WaterQualitySample"("overallStatus", "sampledAt" DESC);

-- CreateIndex
CREATE INDEX "WaterQualitySample_sourceYear_sampledAt_idx" ON "WaterQualitySample"("sourceYear", "sampledAt" DESC);

-- CreateIndex
CREATE INDEX "WaterQualitySample_samplingPointId_sampledAt_idx" ON "WaterQualitySample"("samplingPointId", "sampledAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WaterQualitySample_placeId_externalId_key" ON "WaterQualitySample"("placeId", "externalId");

-- CreateIndex
CREATE INDEX "WaterQualityProtocol_sampleId_assessmentStatus_idx" ON "WaterQualityProtocol"("sampleId", "assessmentStatus");

-- CreateIndex
CREATE INDEX "WaterQualityProtocol_protocolNumber_idx" ON "WaterQualityProtocol"("protocolNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WaterQualityProtocol_sampleId_protocolOrder_key" ON "WaterQualityProtocol"("sampleId", "protocolOrder");

-- CreateIndex
CREATE INDEX "WaterQualityIndicator_protocolId_assessmentStatus_idx" ON "WaterQualityIndicator"("protocolId", "assessmentStatus");

-- CreateIndex
CREATE INDEX "WaterQualityIndicator_name_idx" ON "WaterQualityIndicator"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WaterQualityIndicator_protocolId_indicatorOrder_key" ON "WaterQualityIndicator"("protocolId", "indicatorOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PlaceLatestStatus_sampleId_key" ON "PlaceLatestStatus"("sampleId");

-- CreateIndex
CREATE INDEX "PlaceLatestStatus_status_sampledAt_idx" ON "PlaceLatestStatus"("status", "sampledAt" DESC);

-- CreateIndex
CREATE INDEX "PlaceLatestStatus_sampledAt_idx" ON "PlaceLatestStatus"("sampledAt" DESC);

-- CreateIndex
CREATE INDEX "SourceSyncState_lastCheckedAt_idx" ON "SourceSyncState"("lastCheckedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SourceSyncState_fileKind_year_key" ON "SourceSyncState"("fileKind", "year");

-- CreateIndex
CREATE INDEX "Favorite_placeId_idx" ON "Favorite"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_placeId_key" ON "Favorite"("userId", "placeId");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "NotificationPreference_placeId_idx" ON "NotificationPreference"("placeId");

-- CreateIndex
CREATE INDEX "NotificationEvent_preferenceId_idx" ON "NotificationEvent"("preferenceId");

-- CreateIndex
CREATE INDEX "NotificationEvent_placeId_idx" ON "NotificationEvent"("placeId");

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolProfile" ADD CONSTRAINT "PoolProfile_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PoolProfile" ADD CONSTRAINT "PoolProfile_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "PoolFacility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeachProfile" ADD CONSTRAINT "BeachProfile_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SamplingPoint" ADD CONSTRAINT "SamplingPoint_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterQualitySample" ADD CONSTRAINT "WaterQualitySample_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterQualitySample" ADD CONSTRAINT "WaterQualitySample_samplingPointId_fkey" FOREIGN KEY ("samplingPointId") REFERENCES "SamplingPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterQualityProtocol" ADD CONSTRAINT "WaterQualityProtocol_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "WaterQualitySample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterQualityIndicator" ADD CONSTRAINT "WaterQualityIndicator_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "WaterQualityProtocol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceLatestStatus" ADD CONSTRAINT "PlaceLatestStatus_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceLatestStatus" ADD CONSTRAINT "PlaceLatestStatus_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "WaterQualitySample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
