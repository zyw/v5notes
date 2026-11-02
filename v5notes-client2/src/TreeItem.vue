<script setup lang="ts">
import { ref, watch } from 'vue'
import type { TreeNode } from './api'
import TreeIcon from './TreeIcon.vue'

const props = defineProps<{ node: TreeNode; selectedId: string; depth?: number }>()
const emit = defineEmits<{
  select: [id: string]
  directory: [id: string]
  add: [id: string]
  rename: [node: TreeNode]
  remove: [node: TreeNode]
}>()

const isDirectory = props.node.type === 1
function containsSelectedNote(node: TreeNode): boolean {
  return node.id === props.selectedId || Boolean(node.children?.some(containsSelectedNote))
}

const expanded = ref(isDirectory && ((props.depth || 0) === 0 || Boolean(props.node.children?.some(containsSelectedNote))))

watch(() => props.selectedId, () => {
  if (isDirectory && props.node.children?.some(containsSelectedNote)) expanded.value = true
})

function activate(): void {
  if (isDirectory) {
    expanded.value = !expanded.value
    emit('directory', props.node.id)
  } else {
    emit('select', props.node.id)
  }
}
</script>

<template>
  <div class="tree-node">
    <div class="tree-row" :class="{ active: !isDirectory && selectedId === node.id, 'directory-row': isDirectory }" :style="{ '--tree-depth': depth || 0 }">
      <button
        class="tree-disclosure"
        type="button"
        :aria-label="isDirectory ? `${expanded ? '收起' : '展开'}目录 ${node.label}` : undefined"
        :aria-expanded="isDirectory ? expanded : undefined"
        @click="activate"
      >
        <svg v-if="isDirectory" viewBox="0 0 16 16" aria-hidden="true">
          <path :d="expanded ? 'm3.5 5.75 4.5 4.5 4.5-4.5' : 'm5.75 3.5 4.5 4.5-4.5 4.5'" />
        </svg>
      </button>
      <button class="tree-label" type="button" @click="activate">
        <TreeIcon :kind="isDirectory ? 'folder' : 'note'" :open="isDirectory && expanded" />
        <span>{{ node.label }}</span>
      </button>
      <div v-if="isDirectory" class="tree-actions">
        <button type="button" title="新建子目录" :aria-label="`在 ${node.label} 下新建子目录`" @click.stop="emit('add', node.id)">＋</button>
        <button type="button" title="重命名目录" :aria-label="`重命名目录 ${node.label}`" @click.stop="emit('rename', node)">✎</button>
        <button type="button" title="删除目录" :aria-label="`删除目录 ${node.label}`" @click.stop="emit('remove', node)">×</button>
      </div>
    </div>
    <div v-if="isDirectory && expanded && node.children?.length" class="tree-children">
      <TreeItem
        v-for="child in node.children" :key="child.id" :node="child" :selected-id="selectedId" :depth="(depth || 0) + 1"
        @select="emit('select', $event)" @directory="emit('directory', $event)" @add="emit('add', $event)"
        @rename="emit('rename', $event)" @remove="emit('remove', $event)"
      />
    </div>
  </div>
</template>
