-- 仅首次初始化数据目录时执行：先建 RuoYi 6.1.0 基础库，再建 v5notes 业务表/菜单
USE v5notes2;
SET NAMES utf8mb4;
source /mnt/sql/ry_vue.sql
source /mnt/sql/notes2.sql
