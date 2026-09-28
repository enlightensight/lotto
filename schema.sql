-- =======================================================
-- Georgia Lottery Tracking System - MySQL Database Schema
-- Database Name: lotto_pos
-- =======================================================

CREATE DATABASE IF NOT EXISTS `lotto_pos` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `lotto_pos`;

-- 1. Daily Reports Table (Official Georgia Lottery Retailer Day Report)
CREATE TABLE IF NOT EXISTS `daily_reports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `report_date` VARCHAR(20) NOT NULL,
  `report_time` VARCHAR(20) NOT NULL,
  `user_id` VARCHAR(50) DEFAULT 'master',
  `store_name` VARCHAR(120) DEFAULT 'AMIGO FOOD MART',
  `store_address` VARCHAR(255) DEFAULT '2300 MOODY RD WARNER ROBINS, GA, 31088',
  `total_scratcher_sales` DECIMAL(10, 2) DEFAULT 0.00,
  `cashes` DECIMAL(10, 2) DEFAULT 0.00,
  `online_sales` DECIMAL(10, 2) DEFAULT 0.00,
  `online_cashes` DECIMAL(10, 2) DEFAULT 0.00,
  `total_sales` DECIMAL(10, 2) DEFAULT 0.00,
  `total_cashes` DECIMAL(10, 2) DEFAULT 0.00,
  `net_balance` DECIMAL(10, 2) DEFAULT 0.00,
  `inventory_stats` JSON,
  `activations` JSON,
  `sold_out` JSON,
  `boxes_data` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Shift Reports Table (Shift-by-Shift Cash & Sales Audit)
CREATE TABLE IF NOT EXISTS `shift_reports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `shift_number` INT NOT NULL,
  `cashier` VARCHAR(60) NOT NULL,
  `started_at` VARCHAR(60),
  `ended_at` VARCHAR(60),
  `total_tickets_sold` INT DEFAULT 0,
  `total_sales_revenue` DECIMAL(10, 2) DEFAULT 0.00,
  `cashes` DECIMAL(10, 2) DEFAULT 0.00,
  `online_sales` DECIMAL(10, 2) DEFAULT 0.00,
  `online_cashes` DECIMAL(10, 2) DEFAULT 0.00,
  `drawer_float` DECIMAL(10, 2) DEFAULT 0.00,
  `activations_count` INT DEFAULT 0,
  `slots_snapshot` JSON,
  `sold_out_snapshot` JSON,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Sold Out Pack Audit Trail
CREATE TABLE IF NOT EXISTS `sold_out_packs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `shift_number` INT DEFAULT 1,
  `box_number` INT NOT NULL,
  `game_name` VARCHAR(100) NOT NULL,
  `price` DECIMAL(8, 2) NOT NULL,
  `pack_number` VARCHAR(50) NOT NULL,
  `pack_size` INT DEFAULT 0,
  `start_ticket` INT DEFAULT 0,
  `close_ticket` INT DEFAULT 0,
  `tickets_sold` INT DEFAULT 0,
  `sales_amount` DECIMAL(10, 2) DEFAULT 0.00,
  `is_returned` BOOLEAN DEFAULT FALSE,
  `tickets_returned` INT DEFAULT 0,
  `sold_at` VARCHAR(50),
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. POS State Storage (System State Backup)
CREATE TABLE IF NOT EXISTS `pos_state` (
  `id` INT PRIMARY KEY,
  `state_data` LONGTEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
