-- =======================================================
-- Georgia Lottery Retail POS - Clean & Simplified Schema
-- Database Name: lotto_pos
-- Contains only essential fields with core DATE tracking
-- Zero empty dispenser slots stored
-- =======================================================

CREATE DATABASE IF NOT EXISTS `lotto_pos` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `lotto_pos`;

-- -------------------------------------------------------
-- 1. ACTIVE DISPENSERS (Only Loaded Active Boxes on Counter)
-- Stores ONLY boxes with an active game loaded. No empty boxes!
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `active_dispensers` (
  `box_number` INT PRIMARY KEY COMMENT 'Box # (1 to 65+)',
  `date` DATE NOT NULL DEFAULT (CURRENT_DATE) COMMENT 'Current business date',
  `game_name` VARCHAR(100) NOT NULL COMMENT 'Game Title',
  `ticket_price` DECIMAL(6, 2) NOT NULL DEFAULT 1.00 COMMENT 'Price ($)',
  `pack_number` VARCHAR(50) NOT NULL COMMENT 'Active Pack #',
  `start_ticket` INT NOT NULL DEFAULT 0 COMMENT 'Opening ticket number',
  `current_ticket` INT NOT NULL DEFAULT 0 COMMENT 'Current ticket ready to sell',
  `tickets_sold` INT NOT NULL DEFAULT 0 COMMENT 'Tickets sold',
  `tickets_remaining` INT NOT NULL DEFAULT 0 COMMENT 'Tickets left in box',
  `sales_revenue` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Sales amount ($)',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_dispenser_date` (`date`),
  INDEX `idx_dispenser_game` (`game_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 2. DAILY REPORTS (Day Settlement Summary)
-- Core financial summary for each business day
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `daily_reports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `report_date` VARCHAR(20) NOT NULL COMMENT 'Date (MM/DD/YYYY)',
  `report_time` VARCHAR(20) NOT NULL COMMENT 'Time',
  `user_id` VARCHAR(50) DEFAULT 'master' COMMENT 'Cashier name',
  `store_name` VARCHAR(120) DEFAULT 'AMIGO FOOD MART',
  `total_scratcher_sales` DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Total scratcher sales ($)',
  `online_sales` DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Online terminal sales ($)',
  `cashes` DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Winning payouts ($)',
  `total_sales` DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Grand total sales ($)',
  `net_balance` DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Net cash balance ($)',
  `boxes_data` JSON NULL COMMENT 'Raw snapshot backup',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_day_report_date` (`report_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 3. DAY BOX SALES (Itemized Sales per Box - Active Boxes Only)
-- Every row includes the Date. No empty boxes stored!
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `day_box_sales` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `report_id` INT NOT NULL COMMENT 'Parent daily_reports.id',
  `date` VARCHAR(20) NOT NULL COMMENT 'Date of sales (MM/DD/YYYY)',
  `box_number` INT NOT NULL COMMENT 'Dispenser Box #',
  `game_name` VARCHAR(100) NOT NULL COMMENT 'Game Title',
  `pack_number` VARCHAR(50) NOT NULL COMMENT 'Pack #',
  `ticket_price` DECIMAL(6, 2) NOT NULL DEFAULT 1.00 COMMENT 'Price ($)',
  `opening_ticket` INT NOT NULL DEFAULT 0 COMMENT 'Opening ticket',
  `closing_ticket` INT NOT NULL DEFAULT 0 COMMENT 'Closing ticket',
  `tickets_sold` INT NOT NULL DEFAULT 0 COMMENT 'Tickets sold',
  `sales_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Sales ($)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_day_sales_date` (`date`),
  INDEX `idx_day_sales_box` (`box_number`),
  INDEX `idx_day_sales_game` (`game_name`),
  CONSTRAINT `fk_day_box_report` FOREIGN KEY (`report_id`) REFERENCES `daily_reports` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 4. SHIFT REPORTS (Shift Settlement Summary)
-- Core shift financial audit
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `shift_reports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `shift_number` INT NOT NULL,
  `shift_date` VARCHAR(30) NOT NULL COMMENT 'Date of shift',
  `cashier` VARCHAR(60) NOT NULL,
  `total_tickets_sold` INT DEFAULT 0,
  `total_sales_revenue` DECIMAL(10, 2) DEFAULT 0.00,
  `cashes` DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Winning payouts ($)',
  `drawer_float` DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Opening cash float ($)',
  `actual_cash_counted` DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Cash counted in drawer ($)',
  `expected_cash` DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Expected cash ($)',
  `drawer_over_short` DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Over/Short difference ($)',
  `slots_snapshot` JSON NULL COMMENT 'Raw snapshot backup',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_shift_date` (`shift_date`),
  INDEX `idx_shift_num` (`shift_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 5. SHIFT BOX SALES (Itemized Sales per Shift - Active Boxes Only)
-- Every row includes the Date. No empty boxes stored!
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `shift_box_sales` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `shift_id` INT NOT NULL COMMENT 'Parent shift_reports.id',
  `shift_number` INT NOT NULL,
  `date` VARCHAR(30) NOT NULL COMMENT 'Date of shift',
  `box_number` INT NOT NULL COMMENT 'Dispenser Box #',
  `game_name` VARCHAR(100) NOT NULL COMMENT 'Game Title',
  `pack_number` VARCHAR(50) NOT NULL COMMENT 'Pack #',
  `ticket_price` DECIMAL(6, 2) NOT NULL DEFAULT 1.00 COMMENT 'Price ($)',
  `start_ticket` INT NOT NULL DEFAULT 0 COMMENT 'Opening ticket',
  `close_ticket` INT NOT NULL DEFAULT 0 COMMENT 'Closing ticket',
  `tickets_sold` INT NOT NULL DEFAULT 0 COMMENT 'Tickets sold',
  `sales_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00 COMMENT 'Sales ($)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_shift_sales_date` (`date`),
  INDEX `idx_shift_sales_box` (`box_number`),
  CONSTRAINT `fk_shift_box_report` FOREIGN KEY (`shift_id`) REFERENCES `shift_reports` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 6. STORE INVENTORY (Reserve Packs in Storage & Safe)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `store_inventory` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `date_received` VARCHAR(20) NOT NULL COMMENT 'Date added (MM/DD/YYYY)',
  `pack_number` VARCHAR(50) UNIQUE NOT NULL,
  `game_name` VARCHAR(100) NOT NULL,
  `ticket_price` DECIMAL(6, 2) NOT NULL DEFAULT 1.00,
  `pack_size` INT NOT NULL DEFAULT 100,
  `location` ENUM('STORAGE', 'SAFE') DEFAULT 'STORAGE',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_inv_date` (`date_received`),
  INDEX `idx_inv_loc` (`location`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 7. TICKET SCANS LOG (Barcode Scans & Ticket Sales)
-- Every individual scan logged with Date & Time
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ticket_scans_log` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `date` VARCHAR(20) NOT NULL COMMENT 'Date of scan',
  `time` VARCHAR(20) NOT NULL COMMENT 'Time of scan',
  `barcode` VARCHAR(100) NOT NULL,
  `box_number` INT NOT NULL,
  `game_name` VARCHAR(100) NOT NULL,
  `pack_number` VARCHAR(50) NOT NULL,
  `ticket_number` INT NOT NULL,
  `ticket_price` DECIMAL(6, 2) NOT NULL,
  `cashier` VARCHAR(60) DEFAULT 'master',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_scan_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 8. POS STATE BACKUP (Full Recovery Snapshot)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `pos_state` (
  `id` INT PRIMARY KEY,
  `state_data` LONGTEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- HUMAN-READABLE SQL VIEWS (Instant Management Views)
-- -------------------------------------------------------

-- View 1: Active Counter Dispensers (Only Loaded Boxes with Date!)
CREATE OR REPLACE VIEW `v_current_dispenser_rack` AS
SELECT 
  box_number AS `Box`,
  date AS `Date`,
  game_name AS `Game`,
  CONCAT('$', FORMAT(ticket_price, 2)) AS `Price`,
  pack_number AS `Pack #`,
  start_ticket AS `Open Ticket`,
  current_ticket AS `Current Ticket`,
  tickets_sold AS `Sold`,
  tickets_remaining AS `Left In Box`,
  CONCAT('$', FORMAT(sales_revenue, 2)) AS `Sales`
FROM active_dispensers
WHERE game_name IS NOT NULL AND game_name != 'EMPTY' AND pack_number IS NOT NULL AND pack_number != '---'
ORDER BY box_number;

-- View 2: Daily Sales Overview (With Date & Accounting totals)
CREATE OR REPLACE VIEW `v_daily_sales_overview` AS
SELECT 
  id AS `Report ID`,
  report_date AS `Date`,
  report_time AS `Time`,
  user_id AS `Cashier`,
  CONCAT('$', FORMAT(total_scratcher_sales, 2)) AS `Scratcher Sales`,
  CONCAT('$', FORMAT(online_sales, 2)) AS `Online Sales`,
  CONCAT('$', FORMAT(cashes, 2)) AS `Prize Payouts`,
  CONCAT('$', FORMAT(total_sales, 2)) AS `Total Sales`,
  CONCAT('$', FORMAT(net_balance, 2)) AS `Net Balance`
FROM daily_reports
ORDER BY id DESC;

-- View 3: Shift Settlement Audit (With Date & Over/Short)
CREATE OR REPLACE VIEW `v_shift_settlement_audit` AS
SELECT 
  shift_number AS `Shift #`,
  shift_date AS `Date`,
  cashier AS `Cashier`,
  total_tickets_sold AS `Sold`,
  CONCAT('$', FORMAT(total_sales_revenue, 2)) AS `Lotto Sales`,
  CONCAT('$', FORMAT(cashes, 2)) AS `Payouts`,
  CONCAT('$', FORMAT(drawer_float, 2)) AS `Float`,
  CONCAT('$', FORMAT(actual_cash_counted, 2)) AS `Counted`,
  CONCAT('$', FORMAT(drawer_over_short, 2)) AS `Over/Short`
FROM shift_reports
ORDER BY id DESC;

-- View 4: Top Selling Games
CREATE OR REPLACE VIEW `v_top_selling_games` AS
SELECT 
  game_name AS `Game`,
  CONCAT('$', FORMAT(ticket_price, 2)) AS `Price`,
  SUM(tickets_sold) AS `Total Sold`,
  CONCAT('$', FORMAT(SUM(sales_amount), 2)) AS `Total Sales`
FROM day_box_sales
WHERE tickets_sold > 0
GROUP BY game_name, ticket_price
ORDER BY SUM(sales_amount) DESC;
