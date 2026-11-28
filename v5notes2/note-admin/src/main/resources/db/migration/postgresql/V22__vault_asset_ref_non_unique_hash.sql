-- 允许同库内多条文件路径引用同一内容哈希的附件对象（修复 V20 uk_vault_asset_ref_hash 阻断去重引用）
DROP INDEX IF EXISTS uk_vault_asset_ref_hash;
CREATE INDEX IF NOT EXISTS idx_vault_asset_ref_hash ON vault_asset_ref (vault_id, sha256);
