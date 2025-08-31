<template>
  <svg 
    class="icon linux-maximize-btn" 
    viewBox="0 0 16 16" 
    width="16" 
    height="16"
  >
    <rect 
      width="16" 
      height="16" 
      fill="#666"
      :class="{ 'hover:opacity-80': hover }"
      rx="0"
    />
    <g v-if="!isMaximized">
      <!-- 最大化图标：单个方框 -->
      <rect 
        x="4" 
        y="4" 
        width="8" 
        height="8" 
        stroke="#fff" 
        stroke-width="1.2" 
        fill="none"
      />
    </g>
    <g v-else>
      <!-- 还原图标：两个重叠的方框 -->
      <rect 
        x="3" 
        y="3" 
        width="6" 
        height="6" 
        stroke="#fff" 
        stroke-width="1" 
        fill="none"
      />
      <rect 
        x="5" 
        y="5" 
        width="6" 
        height="6" 
        stroke="#fff" 
        stroke-width="1" 
        fill="none"
      />
    </g>
  </svg>
</template>

<script lang="ts" setup>
interface Props {
  hover?: boolean
  isMaximized?: boolean
}

defineProps<Props>()
</script>

<style scoped>
.linux-maximize-btn {
  transition: opacity 0.2s ease;
}
</style>