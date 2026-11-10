/**
 * 首页工作台聚合数据 · 契约见 design-demos/home/data/api-contract.md
 * 与后端 DashboardOverviewVo 一一对应。
 */

export interface DashboardKpi {
  /** 笔记总数 */
  notes: number;
  /** 近 7 天新增笔记 */
  notesDelta7d: number;
  /** 近 7 天新增占比（%） */
  notesDeltaPct: number;
  /** 目录总数 */
  dirs: number;
  /** 空目录数 */
  emptyDirs: number;
  /** 今日新增笔记 */
  notesToday: number;
  /** 今日编辑次数 */
  editsToday: number;
  /** 用户总数 */
  users: number;
  /** 近 7 天新增用户 */
  usersNewWeek: number;
  /** 近 7 天活跃用户 */
  activeUsers7d: number;
  /** 当前在线 */
  online: number;
  /** 今日登录次数 */
  loginsToday: number;
  /** 文件数 */
  files: number;
  /** 存储容量（GB） */
  storageGB: number;
  /** 平均单文件大小（MB） */
  avgFileMB: number;
  /** 24h 接口成功率（%） */
  successRate: number;
  /** 24h P95 响应（ms） */
  p95ms: number;
  /** 缓存命中率（%）；null = 暂无缓存读写数据或采集失败 */
  cacheHit: number | null;
  /** 今日操作日志条数 */
  operlogToday: number;
}

export interface DashboardTrendPoint {
  /** MM/dd */
  date: string;
  /** 当日新增笔记 */
  created: number;
  /** 当日编辑次数 */
  edited: number;
}

export interface DashboardDirItem {
  name: string;
  notes: number;
  active7d: number;
}

export interface DashboardNameValue {
  name: string;
  value: number;
}

export interface DashboardStorageItem {
  name: string;
  /** GB */
  size: number;
  count: number;
}

export interface DashboardRecentNote {
  /** 雪花 ID，保持字符串 */
  id: string;
  name: string;
  dirName: string;
  authorName: string;
  chars: number;
  /** ISO-8601 */
  updatedAt: string;
}

export interface DashboardSystem {
  successRate: number;
  p95ms: number;
  /** 缓存命中率（%）；null = 暂无缓存读写数据 */
  cacheHit: number | null;
  online: number;
  operlogToday: number;
}

export interface DashboardOverview {
  range: number;
  /** ISO-8601 */
  generatedAt: string;
  kpi: DashboardKpi;
  trend: DashboardTrendPoint[];
  dirTop: DashboardDirItem[];
  device: DashboardNameValue[];
  storage: DashboardStorageItem[];
  recentNotes: DashboardRecentNote[];
  system: DashboardSystem;
}
