<template>
  <div class="table-skeleton" :aria-busy="true" aria-label="正在加载列表">
    <div v-for="r in rowCount" :key="r" class="ts-row">
      <div v-for="(c, i) in cols" :key="i" class="ts-cell" :style="{ flex: c }">
        <span v-if="i === 0 && avatar" class="ts-avatar sk-block" />
        <span class="ts-bar sk-block" :style="{ width: barWidth(r, i), height: i === 0 && avatar ? '10px' : '12px' }" />
      </div>
    </div>
  </div>
</template>

<script setup name="TableSkeleton" lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    rows?: number;
    cols?: number[] | number;
    avatar?: boolean;
  }>(),
  { rows: 6, cols: () => [2, 1, 1, 1, 1, 1], avatar: false }
);

const rowCount = computed(() => Math.max(1, props.rows));
const cols = computed(() => (Array.isArray(props.cols) ? props.cols : Array.from({ length: props.cols as number }, () => 1)));

// 每行宽度做一点伪随机错位，避免像等长灰条
const widths = [96, 74, 88, 66, 82, 70, 92, 78];
function barWidth(r: number, i: number) {
  if (i === 0) return 100 + '%';
  const w = widths[(r * 3 + i * 5) % widths.length];
  return w + '%';
}
</script>
