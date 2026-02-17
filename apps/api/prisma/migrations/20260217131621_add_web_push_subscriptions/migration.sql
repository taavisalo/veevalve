-- CreateTable
CREATE TABLE "WebPushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "expirationTime" BIGINT,
    "locale" TEXT NOT NULL DEFAULT 'et',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "userAgent" TEXT,
    "lastError" TEXT,
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebPushFavorite" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebPushFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "WebPushSubscription_enabled_updatedAt_idx" ON "WebPushSubscription"("enabled", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "WebPushFavorite_placeId_idx" ON "WebPushFavorite"("placeId");

-- CreateIndex
CREATE UNIQUE INDEX "WebPushFavorite_subscriptionId_placeId_key" ON "WebPushFavorite"("subscriptionId", "placeId");

-- AddForeignKey
ALTER TABLE "WebPushFavorite" ADD CONSTRAINT "WebPushFavorite_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WebPushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebPushFavorite" ADD CONSTRAINT "WebPushFavorite_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
