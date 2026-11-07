// 生成首页 mock 数据（确定性随机，seed 固定）。仅用于设计稿，口径见 设计方案.md。
const SEED = 20261107;
let s = SEED;
const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const jitter = (v, p) => Math.round(v * (1 + (rnd() * 2 - 1) * p));

const TODAY = new Date('2026-11-07T10:24:00+08:00');
const DAY = 86400000;
const fmt = d => d.toISOString().slice(5, 10).replace('-', '/');
const isWeekend = d => [0, 6].includes(d.getDay());

// 1) 近 30 天：新增笔记 + 编辑次数
const trend30 = [];
for (let i = 29; i >= 0; i--) {
  const d = new Date(TODAY.getTime() - i * DAY);
  const growth = 1 + (29 - i) * 0.018;          // 缓慢增长
  const weekend = isWeekend(d) ? 0.52 : 1;
  const created = Math.max(6, jitter(52 * growth * weekend, 0.16));
  const edited = Math.max(120, jitter(1180 * growth * weekend, 0.13));
  trend30.push({ date: fmt(d), created, edited });
}
// 今日（部分数据，未过完）
const last = trend30[trend30.length - 1];
last.created = 86; last.edited = 1842; last.partial = true;

// 2) 目录 Top（笔记数）
const dirTop = [
  { name: '产品设计', notes: 1862, active7d: 214 },
  { name: '技术文档', notes: 1488, active7d: 176 },
  { name: '会议纪要', notes: 1204, active7d: 98 },
  { name: '运营素材', notes: 986, active7d: 132 },
  { name: '客户跟进', notes: 742, active7d: 61 },
  { name: '读书笔记', notes: 618, active7d: 44 },
  { name: '知识库', notes: 524, active7d: 73 },
  { name: '归档', notes: 402, active7d: 9 },
  { name: '其他目录', notes: 4660, active7d: 287 }
];

// 3) 7×24 编辑活跃热力（周一..周日 × 0..23）
const heat = [];
for (let wd = 0; wd < 7; wd++) {
  const row = [];
  const weekend = wd >= 5 ? 0.42 : 1;
  for (let h = 0; h < 24; h++) {
    const morning = Math.exp(-((h - 10.5) ** 2) / 8);
    const afternoon = Math.exp(-((h - 16) ** 2) / 10);
    const evening = Math.exp(-((h - 21.5) ** 2) / 6) * 0.85;
    const night = h < 6 ? 0.06 : 0;
    const base = (morning * 1 + afternoon * 0.92 + evening + night) * 100 * weekend;
    row.push(Math.max(1, Math.round(base + rnd() * 8)));
  }
  heat.push(row);
}

// 4) 设备构成（近 7 天登录）
const device = [
  { name: 'PC 客户端', value: 1486 },
  { name: 'App 客户端', value: 698 }
];

// 5) 存储构成（basics_file，按类型）
const storage = [
  { name: '图片', size: 9.8, count: 1986 },
  { name: '文档', size: 5.4, count: 742 },
  { name: '压缩包', size: 2.6, count: 188 },
  { name: '其他', size: 0.8, count: 696 }
];

// 6) 近 12 周累计用户
const userGrowth = [];
let cum = 987;
for (let i = 11; i >= 0; i--) {
  const add = jitter(18 + (11 - i) * 1.4, 0.3);
  cum += add;
  const d = new Date(TODAY.getTime() - i * 7 * DAY);
  userGrowth.push({ week: fmt(d), total: cum, added: add });
}

// 7) 近 7 天操作类型
const operTypes = [
  { name: '新增', value: 3286 },
  { name: '修改', value: 7412 },
  { name: '删除', value: 412 },
  { name: '导出', value: 268 },
  { name: '登录', value: 1834 }
];

// 8) 最近笔记
const recentNotes = [
  { name: 'Q4 产品路线图评审纪要', dir: '产品设计', author: '林知远', words: 2480, updated: '2 分钟前' },
  { name: '笔记同步冲突处理方案', dir: '技术文档', author: '沈亦清', words: 5120, updated: '18 分钟前' },
  { name: '客户端 3.2 灰度观察', dir: '产品设计', author: '周砚', words: 1260, updated: '41 分钟前' },
  { name: '11 月内容运营排期', dir: '运营素材', author: '苏晚照', words: 890, updated: '1 小时前' },
  { name: '编辑器快捷键调研', dir: '技术文档', author: '陈默', words: 3140, updated: '2 小时前' },
  { name: '客户 A 需求变更记录', dir: '客户跟进', author: '顾南枝', words: 640, updated: '3 小时前' }
];

// 9) 实时事件流
const events = [
  { t: '10:24', type: 'create', who: '林知远', text: '新建笔记《Q4 产品路线图评审纪要》', dir: '产品设计' },
  { t: '10:21', type: 'edit', who: '沈亦清', text: '更新《笔记同步冲突处理方案》', dir: '技术文档' },
  { t: '10:18', type: 'login', who: '周砚', text: 'App 客户端登录（上海）', dir: '' },
  { t: '10:12', type: 'create', who: '苏晚照', text: '新建目录《11 月活动素材》', dir: '运营素材' },
  { t: '10:06', type: 'edit', who: '陈默', text: '更新《编辑器快捷键调研》', dir: '技术文档' },
  { t: '09:58', type: 'warn', who: '系统', text: '对象存储同步延迟 2.4s', dir: '' },
  { t: '09:51', type: 'create', who: '顾南枝', text: '新建笔记《客户 A 需求变更记录》', dir: '客户跟进' },
  { t: '09:44', type: 'login', who: '白露', text: 'PC 客户端登录（杭州）', dir: '' }
];

// 10) 24 小时请求量 / 错误数
const hourly = [];
for (let h = 0; h < 24; h++) {
  const f = Math.exp(-((h - 15) ** 2) / 26) * 0.9 + Math.exp(-((h - 10) ** 2) / 14) * 0.6 + 0.12;
  hourly.push({ hour: h, req: Math.round(4200 * f + rnd() * 260), err: Math.round(6 * f + rnd() * 3) });
}

const out = {
  meta: { product: 'V5Notes2', generatedAt: '2026-11-07T10:24:00+08:00', note: '设计稿模拟数据，口径见 设计方案.md' },
  kpi: {
    notes: 12486, notesDelta7d: 412, notesDeltaPct: 3.4,
    dirs: 328, emptyDirs: 12,
    notesToday: 86, editsToday: 1842,
    users: 1284, usersNewWeek: 26, activeUsers7d: 486, online: 42, loginsToday: 312,
    files: 3612, storageGB: 18.6, avgFileMB: 5.3,
    successRate: 99.97, p95ms: 86, cacheHit: 96.4, operlogToday: 2418
  },
  trend30, dirTop, heat, device, storage, userGrowth, operTypes, recentNotes, events, hourly
};
require('fs').writeFileSync('/Users/jingyuan-mb01/javaspace/ruoyi/v5notes/v5notes-admin2/design-demos/home/data/mock-data.json', JSON.stringify(out, null, 2));
console.log('kpi', JSON.stringify(out.kpi));
console.log('trend30 first/last', trend30[0], trend30[29]);
console.log('sum30 created', trend30.reduce((a, b) => a + b.created, 0), 'edited', trend30.reduce((a, b) => a + b.edited, 0));
console.log('userGrowth last', userGrowth[11]);
console.log('heat sample wd3', heat[2].join(','));
