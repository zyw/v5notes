<template>
  <svg 
    class="icon mac-close-btn" 
    viewBox="0 0 12 12" 
    width="12" 
    height="12"
  >
    <circle 
      cx="6" 
      cy="6" 
      r="6" 
      fill="#ff5f57"
      :class="{ 'hover:opacity-80': hover }"
    />
    <path 
      v-if="hover"
      d="M4 4 L8 8 M8 4 L4 8" 
      stroke="#000" 
      stroke-width="1.2" 
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
.mac-close-btn {
  transition: opacity 0.2s ease;
}
</style>