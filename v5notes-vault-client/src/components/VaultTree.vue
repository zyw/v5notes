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
      </div>
      <VaultTree
        v-if="node.kind === 'dir' && isExpanded(node.path) && node.children?.length"
        :nodes="node.children"
        :selected-path="selectedPath"
        :depth="(depth ?? 0) + 1"
        @open="emit('open', $event)"
      />
    </li>
  </ul>
</template>
