-- ==============================================================================
-- Jackpotlo Production Database Migration (Safe, Additive, Non-Destructive)
-- Target Database: jackpotlo (Production)
-- Collation Standard: utf8mb4_general_ci (matching production stores table)
-- Engine: InnoDB
-- 
-- Production Pre-conditions Verified:
-- - stores table pre-exists with collation utf8mb4_general_ci
-- - Existing store_amigo record pre-exists and MUST be reused (never recreated/inserted)
-- - stores.operational_status is ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE'
-- - admin_users table and adm_001 credentials MUST be strictly preserved
-- ==============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------------------------
-- 1. Ensure Store POS State Table Exists
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `store_pos_state` (
  `store_id` VARCHAR(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `state_data` LONGTEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------------------------
-- 2. Modify stores.authorization_status Default to 'PENDING'
-- NOTE: Uses ALTER COLUMN SET DEFAULT to modify ONLY the column default.
-- Does NOT recreate the table, does NOT insert/delete rows, does NOT alter existing data.
-- Existing stores (including store_amigo) retain their current approval status.
-- ------------------------------------------------------------------------------
ALTER TABLE `stores` 
  ALTER COLUMN `authorization_status` SET DEFAULT 'PENDING';

-- ------------------------------------------------------------------------------
-- 3. Create Store Users Table (Dual-Login Store Identity Namespace)
-- Collation: utf8mb4_general_ci (strictly matching stores.store_id for FK compatibility)
-- Default Account Status: PENDING (enforces mandatory administrator approval for new registrations)
-- Referential Integrity: ON DELETE RESTRICT (prevents cascading deletion of store user accounts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `store_users` (
  `id` VARCHAR(60) NOT NULL,
  `store_id` VARCHAR(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `username` VARCHAR(60) NOT NULL,
  `email` VARCHAR(120) NOT NULL DEFAULT '',
  `normalized_email` VARCHAR(120) NOT NULL DEFAULT '',
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `role` VARCHAR(50) NOT NULL DEFAULT 'STORE_USER',
  `account_status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
  `is_active` TINYINT(1) DEFAULT 1,
  `approval_notes` TEXT NULL,
  `approved_by` VARCHAR(60) NULL,
  `approved_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_user_email` (`store_id`, `normalized_email`),
  INDEX `idx_store_user_norm_email` (`normalized_email`),
  INDEX `idx_store_user_lookup` (`username`),
  INDEX `idx_store_user_store` (`store_id`),
  CONSTRAINT `fk_store_user_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`store_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3b. Ensure account_status default is PENDING if store_users pre-existed
ALTER TABLE `store_users` 
  ALTER COLUMN `account_status` SET DEFAULT 'PENDING';

-- ------------------------------------------------------------------------------
-- 4. Create Store Feedback & Issue Reporting Table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `store_feedback` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `feedback_id` VARCHAR(60) UNIQUE NOT NULL,
  `store_id` VARCHAR(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `store_name` VARCHAR(150) NOT NULL,
  `cashier_name` VARCHAR(100) DEFAULT 'cashier',
  `register_id` VARCHAR(50) DEFAULT 'register_1',
  `shift_number` INT DEFAULT 1,
  `category` ENUM('SCANNER', 'INVENTORY', 'SHIFT_REPORT', 'SALES', 'BUG', 'OTHER') NOT NULL DEFAULT 'OTHER',
  `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  `description` TEXT NOT NULL,
  `status` ENUM('PENDING', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'PENDING',
  `admin_notes` TEXT NULL,
  `reviewed_by` VARCHAR(60) NULL,
  `reviewed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_feedback_store` (`store_id`),
  INDEX `idx_feedback_status` (`status`),
  INDEX `idx_feedback_created` (`created_at`),
  CONSTRAINT `fk_feedback_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`store_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------------------------
-- 5. Create Store Pending Tickets Table (Automatic Barcode Detection)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `store_pending_tickets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `store_id` VARCHAR(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `barcode` VARCHAR(100) NOT NULL,
  `pack_number` VARCHAR(50) NULL,
  `game_number` VARCHAR(50) NULL,
  `ticket_number` INT NULL,
  `game_name` VARCHAR(120) NULL,
  `ticket_price` DECIMAL(6, 2) NULL,
  `box_number` INT NULL,
  `status` ENUM('PENDING_SETUP', 'CONFIGURED') NOT NULL DEFAULT 'PENDING_SETUP',
  `cashier` VARCHAR(60) NULL,
  `session_info` VARCHAR(100) NULL,
  `discovered_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `configured_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_store_barcode` (`store_id`, `barcode`),
  INDEX `idx_spt_store_status` (`store_id`, `status`),
  CONSTRAINT `fk_spt_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`store_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ------------------------------------------------------------------------------
-- 6. Platform Administrator adm_001 Email Alignment (Password Hash Untouched)
-- Strictly preserves adm_001's password_hash; updates only the email contact.
-- ------------------------------------------------------------------------------
UPDATE `admin_users` 
SET `email` = 'amigofoodmart2300@gmail.com' 
WHERE `id` = 'adm_001' AND (`email` IS NULL OR `email` = '' OR `email` = 'admin@jackpotlo.com');

SET FOREIGN_KEY_CHECKS = 1;
