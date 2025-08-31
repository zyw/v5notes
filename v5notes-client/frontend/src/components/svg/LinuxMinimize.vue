<template>
  <svg 
    class="icon linux-minimize-btn" 
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
    <path 
      d="M4 8 L12 8" 
      stroke="#fff" 
      stroke-width="1.5" 
      stroke-linecap="round"
    />
  </svg>
</template>

<script lang="ts" setup>
interface Props {
  hover?: boolean
}

defineProps<Props>()
</script>

<style scoped>
.linux-minimize-btn {
  transition: opacity 0.2s ease;
}
</style>