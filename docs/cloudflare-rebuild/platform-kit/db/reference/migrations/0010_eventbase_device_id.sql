-- @whlong/eventbase 0.15.0 migrations/0005_device_id.sql, copied verbatim (loginbase 3.x writes its login statistics here through stats.db).
-- 设备级标识。服务端不采集也不推导，只落客户端显式带上的值（契约见 docs/protocol.md）。
ALTER TABLE events ADD COLUMN device_id TEXT;
