-- ============================================================================
-- Migration: 002 - 种子数据
-- 日期: 2026-07-04
-- 说明: 6 个默认便签 + 演示用户 (密码: 123456, bcrypt 加密)
-- 运行: mysql -u root -p < seed_default_notes_and_user.sql
-- ============================================================================

USE `time_block`;

-- >>> UP <<<

-- 1. 演示用户 (密码: 123456, bcrypt hash)
INSERT INTO `users` (`email`, `password`, `name`) VALUES
  ('demo@timeblock.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Demo用户')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 2. 默认便签 (绑定 user_id = 1)
INSERT INTO `notes` (`user_id`, `name`, `color`) VALUES
  (1, '工作', '#409eff'),
  (1, '学习', '#67c23a'),
  (1, '休息', '#e6a23c'),
  (1, '运动', '#f56c6c'),
  (1, '生活', '#9254de'),
  (1, '其他', '#909399');

-- >>> DOWN (回滚) <<<
-- DELETE FROM `notes` WHERE user_id = 1 AND name IN ('工作','学习','休息','运动','生活','其他');
-- DELETE FROM `users` WHERE email = 'demo@timeblock.com';
