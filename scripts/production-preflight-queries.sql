-- ==============================================================================
-- Jackpotlo Production Preflight Inspection Queries (Strictly Read-Only)
-- Purpose: Safely inspect production schema and records prior to migration
-- Target Database: jackpotlo (Production)
-- INSTRUCTION: Execute ONLY with explicit operator authorization.
-- ==============================================================================

-- 1. Inspect Existing `stores` Table Columns, Data Types, and Column Defaults
SELECT 
  COLUMN_NAME, 
  COLUMN_TYPE, 
  IS_NULLABLE, 
  COLUMN_DEFAULT, 
  EXTRA, 
  COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stores'
ORDER BY ORDINAL_POSITION;

-- 2. Inspect Existing Store Authorization Status Column Definition Specifically
SELECT 
  COLUMN_NAME, 
  COLUMN_TYPE, 
  COLUMN_DEFAULT, 
  IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'stores' 
  AND COLUMN_NAME = 'authorization_status';

-- 3. Inspect All Existing Store Records and Their Current Statuses
-- (Verifies Amigo Food Mart and other stores retain their active/approved status)
SELECT 
  store_id, 
  store_name, 
  owner_username, 
  retailer_number, 
  operational_status, 
  authorization_status, 
  created_at
FROM stores;

-- 4. Check for Existence of `store_users` Table or Conflicting Tables
SELECT 
  TABLE_NAME, 
  TABLE_TYPE, 
  ENGINE, 
  TABLE_ROWS, 
  CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME IN ('store_users', 'store_feedback', 'users', 'admin_users');

-- 5. If `store_users` Pre-Exists, Inspect Its Current Columns and Column Defaults
SELECT 
  COLUMN_NAME, 
  COLUMN_TYPE, 
  IS_NULLABLE, 
  COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_users'
ORDER BY ORDINAL_POSITION;

-- 6. Inspect Existing Indexes on `stores` and `store_users`
SELECT 
  TABLE_NAME, 
  INDEX_NAME, 
  NON_UNIQUE, 
  COLUMN_NAME, 
  SEQ_IN_INDEX
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME IN ('stores', 'store_users')
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- 7. Inspect Existing Foreign Key Constraints on `store_users`
SELECT 
  TABLE_NAME, 
  CONSTRAINT_NAME, 
  COLUMN_NAME, 
  REFERENCED_TABLE_NAME, 
  REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'store_users' 
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- 8. Inspect Referential Delete and Update Rules on `store_users` (Check for RESTRICT vs CASCADE)
SELECT 
  CONSTRAINT_NAME, 
  TABLE_NAME, 
  REFERENCED_TABLE_NAME, 
  UPDATE_RULE, 
  DELETE_RULE
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'store_users';

-- 9. Inspect `admin_users` Table Structure
SELECT 
  COLUMN_NAME, 
  COLUMN_TYPE, 
  IS_NULLABLE, 
  COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admin_users'
ORDER BY ORDINAL_POSITION;

-- 10. Inspect Existing `adm_001` Record (Preserves Password Hash Privacy)
-- Displays metadata, hash format type, and email without printing raw hash
SELECT 
  id, 
  username, 
  full_name, 
  email, 
  role, 
  is_active,
  CASE 
    WHEN password_hash LIKE 'pbkdf2$%' THEN 'PBKDF2-HMAC-SHA256 (Secure)'
    WHEN LENGTH(password_hash) = 64 THEN 'SHA-256'
    ELSE 'Legacy Format'
  END AS password_security_status,
  created_at
FROM admin_users
WHERE id = 'adm_001' OR username = 'admin';

