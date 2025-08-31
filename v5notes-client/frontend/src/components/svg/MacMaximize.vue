<template>
  <svg 
    class="icon mac-maximize-btn" 
    viewBox="0 0 12 12" 
    width="12" 
    height="12"
  >
    <circle 
      cx="6" 
      cy="6" 
      r="6" 
      fill="#28ca42"
      :class="{ 'hover:opacity-80': hover }"
    />
    <g v-if="hover">
      <path 
        v-if="!isMaximized"
        d="M3.5 3.5 L8.5 3.5 L8.5 8.5 L3.5 8.5 Z" 
        stroke="#fff" 
        stroke-width="1" 
        fill="none"
      />
      <g v-else>
        <!-- 还原图标：两个重叠的小方块 -->
        <path 
          d="M4 4 L7 4 L7 7 L4 7 Z" 
          stroke="#fff" 
          stroke-width="0.8" 
          fill="none"
        />
        <path 
          d="M5 5 L8 5 L8 8 L5 8 Z" 
          stroke="#fff" 
          stroke-width="0.8" 
          fill="none"
        />
      </g>
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
.mac-maximize-btn {
  transition: opacity 0.2s ease;
}
</style>