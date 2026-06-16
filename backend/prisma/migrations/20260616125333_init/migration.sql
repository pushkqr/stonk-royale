-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `oauth_id` VARCHAR(191) NULL,
    `username` VARCHAR(191) NOT NULL,
    `avatar_url` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_oauth_id_key`(`oauth_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Room` (
    `id` VARCHAR(191) NOT NULL,
    `room_code` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'WAITING',
    `start_time` DATETIME(3) NULL,
    `end_time` DATETIME(3) NULL,
    `starting_balance` DOUBLE NOT NULL DEFAULT 100000.0,

    UNIQUE INDEX `Room_room_code_key`(`room_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoomPlayer` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `available_cash` DOUBLE NOT NULL,
    `is_ready` BOOLEAN NOT NULL DEFAULT false,
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RoomPlayer_user_id_room_id_key`(`user_id`, `room_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Holding` (
    `id` VARCHAR(191) NOT NULL,
    `room_player_id` VARCHAR(191) NOT NULL,
    `ticker` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `average_buy_price` DOUBLE NOT NULL,

    UNIQUE INDEX `Holding_room_player_id_ticker_key`(`room_player_id`, `ticker`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` VARCHAR(191) NOT NULL,
    `room_player_id` VARCHAR(191) NOT NULL,
    `ticker` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `price` DOUBLE NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RoomPlayer` ADD CONSTRAINT `RoomPlayer_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomPlayer` ADD CONSTRAINT `RoomPlayer_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `Room`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Holding` ADD CONSTRAINT `Holding_room_player_id_fkey` FOREIGN KEY (`room_player_id`) REFERENCES `RoomPlayer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_room_player_id_fkey` FOREIGN KEY (`room_player_id`) REFERENCES `RoomPlayer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
