-- V19：把“设备”拆成两件事（设计 §8.2）
--   vault_device → vault_replica：replica_id 标识库目录副本（vault.json 中永不
--   同步的 binding.replicaId），device_id 标识真正发起同步的机器（客户端生成）。
--   旧 device_id 的值就是旧语义的副本 ID，直接改名为 replica_id；device_id 先以
--   同一值回填，客户端下次 bind 时会刷新为真实设备 ID。

ALTER TABLE vault_device RENAME TO vault_replica;
ALTER TABLE vault_replica RENAME COLUMN device_id TO replica_id;
ALTER TABLE vault_replica ADD COLUMN device_id varchar(64);
UPDATE vault_replica SET device_id = replica_id;
ALTER TABLE vault_replica ALTER COLUMN device_id SET NOT NULL;

ALTER TABLE vault_replica DROP CONSTRAINT uk_vault_device;
ALTER TABLE vault_replica ADD CONSTRAINT uk_vault_replica UNIQUE (vault_id, replica_id);
CREATE INDEX IF NOT EXISTS idx_vault_replica_device ON vault_replica (device_id);

ALTER INDEX IF EXISTS idx_vault_device_user RENAME TO idx_vault_replica_user;
COMMENT ON TABLE vault_replica IS 'Vault 副本绑定';
COMMENT ON COLUMN vault_replica.replica_id IS '客户端副本 ID（vault.json binding.replicaId）';
COMMENT ON COLUMN vault_replica.device_id IS '客户端设备 ID（重装保留数据不变）';
