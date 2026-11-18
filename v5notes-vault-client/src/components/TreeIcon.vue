<script setup lang="ts">
withDefaults(defineProps<{ kind: 'folder' | 'note'; open?: boolean }>(), { open: false })
</script>

<template>
  <svg
    v-if="kind === 'folder'"
    class="tree-icon folder-icon"
    :class="{ open }"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M2.6 5.4c0-.72.58-1.3 1.3-1.3h3.9l1.66 1.86h6.64c.72 0 1.3.58 1.3 1.3v7.44c0 .72-.58 1.3-1.3 1.3H3.9c-.72 0-1.3-.58-1.3-1.3V5.4Z"
      fill="currentColor"
      fill-opacity=".1"
      stroke="currentColor"
      stroke-width="1.35"
      stroke-linejoin="round"
    />
    <path d="M2.9 7.3h14.2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" opacity=".55" />
  </svg>
  <svg
    v-else
    class="tree-icon note-icon"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M5.1 2.7h6.55l3.25 3.25v11.35H5.1V2.7Z"
      fill="currentColor"
      fill-opacity=".07"
      stroke="currentColor"
      stroke-width="1.35"
      stroke-linejoin="round"
    />
    <path
      d="M11.55 2.9v3.35h3.1M7.6 9.1h4.8M7.6 11.9h4.8"
      stroke="currentColor"
      stroke-width="1.2"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>
