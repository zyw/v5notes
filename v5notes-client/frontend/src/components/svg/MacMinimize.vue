<template>
  <svg 
    class="icon mac-minimize-btn" 
    viewBox="0 0 12 12" 
    width="12" 
    height="12"
  >
    <circle 
      cx="6" 
      cy="6" 
      r="6" 
      fill="#ffbd2e"
      :class="{ 'hover:opacity-80': hover }"
    />
    <path 
      v-if="hover"
      d="M3.5 6 L8.5 6" 
      stroke="#fff" 
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
.mac-minimize-btn {
  transition: opacity 0.2s ease;
}
</style>