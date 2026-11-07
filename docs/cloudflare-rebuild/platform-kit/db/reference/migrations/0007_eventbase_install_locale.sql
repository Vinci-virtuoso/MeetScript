-- @whlong/eventbase 0.15.0 migrations/0002_install_locale.sql, copied verbatim (loginbase 3.x writes its login statistics here through stats.db).
-- 首见时冻结 locale：locale 会变，但安装归因要的正是首见值。
ALTER TABLE install_first_seen ADD COLUMN sys_locale TEXT;
