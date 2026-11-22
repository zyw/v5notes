-- V19：把“设备”拆成两件事（设计 §8.2）
--   vault_device 表名与 device_id 列其实描述的是“一份库目录副本”的绑定关系：
--   replica_id 标识副本（vault.json 中的 binding.replicaId，永不同步），
--   device_id 标识真正发起同步的机器（客户端生成的设备标识，重装保留数据不变）。
--   旧 vault_device.device_id 的值就是旧语义的副本 ID，直接改名为 replica_id；
--   device_id 先以同一值回填，客户端下次 bind 时刷新为真实设备 ID。

RENAME TABLE vault_device TO vault_replica;

ALTER TABLE vault_replica
    CHANGE COLUMN device_id replica_id varchar(64) NOT NULL COMMENT '客户端副本 ID（vault.json binding.replicaId）',
    ADD COLUMN device_id varchar(64) NOT NULL DEFAULT '' COMMENT '客户端设备 ID（重装保留数据不变）' AFTER replica_id,
    DROP INDEX uk_vault_device,
    ADD UNIQUE KEY uk_vault_replica (vault_id, replica_id),
    ADD KEY idx_vault_replica_device (device_id),
    COMMENT = 'Vault 副本绑定';

UPDATE vault_replica SET device_id = replica_id WHERE device_id = '';

ALTER TABLE vault_replica
    ALTER COLUMN device_id DROP DEFAULT;
