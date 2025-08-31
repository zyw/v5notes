<template>
  <svg 
    class="icon linux-close-btn" 
    viewBox="0 0 16 16" 
    width="16" 
    height="16"
  >
    <rect 
      width="16" 
      height="16" 
      fill="#e81123"
      :class="{ 'hover:opacity-80': hover }"
      rx="0"
    />
    <path 
      d="M5 5 L11 11 M11 5 L5 11" 
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
.linux-close-btn {
  transition: opacity 0.2s ease;
}
</style>