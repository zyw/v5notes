<script setup lang="ts">
import { ref } from 'vue'
import type { VaultTreeNode } from '../vault/types'

defineProps<{
  nodes: VaultTreeNode[]
  selectedPath: string | null
  depth?: number
}>()

const emit = defineEmits<{
  open: [node: VaultTreeNode]
  addNote: [parent: VaultTreeNode | null]
  addDir: [parent: VaultTreeNode | null]
  rename: [node: VaultTreeNode]
  remove: [node: VaultTreeNode]
}>()

const expanded = ref<Record<string, boolean>>({})

function toggle(path: string) {
  expanded.value = { ...expanded.value, [path]: !expanded.value[path] }
}

function isExpanded(path: string): boolean {
  return expanded.value[path] !== false
}
</script>

<template>
  <ul class="vault-tree" :style="{ '--depth': depth ?? 0 }">
    <li v-for="node in nodes" :key="node.identityKey">
      <div
        class="tree-row"
        :class="{
          selected: selectedPath === node.path,
          dir: node.kind === 'dir',
          note: node.kind === 'note',
        }"
      >
        <button
          v-if="node.kind === 'dir'"
          type="button"
          class="twist"
          :aria-expanded="isExpanded(node.path)"
          :aria-label="isExpanded(node.path) ? '折叠' : '展开'"
          @click="toggle(node.path)"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              v-if="isExpanded(node.path)"
              d="M4 6.5 8 10.5 12 6.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
            <path
              v-else
              d="M6.5 4 10.5 8 6.5 12"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <span v-else class="twist-spacer" aria-hidden="true" />
        <button type="button" class="tree-label" @click="node.kind === 'dir' ? toggle(node.path) : emit('open', node)">
          <svg v-if="node.kind === 'dir'" class="icon" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fill="currentColor"
              d="M2.5 5.5A1.5 1.5 0 0 1 4 4h4.2l1.3 1.4H16A1.5 1.5 0 0 1 17.5 7v8A1.5 1.5 0 0 1 16 16.5H4A1.5 1.5 0 0 1 2.5 15Z"
              opacity=".9"
            />
          </svg>
          <svg v-else class="icon" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fill="currentColor"
              d="M5 2.5h6.2L15.5 7v9.5A1.5 1.5 0 0 1 14 18H5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5 2.5Z"
            />
          </svg>
          <span>{{ node.name.replace(/\.md$/i, '') }}</span>
        </button>
        <div class="tree-actions" @click.stop>
          <button
            v-if="node.kind === 'dir'"
            type="button"
            class="tree-action"
            title="新建笔记"
            aria-label="新建笔记"
            @click="emit('addNote', node)"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </button>
          <button
            v-if="node.kind === 'dir'"
            type="button"
            class="tree-action"
            title="新建子目录"
            aria-label="新建子目录"
            @click="emit('addDir', node)"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5.5h4l1 1.2H14v6.3H2z" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M8 8v4M6 10h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          </button>
          <button
            type="button"
            class="tree-action"
            title="重命名"
            aria-label="重命名"
            @click="emit('rename', node)"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 12.5 4.2 8.8 11 2l2.5 2.5-6.8 6.8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          </button>
          <button
            type="button"
            class="tree-action danger-text"
            title="删除到回收站"
            aria-label="删除到回收站"
            @click="emit('remove', node)"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 5h8l-.7 8.2H4.7zM6 5V3.5h4V5M3 5h10" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
      <VaultTree
        v-if="node.kind === 'dir' && isExpanded(node.path) && node.children?.length"
        :nodes="node.children"
        :selected-path="selectedPath"
        :depth="(depth ?? 0) + 1"
        @open="emit('open', $event)"
        @add-note="emit('addNote', $event)"
        @add-dir="emit('addDir', $event)"
        @rename="emit('rename', $event)"
        @remove="emit('remove', $event)"
      />
    </li>
  </ul>
</template>
