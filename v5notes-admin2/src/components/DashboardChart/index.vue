<template>
  <div ref="hostRef" class="dashboard-chart" :style="{ height }"></div>
</template>

<script setup name="DashboardChart" lang="ts">
import * as echarts from 'echarts';

const props = withDefaults(
  defineProps<{
    option: echarts.EChartsOption;
    height?: string;
  }>(),
  { height: '100%' }
);

const hostRef = ref<HTMLDivElement>();
let chart: echarts.ECharts | undefined;
let observer: ResizeObserver | undefined;

const resize = () => {
  chart?.resize();
};

const render = () => {
  if (!hostRef.value) return;
  if (!chart) {
    chart = echarts.init(hostRef.value, undefined, { renderer: 'canvas' });
  }
  chart.setOption(props.option, true);
  chart.resize();
};

onMounted(() => {
  render();
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => resize());
    if (hostRef.value) observer.observe(hostRef.value);
  }
  window.addEventListener('resize', resize);
});

watch(
  () => props.option,
  () => render(),
  { deep: true }
);

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = undefined;
  window.removeEventListener('resize', resize);
  chart?.dispose();
  chart = undefined;
});

defineExpose({ resize });
</script>

<style lang="scss" scoped>
.dashboard-chart {
  width: 100%;
  min-height: 1px;
}
</style>
