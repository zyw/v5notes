-- 允许同库内多条文件路径引用同一内容哈希的附件对象（修复 V20 uk_vault_asset_ref_hash 阻断去重引用）
ALTER TABLE vault_asset_ref
    DROP INDEX uk_vault_asset_ref_hash,
    ADD INDEX idx_vault_asset_ref_hash (vault_id, sha256);
