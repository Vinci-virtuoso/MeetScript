-- @whlong/eventbase 0.15.0 migrations/0006_geo_city.sql, copied verbatim (loginbase 3.x writes its login statistics here through stats.db).
-- 城市，取自 request.cf，是出口 IP 归属而非用户位置。
--
-- 本迁移非幂等：SQLite 的 ALTER TABLE ADD COLUMN 没有 IF NOT EXISTS。
-- 若报 duplicate column name，说明该列已存在、本迁移实际已生效，
-- 在 d1_migrations 补一条本文件的记录即可。region 由 0007 单独负责，与本文件无关。
ALTER TABLE events ADD COLUMN city TEXT;
