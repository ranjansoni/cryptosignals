-- CreateTable
CREATE TABLE `prices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `asset` VARCHAR(10) NOT NULL,
    `ts` TIMESTAMP(0) NOT NULL,
    `open` DECIMAL(20, 8) NOT NULL,
    `high` DECIMAL(20, 8) NOT NULL,
    `low` DECIMAL(20, 8) NOT NULL,
    `close` DECIMAL(20, 8) NOT NULL,
    `volume` DECIMAL(30, 8) NOT NULL,
    `source` VARCHAR(50) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `prices_asset_ts_idx`(`asset`, `ts`),
    UNIQUE INDEX `prices_asset_ts_source_key`(`asset`, `ts`, `source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `signal_states` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `signalId` VARCHAR(50) NOT NULL,
    `asset` VARCHAR(10) NOT NULL,
    `ts` TIMESTAMP(0) NOT NULL,
    `state` VARCHAR(20) NOT NULL,
    `rawJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `signal_states_signalId_asset_ts_idx`(`signalId`, `asset`, `ts`),
    INDEX `signal_states_signalId_asset_idx`(`signalId`, `asset`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `signal_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `signalId` VARCHAR(50) NOT NULL,
    `asset` VARCHAR(10) NOT NULL,
    `ts` TIMESTAMP(0) NOT NULL,
    `prevState` VARCHAR(20) NOT NULL,
    `newState` VARCHAR(20) NOT NULL,
    `entryPrice` DECIMAL(20, 8) NOT NULL,
    `horizonsJson` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `signal_events_signalId_asset_idx`(`signalId`, `asset`),
    INDEX `signal_events_ts_idx`(`ts`),
    UNIQUE INDEX `signal_events_signalId_asset_ts_newState_key`(`signalId`, `asset`, `ts`, `newState`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `signal_outcomes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `horizon` VARCHAR(10) NOT NULL,
    `exitTs` TIMESTAMP(0) NOT NULL,
    `exitPrice` DECIMAL(20, 8) NOT NULL,
    `forwardReturn` DECIMAL(10, 6) NOT NULL,
    `success` BOOLEAN NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `signal_outcomes_eventId_idx`(`eventId`),
    UNIQUE INDEX `signal_outcomes_eventId_horizon_key`(`eventId`, `horizon`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `signal_stats` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `signalId` VARCHAR(50) NOT NULL,
    `asset` VARCHAR(10) NOT NULL,
    `horizon` VARCHAR(10) NOT NULL,
    `window` VARCHAR(10) NOT NULL,
    `nEvents` INTEGER NOT NULL DEFAULT 0,
    `hitRate` DECIMAL(5, 4) NULL,
    `avgReturn` DECIMAL(10, 6) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `signal_stats_signalId_asset_idx`(`signalId`, `asset`),
    UNIQUE INDEX `signal_stats_signalId_asset_horizon_window_key`(`signalId`, `asset`, `horizon`, `window`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_runs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jobName` VARCHAR(50) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `finishedAt` DATETIME(3) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'running',
    `errorJson` JSON NULL,
    `lockKey` VARCHAR(20) NOT NULL,

    INDEX `job_runs_jobName_status_idx`(`jobName`, `status`),
    UNIQUE INDEX `job_runs_jobName_lockKey_key`(`jobName`, `lockKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `signal_outcomes` ADD CONSTRAINT `signal_outcomes_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `signal_events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
