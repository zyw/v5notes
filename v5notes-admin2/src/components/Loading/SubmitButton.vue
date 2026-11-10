<template>
  <el-button :class="['sb-btn', { 'is-sb-loading': loading }]">
    <span class="sb-inner">
      <span v-if="loading" class="sb-spinner" aria-hidden="true"></span>
      <span class="sb-text"><slot /></span>
    </span>
  </el-button>
</template>

<script setup name="SubmitButton" lang="ts">
withDefaults(defineProps<{ loading?: boolean }>(), { loading: false });
</script>
