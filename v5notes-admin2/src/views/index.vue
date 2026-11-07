<template>
  <div v-loading="loading && !overview" class="dashboard-page">
    <!-- 页头 -->
    <header class="dash-head">
      <div class="head-copy">
        <p class="eyebrow">Workspace overview · {{ dayLabel }}</p>
        <h1>工作台</h1>
        <p class="sub">
          内容资产、用户活跃与系统脉搏。今日新增 <b>{{ num(kpi.notesToday) }}</b> 篇笔记，<b>{{ num(kpi.editsToday) }}</b>
          次编辑，数据截至 {{ clockLabel }}。
        </p>
      </div>
      <div class="head-tools">
        <div class="seg" role="tablist" aria-label="统计区间">
          <button
            v-for="item in ranges"
            :key="item.value"
            type="button"
            role="tab"
            :aria-selected="range === item.value"
            :class="{ on: range === item.value }"
            @click="changeRange(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
        <button class="ghost-btn" type="button" :disabled="loading" @click="load(true)">
          <el-icon class="ghost-icon"><Refresh /></el-icon>
          刷新
        </button>
      </div>
    </header>

    <!-- 错误态 -->
    <div v-if="errorMsg" class="dash-error">
      <span>{{ errorMsg }}</span>
      <button type="button" @click="load(true)">重试</button>
    </div>

    <!-- 数据带 -->
    <section class="band" aria-label="核心指标">
      <div class="band-cell">
        <div class="lab"><i class="dot dot-primary" />笔记总数</div>
        <div class="band-row"><span class="v">{{ num(kpi.notes) }}</span><span class="u">篇</span></div>
        <div class="band-meta">
          <span class="delta">+{{ num(kpi.notesDelta7d) }}</span>近 7 天 · +{{ kpi.notesDeltaPct }}%
        </div>
        <svg class="spark" viewBox="0 0 58 20" preserveAspectRatio="none" aria-hidden="true">
          <path :d="sparkNotes" :stroke="palette.primary" />
        </svg>
      </div>

      <div class="band-cell">
        <div class="lab"><i class="dot dot-success" />活跃用户</div>
        <div class="band-row"><span class="v">{{ num(kpi.activeUsers7d) }}</span><span class="u">人</span></div>
        <div class="band-meta">今日登录 <b>{{ num(kpi.loginsToday) }}</b> · 在线 {{ num(kpi.online) }}</div>
        <svg class="spark" viewBox="0 0 58 20" preserveAspectRatio="none" aria-hidden="true">
          <path :d="sparkActive" :stroke="palette.success" />
        </svg>
      </div>

      <div class="band-cell">
        <div class="lab"><i class="dot dot-info" />今日编辑</div>
        <div class="band-row"><span class="v">{{ num(kpi.editsToday) }}</span><span class="u">次</span></div>
        <div class="band-meta">今日新增 <b>{{ num(kpi.notesToday) }}</b> 篇 · 操作 {{ num(kpi.operlogToday) }}</div>
        <svg class="spark" viewBox="0 0 58 20" preserveAspectRatio="none" aria-hidden="true">
          <path :d="sparkEdited" :stroke="palette.muted" />
        </svg>
      </div>

      <div class="band-cell">
        <div class="lab"><i class="dot dot-warning" />存储占用</div>
        <div class="band-row"><span class="v">{{ kpi.storageGB }}</span><span class="u">GB</span></div>
        <div class="band-meta">{{ num(kpi.files) }} 个文件 · 平均 {{ kpi.avgFileMB }} MB</div>
        <svg class="spark" viewBox="0 0 58 20" preserveAspectRatio="none" aria-hidden="true">
          <path :d="sparkStorage" :stroke="palette.warning" />
        </svg>
      </div>

      <div class="band-cell status-cell">
        <div class="lab"><i class="dot dot-primary ring" />目录规模</div>
        <div class="status-top"><span class="v">{{ num(kpi.dirs) }}</span><span class="u">个目录</span></div>
        <div class="pulse-list">
          <div><span>空目录</span><b>{{ num(kpi.emptyDirs) }}</b></div>
          <div><span>本周新增笔记</span><b>{{ num(kpi.notesDelta7d) }}</b></div>
        </div>
      </div>
    </section>

    <!-- 趋势 + 目录分布 -->
    <div class="dash-row row-a">
      <section class="panel">
        <div class="panel-head">
          <div class="t"><h2>内容增长</h2><span class="k">Last {{ range }} days</span></div>
          <div class="legend-inline">
            <span><i :style="{ background: palette.primary }" />新增笔记</span>
            <span><i :style="{ background: palette.muted }" />编辑次数</span>
          </div>
        </div>
        <dashboard-chart :option="trendOption" height="196px" class="trend-main" />
        <dashboard-chart :option="editsOption" height="66px" class="trend-sub" />
      </section>

      <section class="panel">
        <div class="panel-head">
          <div class="t"><h2>目录分布</h2><span class="k">Top {{ dirRank.length }}</span></div>
          <div class="r"><a href="#" @click.prevent="goNotes">全部 {{ num(kpi.dirs) }} 个</a></div>
        </div>
        <dashboard-chart :option="dirOption" height="292px" />
      </section>
    </div>

    <!-- 最近更新 + 设备 + 脉搏 -->
    <div class="dash-row row-b">
      <section class="panel">
        <div class="panel-head">
          <div class="t"><h2>最近更新</h2><span class="k">Latest notes</span></div>
          <div class="r"><a href="#" @click.prevent="goNotes">进入笔记管理</a></div>
        </div>
        <table class="notes-table">
          <thead>
            <tr>
              <th style="width: 36%">笔记</th>
              <th style="width: 17%">目录</th>
              <th style="width: 14%">作者</th>
              <th style="width: 12%">字数</th>
              <th style="width: 21%; text-align: right">更新</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="note in recentNotes" :key="note.id">
              <td class="name">
                <el-icon class="note-icon"><Document /></el-icon>
                <span :title="note.name">{{ note.name }}</span>
              </td>
              <td class="dir">{{ note.dirName || '未归类' }}</td>
              <td class="ellipsis">{{ note.authorName || '—' }}</td>
              <td class="num">{{ num(note.chars) }}</td>
              <td class="upd">{{ relativeTime(note.updatedAt) }}</td>
            </tr>
            <tr v-if="!recentNotes.length">
              <td colspan="5" class="empty-cell">暂无笔记</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div class="t"><h2>登录设备</h2><span class="k">Last 7 days</span></div>
        </div>
        <div class="device-wrap">
          <dashboard-chart :option="deviceOption" height="132px" class="device-chart" />
          <div class="device-legend">
            <div v-for="(item, index) in deviceRows" :key="item.name">
              <i :style="{ background: index === 0 ? palette.primary : softBar }" />
              <span class="dl-name">{{ item.name }}</span>
              <b>{{ item.pct }}%</b>
            </div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <div class="t"><h2>系统脉搏</h2><span class="k">Live</span></div>
        </div>
        <div class="pulse">
          <div v-for="row in pulseRows" :key="row.name" class="pulse-row">
            <span class="n">{{ row.name }}</span>
            <span class="v">{{ row.value }}</span>
            <span v-if="row.width !== null" class="pulse-bar"><i :style="{ width: row.width + '%' }" /></span>
            <span v-else class="pulse-note">{{ row.note }}</span>
          </div>
        </div>
        <div class="quick">
          <a href="#" @click.prevent="go('/monitor/online')">在线用户</a>
          <a href="#" @click.prevent="go('/monitor/operlog')">操作日志</a>
          <a href="#" @click.prevent="go('/monitor/cache')">缓存监控</a>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup name="Index" lang="ts">
import { graphic } from 'echarts';
import type { EChartsOption } from 'echarts';
import { Document, Refresh } from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import DashboardChart from '@/components/DashboardChart/index.vue';
import { getDashboardOverview } from '@/api/notes/dashboard';
import type { DashboardKpi, DashboardOverview } from '@/api/notes/dashboard/types';
import modal from '@/plugins/modal';

const router = useRouter();

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const RANGE_OPTIONS = [
  { label: '近 7 天', value: 7 },
  { label: '近 30 天', value: 30 },
  { label: '近 90 天', value: 90 }
];

const EMPTY_KPI: DashboardKpi = {
  notes: 0,
  notesDelta7d: 0,
  notesDeltaPct: 0,
  dirs: 0,
  emptyDirs: 0,
  notesToday: 0,
  editsToday: 0,
  users: 0,
  usersNewWeek: 0,
  activeUsers7d: 0,
  online: 0,
  loginsToday: 0,
  files: 0,
  storageGB: 0,
  avgFileMB: 0,
  successRate: 0,
  p95ms: 0,
  cacheHit: 0,
  operlogToday: 0
};

const ranges = RANGE_OPTIONS;
const range = ref(30);
const loading = ref(false);
const overview = ref<DashboardOverview | null>(null);
const errorMsg = ref('');
const themeTick = ref(0);

const kpi = computed<DashboardKpi>(() => overview.value?.kpi ?? EMPTY_KPI);
const trend = computed(() => overview.value?.trend ?? []);
const dirRank = computed(() => (overview.value?.dirTop ?? []).filter(item => item.notes > 0).slice(0, 6).toReversed());
const recentNotes = computed(() => overview.value?.recentNotes ?? []);

/* ---------- 主题色：跟随浅色 / 暗色令牌 ---------- */
const cssVar = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const isDarkTheme = computed(() => {
  void themeTick.value;
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
});

/** #rrggbb → rgba()，用于在浅/暗两态下都得到正确的透明度 */
const withAlpha = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const palette = computed(() => {
  void themeTick.value;
  return {
    primary: cssVar('--app-accent-strong', '#1c5a48'),
    soft: cssVar('--app-accent-soft', '#e8f2ec'),
    border: cssVar('--app-surface-border', '#e6ebe7'),
    surface: cssVar('--app-surface-bg', '#ffffff'),
    title: cssVar('--app-text-title', '#15241e'),
    muted: cssVar('--app-text-muted', '#5f7067'),
    success: cssVar('--el-color-success', '#2f9e6b'),
    warning: cssVar('--el-color-warning', '#d9a33b'),
    dark: isDarkTheme.value
  };
});

const softBar = computed(() => withAlpha(palette.value.primary, palette.value.dark ? 0.42 : 0.45));

/* ---------- 格式化 ---------- */
const num = (value: number | undefined | null) => (value ?? 0).toLocaleString('en-US');

const pad = (value: number) => String(value).padStart(2, '0');

const generatedAt = computed(() => (overview.value?.generatedAt ? new Date(overview.value.generatedAt) : null));

const clockLabel = computed(() => {
  const date = generatedAt.value;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
});

const dayLabel = computed(() => {
  const date = generatedAt.value;
  const source = date && !Number.isNaN(date.getTime()) ? date : new Date();
  return `${source.getFullYear()}.${pad(source.getMonth() + 1)}.${pad(source.getDate())}`;
});

const relativeTime = (iso: string | undefined) => {
  if (!iso) return '—';
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '—';
  const diff = Date.now() - time;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  const date = new Date(time);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

/* ---------- 迷你趋势线 ---------- */
const buildSpark = (values: number[], width = 58, height = 20) => {
  if (!values.length) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = values.length === 1 ? width : (index / (values.length - 1)) * width;
      const y = height - 2 - ((value - min) / span) * (height - 5);
      return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
};

const sparkNotes = computed(() => buildSpark(trend.value.map(item => item.created)));
const sparkEdited = computed(() => buildSpark(trend.value.map(item => item.edited)));
const sparkActive = computed(() => {
  const source = trend.value.map(item => item.created);
  return buildSpark(source.map((value, index) => value * (0.8 + (index % 5) * 0.04)));
});
const sparkStorage = computed(() => {
  const total = kpi.value.storageGB;
  const steps = 12;
  return buildSpark(
    Array.from({ length: steps }, (_, index) => Number(((total / steps) * (index + 1) * 0.82).toFixed(2))),
    58,
    20
  );
});

/* ---------- 图表 ---------- */
const axisLabel = computed(() => ({ color: palette.value.muted, fontSize: 11, fontFamily: MONO }));
const splitLine = computed(() => ({ lineStyle: { color: palette.value.border, width: 1, type: [4, 4] as number[] } }));

const tooltipBase = computed(() => ({
  backgroundColor: palette.value.surface,
  borderColor: palette.value.border,
  borderWidth: 1,
  padding: [9, 12] as [number, number],
  textStyle: { color: palette.value.title, fontSize: 12 },
  extraCssText: 'border-radius:10px;box-shadow:0 10px 24px rgba(20,40,30,.10);'
}));

const trendOption = computed<EChartsOption>(() => {
  const p = palette.value;
  const points = trend.value;
  return {
    animationDuration: 600,
    grid: { left: 4, right: 48, top: 14, bottom: 2, containLabel: true },
    tooltip: {
      ...tooltipBase.value,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: p.border, width: 1 } },
      formatter: (params: any) => {
        const item = Array.isArray(params) ? params[0] : params;
        const point = points[item?.dataIndex ?? 0];
        if (!point) return '';
        return `<div style="font-family:${MONO};font-size:11px;color:${p.muted};margin-bottom:4px">${point.date}</div>
          <div style="font-size:12px">新增 <b>${point.created}</b> 篇</div>
          <div style="font-size:12px">编辑 <b>${num(point.edited)}</b> 次</div>`;
      }
    },
    xAxis: {
      type: 'category',
      data: points.map(item => item.date),
      boundaryGap: false,
      axisLine: { lineStyle: { color: p.border } },
      axisTick: { show: false },
      axisLabel: { show: false }
    },
    yAxis: {
      type: 'value',
      splitLine: splitLine.value,
      axisLabel: axisLabel.value
    },
    series: [
      {
        name: '新增笔记',
        type: 'line',
        data: points.map(item => item.created),
        smooth: 0.22,
        symbol: 'none',
        lineStyle: { width: 2, color: p.primary },
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: withAlpha(p.primary, p.dark ? 0.24 : 0.16) },
            { offset: 1, color: withAlpha(p.primary, 0) }
          ])
        },
        endLabel: {
          show: true,
          distance: 6,
          formatter: (params: any) => `${params.value} 篇`,
          color: p.primary,
          fontSize: 11,
          fontWeight: 600,
          fontFamily: MONO
        }
      }
    ]
  };
});

const editsOption = computed<EChartsOption>(() => {
  const p = palette.value;
  const points = trend.value;
  return {
    animationDuration: 600,
    grid: { left: 4, right: 48, top: 4, bottom: 2, containLabel: true },
    tooltip: {
      ...tooltipBase.value,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: p.border, width: 1 } },
      formatter: (params: any) => {
        const item = Array.isArray(params) ? params[0] : params;
        const point = points[item?.dataIndex ?? 0];
        return point ? `${point.date} · 编辑 <b>${num(point.edited)}</b> 次` : '';
      }
    },
    xAxis: {
      type: 'category',
      data: points.map(item => item.date),
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { ...axisLabel.value, interval: Math.max(0, Math.floor(points.length / 6)) }
    },
    yAxis: { type: 'value', show: false, min: 0 },
    series: [
      {
        name: '编辑次数',
        type: 'line',
        data: points.map(item => item.edited),
        smooth: 0.22,
        symbol: 'none',
        lineStyle: { width: 1.2, color: p.muted }
      }
    ]
  };
});

const dirOption = computed<EChartsOption>(() => {
  const p = palette.value;
  const items = dirRank.value;
  return {
    animationDuration: 600,
    grid: { left: 4, right: 56, top: 12, bottom: 10, containLabel: true },
    tooltip: {
      ...tooltipBase.value,
      trigger: 'item',
      formatter: (params: any) => {
        const item = items[params.dataIndex];
        return item ? `${item.name}<br/>笔记 <b>${num(item.notes)}</b> 篇 · 近 7 天活跃 ${num(item.active7d)} 篇次` : '';
      }
    },
    xAxis: { type: 'value', show: false, max: (value: any) => value.max * 1.05 },
    yAxis: {
      type: 'category',
      data: items.map(item => item.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: p.title, fontSize: 12 }
    },
    series: [
      {
        type: 'bar',
        data: items.map(item => item.notes),
        barWidth: 12,
        itemStyle: {
          borderRadius: [0, 3, 3, 0],
          color: (params: any) => (params.dataIndex === items.length - 1 ? p.primary : withAlpha(p.primary, 0.26))
        },
        emphasis: { itemStyle: { color: p.primary } },
        label: {
          show: true,
          position: 'right',
          distance: 8,
          formatter: (params: any) => num(params.value),
          color: p.muted,
          fontSize: 11,
          fontFamily: MONO
        }
      }
    ]
  };
});

const deviceRows = computed(() => {
  const items = overview.value?.device ?? [];
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  return items.map(item => ({ ...item, pct: Math.round((item.value / total) * 100) }));
});

const deviceOption = computed<EChartsOption>(() => {
  const p = palette.value;
  const items = deviceRows.value;
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return {
    animationDuration: 600,
    tooltip: {
      ...tooltipBase.value,
      trigger: 'item',
      formatter: (params: any) => `${params.name} · ${num(params.value)} 次登录（${params.percent}%）`
    },
    series: [
      {
        type: 'pie',
        radius: ['64%', '88%'],
        center: ['50%', '50%'],
        label: {
          show: true,
          position: 'center',
          formatter: [`{a|${num(total)}}`, '{b|次登录}'].join('\n'),
          rich: {
            a: { fontSize: 17, fontWeight: 600, color: p.title, fontFamily: MONO, lineHeight: 22 },
            b: { fontSize: 10, color: p.muted, lineHeight: 14 }
          }
        },
        labelLine: { show: false },
        itemStyle: { borderColor: p.surface, borderWidth: 2 },
        data: items.map((item, index) => ({
          value: item.value,
          name: item.name,
          itemStyle: { color: index === 0 ? p.primary : softBar.value }
        }))
      }
    ]
  };
});

/* ---------- 系统脉搏 ---------- */
const p95Budget = 200;

const pulseRows = computed(() => {
  const system = overview.value?.system;
  const online = system?.online ?? 0;
  const users = kpi.value.users || 1;
  const rows: Array<{ name: string; value: string; width: number | null; note: string }> = [];

  const successRate = system?.successRate ?? 0;
  rows.push(
    successRate > 0
      ? { name: '接口成功率', value: `${successRate}%`, width: Math.min(100, successRate), note: '' }
      : { name: '接口成功率', value: '—', width: null, note: '口径待接入' }
  );

  const p95 = system?.p95ms ?? 0;
  rows.push(
    p95 > 0
      ? { name: 'P95 响应', value: `${p95} ms`, width: Math.min(100, (p95 / p95Budget) * 100), note: '' }
      : { name: 'P95 响应', value: '—', width: null, note: '口径待接入' }
  );

  const cacheHit = system?.cacheHit ?? 0;
  rows.push(
    cacheHit > 0
      ? { name: '缓存命中率', value: `${cacheHit}%`, width: Math.min(100, cacheHit), note: '' }
      : { name: '缓存命中率', value: '—', width: null, note: '需 Redis INFO，暂未采集' }
  );

  rows.push({
    name: '当前在线',
    value: `${num(online)} 人`,
    width: null,
    note: `占用户 ${((online / users) * 100).toFixed(1)}%`
  });

  rows.push({
    name: '今日操作',
    value: `${num(system?.operlogToday ?? kpi.value.operlogToday)} 次`,
    width: null,
    note: '含后台与客户端'
  });

  return rows;
});

/* ---------- 数据加载 ---------- */
const load = async (notify = false) => {
  loading.value = true;
  errorMsg.value = '';
  try {
    const res = await getDashboardOverview(range.value);
    overview.value = res.data ?? null;
    if (notify) modal.msgSuccess('数据已刷新');
  } catch (error: any) {
    errorMsg.value = error?.message || '首页数据加载失败，请稍后重试';
    if (!overview.value) modal.msgError(errorMsg.value);
  } finally {
    loading.value = false;
  }
};

const changeRange = (value: number) => {
  if (range.value === value) return;
  range.value = value;
  load();
};

/* ---------- 导航 ---------- */
const go = (path: string) => {
  router.push(path).catch(() => undefined);
};
const goNotes = () => go('/notes/notes');

/* ---------- 主题与激活 ---------- */
let themeObserver: MutationObserver | undefined;

onMounted(() => {
  load();
  themeObserver = new MutationObserver(() => {
    themeTick.value += 1;
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
});

onActivated(() => {
  if (!overview.value && !loading.value) load();
});

onBeforeUnmount(() => {
  themeObserver?.disconnect();
  themeObserver = undefined;
});
</script>
<style lang="scss" scoped>
/* ================= 首页 · 指挥带 Cockpit（方向 1） ================= */
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 6px 10px 16px;
  color: var(--app-text-title);
}

/* ---------- 页头 ---------- */
.dash-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.head-copy {
  min-width: 0;
}

.eyebrow {
  margin: 0 0 7px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--app-text-muted);
}

.head-copy h1 {
  margin: 0;
  font-size: 26px;
  line-height: 1.1;
  font-weight: 650;
  letter-spacing: -0.035em;
  color: var(--app-text-title);
}

.head-copy .sub {
  margin: 7px 0 0;
  font-size: 13px;
  color: var(--app-text-muted);
  max-width: 680px;

  b {
    color: var(--app-text-title);
    font-weight: 600;
  }
}

.head-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.seg {
  display: flex;
  padding: 2px;
  background: var(--app-surface-bg);
  border: 1px solid var(--app-surface-border);
  border-radius: 9px;
  box-shadow: var(--app-shadow-sm);

  button {
    height: 28px;
    padding: 0 12px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    font-size: 12px;
    color: var(--app-text-muted);
    transition:
      background 0.15s ease,
      color 0.15s ease;

    &:hover {
      color: var(--app-text-title);
    }

    &.on {
      background: var(--app-accent-soft);
      color: var(--app-accent-strong);
      font-weight: 600;
    }
  }
}

.ghost-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--app-surface-border);
  border-radius: 9px;
  background: var(--app-surface-bg);
  color: var(--app-text-title);
  font-size: 12.5px;
  box-shadow: var(--app-shadow-sm);

  &:hover:not(:disabled) {
    border-color: var(--app-accent-strong);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.ghost-icon {
  font-size: 14px;
}

/* ---------- 错误条 ---------- */
.dash-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 14px;
  border: 1px solid rgba(180, 83, 75, 0.28);
  border-radius: 10px;
  background: rgba(180, 83, 75, 0.08);
  font-size: 12.5px;
  color: var(--el-color-danger);

  button {
    border: 0;
    background: transparent;
    color: var(--el-color-danger);
    font-size: 12.5px;
    font-weight: 600;
    text-decoration: underline;
  }
}

/* ---------- 数据带 ---------- */
.band {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) 1.15fr;
  background: var(--app-surface-bg);
  border: 1px solid var(--app-surface-border);
  border-radius: var(--app-radius-base);
  box-shadow: var(--app-shadow-sm);
  overflow: hidden;
}

.band-cell {
  position: relative;
  min-width: 0;
  padding: 15px 18px 14px;
  border-right: 1px solid var(--app-surface-border);

  &:last-child {
    border-right: 0;
    background: var(--app-elevated-soft-bg);
  }
}

.lab {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--app-text-muted);
}

.dot {
  display: block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.dot-primary {
  background: var(--app-accent-strong);
}

.dot-success {
  background: var(--el-color-success);
}

.dot-info {
  background: var(--el-color-info);
}

.dot-warning {
  background: var(--el-color-warning);
}

.dot.ring {
  box-shadow: 0 0 0 3px rgba(28, 90, 72, 0.14);
}

.band-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.band-cell .v {
  font-size: 29px;
  line-height: 1;
  font-weight: 640;
  letter-spacing: -0.045em;
  color: var(--app-text-title);
  font-variant-numeric: tabular-nums;
}

.band-cell .u {
  padding-bottom: 3px;
  font-size: 11.5px;
  color: var(--app-text-muted);
}

.band-meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 9px;
  font-size: 11.5px;
  color: var(--app-text-muted);
  white-space: nowrap;

  b {
    color: var(--app-text-title);
    font-weight: 600;
  }
}

.delta {
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(47, 158, 107, 0.12);
  color: var(--el-color-success);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 10.5px;
}

.spark {
  position: absolute;
  top: 36px;
  right: 15px;
  width: 58px;
  height: 20px;
  opacity: 0.85;

  path {
    fill: none;
    stroke-width: 1.3;
    vector-effect: non-scaling-stroke;
  }
}

.status-cell {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 9px;
}

.status-top {
  display: flex;
  align-items: baseline;
  gap: 8px;

  .v {
    font-size: 23px;
    font-weight: 640;
    letter-spacing: -0.04em;
    color: var(--app-text-title);
    font-variant-numeric: tabular-nums;
  }

  .u {
    font-size: 11px;
    color: var(--app-text-muted);
  }
}

.pulse-list {
  display: grid;
  gap: 6px;

  div {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: var(--app-text-muted);
  }

  b {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 500;
    color: var(--app-text-title);
  }
}

/* ---------- 栅格与面板 ---------- */
.dash-row {
  display: grid;
  gap: 14px;
}

.row-a {
  grid-template-columns: minmax(0, 2.05fr) minmax(300px, 1fr);
}

.row-b {
  grid-template-columns: minmax(0, 1.55fr) minmax(220px, 0.78fr) minmax(220px, 0.78fr);
}

.panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: var(--app-surface-bg);
  border: 1px solid var(--app-surface-border);
  border-radius: var(--app-radius-base);
  box-shadow: var(--app-shadow-sm);
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 16px 0;

  .t {
    display: flex;
    align-items: baseline;
    gap: 9px;
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: 13.5px;
    font-weight: 620;
    letter-spacing: -0.01em;
    color: var(--app-text-title);
    white-space: nowrap;
  }

  .k {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--app-text-muted);
  }

  .r a {
    font-size: 11.5px;
    font-weight: 600;
    color: var(--app-accent-strong);
    white-space: nowrap;
  }
}

.legend-inline {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 11px;
  color: var(--app-text-muted);

  span {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  i {
    display: block;
    width: 8px;
    height: 2px;
    border-radius: 2px;
  }
}

.trend-main {
  margin-top: 4px;
}

/* ---------- 最近更新 ---------- */
.notes-table {
  width: 100%;
  margin-top: 6px;
  border-collapse: collapse;
  table-layout: fixed;

  th {
    padding: 9px 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--app-text-muted);
    text-align: left;
    white-space: nowrap;
    border-bottom: 1px solid var(--app-surface-border);
  }

  td {
    height: 42px;
    padding: 0 12px;
    font-size: 12.8px;
    color: var(--app-text-title);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    border-bottom: 1px solid var(--app-surface-border);
  }

  tr:last-child td {
    border-bottom: 0;
  }

  tbody tr:hover {
    background: var(--app-elevated-soft-bg);
  }

  .name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 550;
    color: var(--app-text-title);

    span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .note-icon {
    flex: 0 0 13px;
    font-size: 13px;
    color: var(--app-text-muted);
  }

  .dir {
    color: var(--app-text-muted);
  }

  .ellipsis {
    color: var(--app-text-title);
  }

  .num {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11.5px;
    color: var(--app-text-muted);
  }

  .upd {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    color: var(--app-text-muted);
    text-align: right;
  }

  .empty-cell {
    padding: 28px 16px;
    text-align: center;
    color: var(--app-text-muted);
  }
}

/* ---------- 登录设备 ---------- */
.device-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  flex: 1;
  padding: 4px 14px 14px;
}

.device-chart {
  width: 132px !important;
}

.device-legend {
  display: grid;
  gap: 7px;
  width: 100%;
  margin-top: 6px;

  div {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 11.5px;
    color: var(--app-text-muted);
  }

  i {
    display: block;
    flex: 0 0 7px;
    width: 7px;
    height: 7px;
    border-radius: 2px;
  }

  .dl-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  b {
    margin-left: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--app-text-title);
  }
}

/* ---------- 系统脉搏 ---------- */
.pulse {
  display: grid;
  gap: 11px;
  padding: 12px 16px 0;
}

.pulse-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 4px 10px;
  align-items: baseline;

  .n {
    font-size: 11.5px;
    color: var(--app-text-muted);
  }

  .v {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px;
    font-weight: 550;
    color: var(--app-text-title);
  }
}

.pulse-bar {
  grid-column: 1 / -1;
  display: block;
  height: 3px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--app-elevated-soft-bg);

  i {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--app-accent-strong);
    opacity: 0.75;
  }
}

.pulse-note {
  grid-column: 1 / -1;
  font-size: 10.5px;
  color: var(--app-text-muted);
}

.quick {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px 16px;

  a {
    padding: 5px 9px;
    border: 1px solid var(--app-surface-border);
    border-radius: 7px;
    background: var(--app-surface-bg);
    font-size: 11.5px;
    color: var(--app-text-title);

    &:hover {
      border-color: var(--app-accent-strong);
      color: var(--app-accent-strong);
    }
  }
}

/* ---------- 响应式 ---------- */
@media (max-width: 1360px) {
  .row-b {
    grid-template-columns: minmax(0, 1.3fr) minmax(200px, 0.7fr) minmax(200px, 0.7fr);
  }
}

@media (max-width: 1180px) {
  .band {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .band-cell:nth-child(2n) {
    border-right: 0;
  }

  .band-cell:nth-child(-n + 4) {
    border-bottom: 1px solid var(--app-surface-border);
  }

  .row-a,
  .row-b {
    grid-template-columns: minmax(0, 1fr);
  }

  .spark {
    top: 30px;
  }
}

@media (max-width: 720px) {
  .dash-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .band {
    grid-template-columns: minmax(0, 1fr);
  }

  .band-cell {
    border-right: 0;
    border-bottom: 1px solid var(--app-surface-border);
  }
}
</style>