<script setup lang="ts">
import type { TreeNode } from './api'

defineProps<{ node: TreeNode; selectedId: string; depth?: number }>()
defineEmits<{
  select: [id: string]
  add: [id: string]
  rename: [node: TreeNode]
  remove: [node: TreeNode]
}>()
</script>

<template>
  <div class="folder" :class="{ active: selectedId === node.id }" :style="{ paddingLeft: `${10 + (depth || 0) * 14}px` }">
    <button @click="$emit('select', node.id)">{{ node.label }}</button>
    <button class="folder-action" title="新建子目录" @click="$emit('add', node.id)">＋</button>
    <button class="folder-action" title="重命名" @click="$emit('rename', node)">✎</button>
    <button class="folder-action" title="删除目录" @click="$emit('remove', node)">×</button>
  </div>
  <DirectoryItem
    v-for="child in node.children || []" :key="child.id" :node="child" :selected-id="selectedId" :depth="(depth || 0) + 1"
    @select="$emit('select', $event)" @add="$emit('add', $event)"
    @rename="$emit('rename', $event)" @remove="$emit('remove', $event)"
  />
</template>
