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
      <g v-if="!isMaximized">
        <!-- 全屏图标：左上到右下的两个对角箭头 -->
        <!-- 左上箭头 -->
        <path 
          d="M3.5 3.5 L3.5 5.5 M3.5 3.5 L5.5 3.5" 
          stroke="#000" 
          stroke-width="1.2" 
          stroke-linecap="round"
        />
        <!-- 右下箭头 -->
        <path 
          d="M8.5 8.5 L8.5 6.5 M8.5 8.5 L6.5 8.5" 
          stroke="#000" 
          stroke-width="1.2" 
          stroke-linecap="round"
        />
      </g>
      <g v-else>
        <!-- 退出全屏图标：两个相反方向的L形路径 -->
        <!-- 第一个 L 形路径：左下到右下到右上 -->
        <path 
          d="M3.5 8.5 L6.5 8.5 L6.5 5.5" 
          stroke="#000" 
          stroke-width="1.2" 
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
        <!-- 第二个 L 形路径：右上到左上到左下 -->
        <path 
          d="M8.5 3.5 L5.5 3.5 L5.5 6.5" 
          stroke="#000" 
          stroke-width="1.2" 
          stroke-linecap="round"
          stroke-linejoin="round"
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