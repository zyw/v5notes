<template>
  <span class="sk-block" :class="{ 'is-circle': circle }" :style="style" aria-hidden="true" />
</template>

<script setup name="SkeletonBlock" lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    width?: string;
    height?: string;
    radius?: string;
    circle?: boolean;
  }>(),
  { width: '100%', height: '12px', radius: '6px', circle: false }
);

const style = computed(() => ({
  width: props.width,
  height: props.height,
  borderRadius: props.circle ? '50%' : props.radius
}));
</script>
