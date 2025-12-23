-- CreateTable
CREATE TABLE `price_candles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset` VARCHAR(20) NOT NULL,
    `timeframe` VARCHAR(10) NOT NULL,
    `ts` TIMESTAMP(0) NOT NULL,
    `open` DECIMAL(20, 8) NOT NULL,
    `high` DECIMAL(20, 8) NOT NULL,
    `low` DECIMAL(20, 8) NOT NULL,
    `close` DECIMAL(20, 8) NOT NULL,
    `volume` DECIMAL(30, 8) NULL,
    `source` VARCHAR(50) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `price_candles_asset_timeframe_ts_idx`(`asset`, `timeframe`, `ts`),
    UNIQUE INDEX `price_candles_asset_timeframe_ts_source_key`(`asset`, `timeframe`, `ts`, `source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `signal_snapshots` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `snapshotTs` TIMESTAMP(0) NOT NULL,
    `asset` VARCHAR(20) NOT NULL,
    `horizonBucket` VARCHAR(10) NOT NULL,
    `signalId` VARCHAR(50) NOT NULL,
    `state` VARCHAR(30) NOT NULL,
    `evidenceJson` JSON NOT NULL,
    `justificationJson` JSON NOT NULL,
    `entryPrice` DECIMAL(20, 8) NULL,
    `priceSource` VARCHAR(50) NULL,
    `signalVersion` VARCHAR(20) NOT NULL DEFAULT '1.0',
    `dataVersion` VARCHAR(20) NOT NULL DEFAULT '1.0',
    `promptVersion` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `signal_snapshots_asset_horizonBucket_idx`(`asset`, `horizonBucket`),
    INDEX `signal_snapshots_signalId_snapshotTs_idx`(`signalId`, `snapshotTs`),
    UNIQUE INDEX `signal_snapshots_snapshotTs_asset_horizonBucket_signalId_key`(`snapshotTs`, `asset`, `horizonBucket`, `signalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
