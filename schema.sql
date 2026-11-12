-- =======================================================
-- Georgia Lottery Retail POS - Clean & Simplified Schema
-- Contains only essential fields with core DATE tracking
-- Zero empty dispenser slots stored
-- Safe for local development & managed cloud MySQL (Railway)
-- =======================================================

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
  `store_id` VARCHAR(60) NOT NULL DEFAULT 'store_amigo',
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

-- -------------------------------------------------------
-- 9. PLATFORM ADMINISTRATOR USERS (Role-Based Admin Access)
-- Only provisioned admins can access /admin
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` VARCHAR(50) PRIMARY KEY,
  `username` VARCHAR(60) UNIQUE NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(120),
  `role` VARCHAR(50) DEFAULT 'SUPER_ADMIN',
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_login_at` TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default platform admin if not exists (username: admin)
INSERT IGNORE INTO `admin_users` (`id`, `username`, `password_hash`, `full_name`, `email`, `role`, `is_active`)
VALUES ('adm_001', 'admin', 'pbkdf2$sha256$600000$cd6c3d5a6825bacb8c9672eeaf7a17ca$e45c734488db7a6652d42f5cd061edcc7b492e924262a209624c7f8aeae266cc', 'Platform Administrator', 'amigofoodmart2300@gmail.com', 'SUPER_ADMIN', 1);

CREATE TABLE IF NOT EXISTS `store_pos_state` (
  `store_id` VARCHAR(60) PRIMARY KEY,
  `state_data` LONGTEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 10. STORES DIRECTORY & AUTHORIZATIONS
-- Multi-store operational & authorization tracking
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stores` (
  `store_id` VARCHAR(60) PRIMARY KEY,
  `store_name` VARCHAR(150) NOT NULL,
  `owner_username` VARCHAR(60) NOT NULL,
  `retailer_number` VARCHAR(50),
  `address` VARCHAR(255),
  `phone` VARCHAR(50),
  `total_boxes` INT DEFAULT 65,
  `authorization_status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
  `operational_status` ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_store_auth` (`authorization_status`),
  INDEX `idx_store_owner` (`owner_username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default authorized stores
INSERT IGNORE INTO `stores` (`store_id`, `store_name`, `owner_username`, `retailer_number`, `address`, `phone`, `total_boxes`, `authorization_status`, `operational_status`)
VALUES 
  ('store_amigo', 'AMIGO FOOD MART', 'amigo', 'GA-89412', '2300 MOODY RD WARNER ROBINS, GA, 31088', '(478) 923-4567', 65, 'APPROVED', 'ACTIVE'),
  ('store_downtown', 'DOWNTOWN QUICK MART', 'downtown_owner', 'GA-94103', '104 N COMMERCIAL BLVD, WARNER ROBINS, GA, 31088', '(478) 953-8821', 60, 'APPROVED', 'ACTIVE');

-- -------------------------------------------------------
-- 10b. STORE USERS (Retail Store Staff, Cashiers & Owners)
-- Multi-store retail staff with role and approval tracking
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `store_users` (
  `id` VARCHAR(60) PRIMARY KEY,
  `store_id` VARCHAR(60) NOT NULL,
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
  UNIQUE KEY `uk_store_user_email` (`store_id`, `normalized_email`),
  INDEX `idx_store_user_norm_email` (`normalized_email`),
  INDEX `idx_store_user_lookup` (`username`),
  INDEX `idx_store_user_store` (`store_id`),
  CONSTRAINT `fk_store_user_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`store_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 11. STORE APPLICATIONS (Onboarding & Retailer Licenses)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `store_applications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `store_id` VARCHAR(60) NOT NULL,
  `store_name` VARCHAR(150) NOT NULL,
  `applicant_name` VARCHAR(100) NOT NULL,
  `applicant_email` VARCHAR(120),
  `applicant_phone` VARCHAR(50),
  `business_tax_id` VARCHAR(50),
  `lottery_retailer_id` VARCHAR(50),
  `address` VARCHAR(255),
  `documents` JSON NULL COMMENT 'List of uploaded files/licenses',
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'MORE_INFO_REQUIRED') DEFAULT 'PENDING',
  `admin_notes` TEXT NULL,
  `reviewed_by` VARCHAR(60) NULL,
  `reviewed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_app_status` (`status`),
  INDEX `idx_app_store` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 12. LOTTERY TICKET CATALOG (Central State Lottery Games)
-- Centralized catalog managed by Administrators
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lottery_ticket_catalog` (
  `game_id` VARCHAR(50) PRIMARY KEY,
  `game_name` VARCHAR(120) NOT NULL,
  `game_code` VARCHAR(20) NOT NULL,
  `price` DECIMAL(6, 2) NOT NULL DEFAULT 1.00,
  `pack_size` INT NOT NULL DEFAULT 100,
  `pack_value` DECIMAL(10, 2) NOT NULL DEFAULT 300.00,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_catalog_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default lottery catalog with standard Georgia Lottery scratch games
INSERT IGNORE INTO `lottery_ticket_catalog` (`game_id`, `game_name`, `game_code`, `price`, `pack_size`, `pack_value`, `is_active`)
VALUES
  ('1650', '5X Money', '1650', 1.00, 300, 300.00, 1),
  ('1602', 'Jr Jumbo', '1602', 1.00, 300, 300.00, 1),
  ('1631', 'Loteria', '1631', 2.00, 150, 300.00, 1),
  ('1644', 'Hit 100', '1644', 2.00, 150, 300.00, 1),
  ('1590', 'Cross Word', '1590', 3.00, 100, 300.00, 1),
  ('1611', 'Treasure Hunt', '1611', 3.00, 100, 300.00, 1),
  ('1688', 'Lucky 7s', '1688', 5.00, 60, 300.00, 1),
  ('1711', '50X Money', '1711', 10.00, 30, 300.00, 1),
  ('1720', 'Hit 1000', '1720', 20.00, 30, 600.00, 1),
  ('1770', '500X The Money', '1770', 50.00, 20, 1000.00, 1);

-- -------------------------------------------------------
-- 13. STORE TICKET REQUESTS (Stores Requesting Game Approval)
-- Stores request authorization to sell games from catalog
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `store_ticket_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `store_id` VARCHAR(60) NOT NULL,
  `store_name` VARCHAR(150) NOT NULL,
  `game_id` VARCHAR(50) NOT NULL,
  `game_name` VARCHAR(120) NOT NULL,
  `price` DECIMAL(6, 2) NOT NULL,
  `requested_by` VARCHAR(60) NOT NULL,
  `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'MORE_INFO_REQUIRED') DEFAULT 'PENDING',
  `admin_decision_reason` TEXT NULL,
  `reviewed_by` VARCHAR(60) NULL,
  `reviewed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_req_store` (`store_id`),
  INDEX `idx_req_status` (`status`),
  CONSTRAINT `fk_req_game` FOREIGN KEY (`game_id`) REFERENCES `lottery_ticket_catalog` (`game_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 14. STORE APPROVED TICKETS (Authorized Store-Game Relationships)
-- Which ticket types a store is authorized to sell
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `store_approved_tickets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `store_id` VARCHAR(60) NOT NULL,
  `game_id` VARCHAR(50) NOT NULL,
  `approved_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `approved_by` VARCHAR(60) NOT NULL,
  `status` ENUM('ACTIVE', 'REVOKED') DEFAULT 'ACTIVE',
  UNIQUE KEY `uk_store_game` (`store_id`, `game_id`),
  INDEX `idx_appr_store` (`store_id`),
  CONSTRAINT `fk_appr_game` FOREIGN KEY (`game_id`) REFERENCES `lottery_ticket_catalog` (`game_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed approved games for Amigo Food Mart
INSERT IGNORE INTO `store_approved_tickets` (`store_id`, `game_id`, `approved_by`, `status`)
VALUES 
  ('store_amigo', '1650', 'admin', 'ACTIVE'),
  ('store_amigo', '1602', 'admin', 'ACTIVE'),
  ('store_amigo', '1631', 'admin', 'ACTIVE'),
  ('store_amigo', '1644', 'admin', 'ACTIVE'),
  ('store_amigo', '1590', 'admin', 'ACTIVE'),
  ('store_amigo', '1611', 'admin', 'ACTIVE'),
  ('store_amigo', '1688', 'admin', 'ACTIVE'),
  ('store_amigo', '1711', 'admin', 'ACTIVE');

-- -------------------------------------------------------
-- 14b. STORE PENDING TICKETS (Automatic Barcode Detection & Two-Step Setup)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `store_pending_tickets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `store_id` VARCHAR(60) NOT NULL,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 15. TICKET STOCK ALLOCATIONS (Physical Pack Shipments to Stores)
-- Admin assigns physical packs to authorized stores
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ticket_stock_allocations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `allocation_reference` VARCHAR(60) NOT NULL,
  `store_id` VARCHAR(60) NOT NULL,
  `store_name` VARCHAR(150) NOT NULL,
  `game_id` VARCHAR(50) NOT NULL,
  `game_name` VARCHAR(120) NOT NULL,
  `pack_number` VARCHAR(50) NOT NULL,
  `pack_size` INT NOT NULL DEFAULT 100,
  `ticket_price` DECIMAL(6, 2) NOT NULL DEFAULT 1.00,
  `pack_value` DECIMAL(10, 2) NOT NULL DEFAULT 300.00,
  `total_tickets` INT NOT NULL DEFAULT 100,
  `allocated_by` VARCHAR(60) NOT NULL,
  `allocation_date` VARCHAR(30) NOT NULL,
  `status` ENUM('ALLOCATED', 'RECEIVED', 'CANCELLED') DEFAULT 'ALLOCATED',
  `received_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_store_pack` (`store_id`, `pack_number`),
  INDEX `idx_alloc_ref` (`allocation_reference`),
  INDEX `idx_alloc_store` (`store_id`),
  CONSTRAINT `fk_alloc_game` FOREIGN KEY (`game_id`) REFERENCES `lottery_ticket_catalog` (`game_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 16. ADMIN AUDIT LOGS (Security & Audit Trail)
-- Immutable record of all administrator actions
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `admin_username` VARCHAR(60) NOT NULL,
  `action_type` VARCHAR(80) NOT NULL,
  `target_entity` VARCHAR(80) NOT NULL,
  `target_id` VARCHAR(100) NOT NULL,
  `details` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_audit_admin` (`admin_username`),
  INDEX `idx_audit_action` (`action_type`),
  INDEX `idx_audit_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 17. CENTRAL WAREHOUSE INVENTORY (Enterprise Lottery Inventory)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `central_warehouse_inventory` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `pack_id` VARCHAR(60) UNIQUE NOT NULL,
  `game_id` VARCHAR(50) NOT NULL,
  `game_name` VARCHAR(120) NOT NULL,
  `pack_number` VARCHAR(50) NOT NULL,
  `barcode` VARCHAR(100) NULL,
  `ticket_price` DECIMAL(6, 2) NOT NULL DEFAULT 1.00,
  `pack_size` INT NOT NULL DEFAULT 100,
  `start_ticket` INT NOT NULL DEFAULT 0,
  `end_ticket` INT NOT NULL DEFAULT 99,
  `status` ENUM('AVAILABLE', 'RESERVED', 'DISPATCHED', 'RECEIVED_BY_STORE', 'RETURNED') DEFAULT 'AVAILABLE',
  `reserved_store_id` VARCHAR(60) NULL,
  `allocation_reference` VARCHAR(60) NULL,
  `dispatched_at` TIMESTAMP NULL,
  `received_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_cwi_game` (`game_id`),
  INDEX `idx_cwi_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 18. LOTTERY PACK INVENTORY (Store Authoritative Pack Tracking)
-- Tracks two-level inventory: Physical Pack and Individual Ticket Positions
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `lottery_pack_inventory` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `pack_id` VARCHAR(60) UNIQUE NOT NULL,
  `store_id` VARCHAR(60) NOT NULL,
  `game_id` VARCHAR(50) NOT NULL,
  `game_name` VARCHAR(120) NOT NULL,
  `pack_number` VARCHAR(50) NOT NULL,
  `barcode` VARCHAR(100) NULL,
  `ticket_price` DECIMAL(6, 2) NOT NULL DEFAULT 1.00,
  `total_tickets` INT NOT NULL DEFAULT 100,
  `start_ticket` INT NOT NULL DEFAULT 0,
  `end_ticket` INT NOT NULL DEFAULT 99,
  `next_ticket_to_sell` INT NOT NULL DEFAULT 0,
  `remaining_tickets` INT NOT NULL DEFAULT 100,
  `tickets_sold` INT NOT NULL DEFAULT 0,
  `lifecycle_status` ENUM('UNACTIVATED', 'ACTIVE', 'DEPLETED', 'DISCONTINUED', 'LOST', 'DAMAGED') DEFAULT 'UNACTIVATED',
  `physical_location` ENUM('CENTRAL_WAREHOUSE', 'IN_TRANSIT', 'STORE', 'RETURNED') DEFAULT 'STORE',
  `box_number` INT NULL,
  `activated_at` TIMESTAMP NULL,
  `activated_by` VARCHAR(60) NULL,
  `completed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_physical_game_pack` (`game_id`, `pack_number`),
  INDEX `idx_lpi_store` (`store_id`),
  INDEX `idx_lpi_status` (`lifecycle_status`),
  INDEX `idx_lpi_game` (`game_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 19. INVENTORY TRANSACTIONS (Append-Only Immutable Ledger)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transaction_id` VARCHAR(60) UNIQUE NOT NULL,
  `pack_id` VARCHAR(60) NOT NULL,
  `game_id` VARCHAR(50) NOT NULL,
  `store_id` VARCHAR(60) NULL,
  `previous_status` VARCHAR(40) NULL,
  `new_status` VARCHAR(40) NOT NULL,
  `previous_location` VARCHAR(40) NULL,
  `new_location` VARCHAR(40) NOT NULL,
  `previous_position` INT NULL,
  `new_position` INT NULL,
  `quantity_before` INT NOT NULL DEFAULT 0,
  `quantity_changed` INT NOT NULL DEFAULT 0,
  `quantity_after` INT NOT NULL DEFAULT 0,
  `transaction_type` VARCHAR(50) NOT NULL,
  `source_ref_id` VARCHAR(80) NULL,
  `user_id` VARCHAR(60) DEFAULT 'system',
  `reason` TEXT NULL,
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_tx_pack` (`pack_id`),
  INDEX `idx_tx_store` (`store_id`),
  INDEX `idx_tx_type` (`transaction_type`),
  INDEX `idx_tx_ref` (`source_ref_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 20. INVENTORY DISCREPANCIES (Reconciliation Flags & Audits)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_discrepancies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `discrepancy_id` VARCHAR(60) UNIQUE NOT NULL,
  `pack_id` VARCHAR(60) NOT NULL,
  `store_id` VARCHAR(60) NOT NULL,
  `shift_id` VARCHAR(60) NULL,
  `expected_position` INT NOT NULL,
  `scanned_position` INT NULL,
  `difference` INT NOT NULL DEFAULT 0,
  `discrepancy_type` VARCHAR(60) NOT NULL,
  `reason` TEXT NULL,
  `status` ENUM('OPEN', 'RESOLVED', 'REJECTED') DEFAULT 'OPEN',
  `resolved_by` VARCHAR(60) NULL,
  `resolved_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_disc_store` (`store_id`),
  INDEX `idx_disc_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 21. STORE TRANSFERS (Store-to-Store Stock Transfers)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `store_transfers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transfer_id` VARCHAR(60) UNIQUE NOT NULL,
  `pack_id` VARCHAR(60) NOT NULL,
  `from_store_id` VARCHAR(60) NOT NULL,
  `to_store_id` VARCHAR(60) NOT NULL,
  `status` ENUM('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING',
  `requested_by` VARCHAR(60) NOT NULL,
  `authorized_by` VARCHAR(60) NULL,
  `received_by` VARCHAR(60) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `received_at` TIMESTAMP NULL,
  INDEX `idx_txf_from` (`from_store_id`),
  INDEX `idx_txf_to` (`to_store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 22. STORE FEEDBACK (Issue Reports, Bug Reports & Operational Feedback)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `store_feedback` (
  `id` VARCHAR(60) PRIMARY KEY,
  `store_id` VARCHAR(60) NOT NULL,
  `store_name` VARCHAR(120) NOT NULL,
  `user_id` VARCHAR(60) NULL,
  `cashier_name` VARCHAR(120) NULL,
  `category` VARCHAR(60) NOT NULL,
  `severity` VARCHAR(30) NOT NULL DEFAULT 'MEDIUM',
  `subject` VARCHAR(255) NULL,
  `message` TEXT NOT NULL,
  `system_context` JSON NULL,
  `status` ENUM('PENDING', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED') DEFAULT 'PENDING',
  `admin_notes` TEXT NULL,
  `reviewed_by` VARCHAR(60) NULL,
  `reviewed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_feedback_store` (`store_id`),
  INDEX `idx_feedback_status` (`status`),
  INDEX `idx_feedback_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 23. SUBSCRIPTION PAYMENT TRANSACTIONS (Idempotent Gateway Ledger)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payment_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `payment_ref` VARCHAR(140) UNIQUE NOT NULL,
  `provider` VARCHAR(40) NOT NULL,
  `provider_event_id` VARCHAR(140) NULL,
  `store_id` VARCHAR(60) NULL,
  `plan_id` VARCHAR(40) NOT NULL,
  `billing_cycle` VARCHAR(20) NOT NULL DEFAULT 'monthly',
  `amount_cents` INT NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'usd',
  `payment_status` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  `consumed` TINYINT(1) NOT NULL DEFAULT 0,
  `consumed_at` VARCHAR(40) NULL,
  `raw_payload` LONGTEXT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_pay_store` (`store_id`),
  INDEX `idx_pay_status` (`payment_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -------------------------------------------------------
-- 24. PLATFORM COMPLIANCE AUDIT LOGS
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_audit_logs` (
  `id` VARCHAR(80) PRIMARY KEY,
  `admin_username` VARCHAR(80) NOT NULL,
  `actor_role` VARCHAR(40) NOT NULL DEFAULT 'ADMIN',
  `action_type` VARCHAR(80) NOT NULL,
  `target_entity` VARCHAR(60) NOT NULL,
  `target_id` VARCHAR(80) NOT NULL,
  `store_id` VARCHAR(60) NULL,
  `details_json` TEXT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  INDEX `idx_audit_store` (`store_id`),
  INDEX `idx_audit_action` (`action_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;




