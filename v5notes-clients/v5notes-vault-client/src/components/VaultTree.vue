<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import TreeIcon from './TreeIcon.vue'
import { activeTreeMenu, closeTreeMenu, openTreeMenu } from './treeMenu'
import type { VaultTreeNode } from '../vault/types'

withDefaults(
  defineProps<{
    nodes: VaultTreeNode[]
    selectedPath: string | null
    depth?: number
    showHint?: boolean
  }>(),
  { showHint: false },
)

const emit = defineEmits<{
  open: [node: VaultTreeNode]
  addNote: [parent: VaultTreeNode | null]
  addDir: [parent: VaultTreeNode | null]
  rename: [node: VaultTreeNode]
  remove: [node: VaultTreeNode]
}>()

const expanded = ref<Record<string, boolean>>({})

const menuStyle = computed(() => ({
  top: `${activeTreeMenu.value?.top ?? 0}px`,
  left: `${activeTreeMenu.value?.left ?? 0}px`,
}))

function toggle(path: string) {
  expanded.value = { ...expanded.value, [path]: !expanded.value[path] }
}

function isExpanded(path: string): boolean {
  return expanded.value[path] !== false
}

function hasChildren(node: VaultTreeNode): boolean {
  return Boolean(node.children?.length)
}

function hintFor(path: string): string {
  const index = path.lastIndexOf('/')
  return index >= 0 ? path.slice(0, index) : ''
}

function activate(node: VaultTreeNode) {
  if (node.kind === 'dir') toggle(node.path)
  else if (node.kind === 'note') emit('open', node)
}

function openMenu(event: MouseEvent, node: VaultTreeNode) {
  openTreeMenu(node.identityKey, event.currentTarget as HTMLElement)
}

function run(action: () => void) {
  closeTreeMenu()
  action()
}

onBeforeUnmount(() => {
  if (activeTreeMenu.value) closeTreeMenu()
})
</script>

<template>
  <ul class="vault-tree">
    <li v-for="node in nodes" :key="node.identityKey" class="tree-node">
      <div
        class="tree-row"
        :class="{
          selected: selectedPath === node.path,
          dir: node.kind === 'dir',
          note: node.kind === 'note',
          file: node.kind === 'file',
        }"
        :style="{ '--depth': depth ?? 0 }"
      >
        <button
          v-if="node.kind === 'dir'"
          type="button"
          class="twist"
          :class="{ 'is-empty': !hasChildren(node) }"
          :aria-expanded="hasChildren(node) ? isExpanded(node.path) : false"
          :aria-label="hasChildren(node) ? `${isExpanded(node.path) ? '折叠' : '展开'} ${node.name}` : `${node.name}（空目录）`"
          @click="hasChildren(node) && toggle(node.path)"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M6 4l4 4-4 4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <span v-else class="twist-spacer" aria-hidden="true" />

        <button
          type="button"
          class="tree-label"
          :title="node.path"
          @click="activate(node)"
        >
          <TreeIcon
            :kind="node.kind === 'dir' ? 'folder' : 'note'"
            :open="node.kind === 'dir' && hasChildren(node) && isExpanded(node.path)"
          />
          <span class="tree-name">{{ node.name.replace(/\.md$/i, '') }}</span>
          <span v-if="showHint && node.kind === 'note' && hintFor(node.path)" class="tree-hint">
            {{ hintFor(node.path) }}
          </span>
        </button>

        <button
          type="button"
          class="tree-more"
          :aria-expanded="activeTreeMenu?.key === node.identityKey"
          aria-haspopup="menu"
          :aria-label="`更多操作：${node.name}`"
          title="更多操作"
          @click.stop="openMenu($event, node)"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="3.6" cy="8" r="1.15" />
            <circle cx="8" cy="8" r="1.15" />
            <circle cx="12.4" cy="8" r="1.15" />
          </svg>
        </button>
      </div>

      <div
        v-if="activeTreeMenu?.key === node.identityKey"
        class="tree-menu"
        :style="menuStyle"
        role="menu"
        aria-label="笔记操作"
        @click.stop
      >
        <template v-if="node.kind === 'dir'">
          <button type="button" role="menuitem" @click="run(() => emit('addNote', node))">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 2.5h5l3 3v8H4z" />
              <path d="M9 2.8v2.9h2.7M8 8.2v4M6 10.2h4" />
            </svg>
            新建笔记
          </button>
          <button type="button" role="menuitem" @click="run(() => emit('addDir', node))">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 5.2h4l1 1.2h7v6.4H2z" />
              <path d="M8 8v4M6 10h4" />
            </svg>
            新建子目录
          </button>
          <div class="tree-menu-sep" role="separator" />
        </template>
        <button type="button" role="menuitem" @click="run(() => emit('rename', node))">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 12.6 4.2 8.9 11 2.1l2.5 2.5-6.8 6.8z" />
            <path d="m9.6 3.7 2.4 2.4" />
          </svg>
          重命名
        </button>
        <button type="button" role="menuitem" class="is-danger" @click="run(() => emit('remove', node))">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 5h8l-.7 8.1H4.7zM6 5V3.4h4V5M3 5h10" />
          </svg>
          移入回收站
        </button>
      </div>

      <VaultTree
        v-if="node.kind === 'dir' && isExpanded(node.path) && node.children?.length"
        :nodes="node.children"
        :selected-path="selectedPath"
        :depth="(depth ?? 0) + 1"
        :show-hint="showHint"
        @open="emit('open', $event)"
        @add-note="emit('addNote', $event)"
        @add-dir="emit('addDir', $event)"
        @rename="emit('rename', $event)"
        @remove="emit('remove', $event)"
      />
    </li>
  </ul>
</template>
