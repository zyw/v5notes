<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TreeNode } from '../service/api'
import TreeIcon from './TreeIcon.vue'

const props = defineProps<{ node: TreeNode; selectedId: string; depth?: number }>()
defineOptions({ name: 'TreeItem' })
const emit = defineEmits<{
  select: [id: string]
  directory: [id: string]
  add: [id: string]
  rename: [node: TreeNode]
  remove: [node: TreeNode]
  addNote: [id: string]
  noteOpen: [id: string]
  noteRename: [id: string]
  noteDelete: [id: string]
}>()

const isDirectory = computed(() => props.node.type === 1)
function containsSelectedNote(node: TreeNode): boolean {
  return node.id === props.selectedId || Boolean(node.children?.some(containsSelectedNote))
}

const expanded = ref(isDirectory.value && ((props.depth || 0) === 0 || Boolean(props.node.children?.some(containsSelectedNote))))
const menuOpen = ref(false)

watch(() => props.selectedId, () => {
  if (isDirectory.value && props.node.children?.some(containsSelectedNote)) expanded.value = true
})

function activate(): void {
  if (isDirectory.value) {
    expanded.value = !expanded.value
    emit('directory', props.node.id)
  } else {
    emit('select', props.node.id)
  }
}
</script>

<template>
  <div class="tree-node">
    <div class="tree-row" :class="{ active: !isDirectory && selectedId === node.id, 'directory-row': isDirectory }" :style="{ '--tree-depth': depth || 0 }" @contextmenu.prevent="menuOpen = true">
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
      <button class="tree-label" type="button" :title="node.label" :aria-label="node.label" @click="activate">
        <TreeIcon :kind="isDirectory ? 'folder' : 'note'" :open="isDirectory && expanded" />
        <span>{{ node.label }}</span>
      </button>
      <div class="tree-actions">
        <details class="tree-menu" :open="menuOpen" @toggle="menuOpen = ($event.target as HTMLDetailsElement).open" @click.stop>
          <summary title="更多操作" :aria-label="`${node.label} 更多操作`"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="4" cy="10" r="1.35"/><circle cx="10" cy="10" r="1.35"/><circle cx="16" cy="10" r="1.35"/></svg></summary>
          <div class="popover-menu">
            <template v-if="isDirectory">
              <button @click="emit('add', node.id); menuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 6h5.8L10 8h7.5v8H2.5zM13.5 3v5M11 5.5h5"/></svg>新建子目录</button>
              <button @click="emit('addNote', node.id); menuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5h6l4 4V17H5zM11 2.8v4h3.7M8 10h4M8 13h4M16.5 12v5M14 14.5h5"/></svg>新建笔记</button>
              <button @click="emit('rename', node); menuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.8 3.2 4 4M3 17l3.8-.8L16 7a1.4 1.4 0 0 0-2-2L4.8 14.2z"/></svg>重命名</button>
              <button class="danger-menu-item" @click="emit('remove', node); menuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11M8.5 8.5v5M11.5 8.5v5"/></svg>删除目录</button>
            </template>
            <template v-else>
              <button @click="emit('noteOpen', node.id); menuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 16 16 4M8 4h8v8"/></svg>打开</button>
              <button @click="emit('noteRename', node.id); menuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.8 3.2 4 4M3 17l3.8-.8L16 7a1.4 1.4 0 0 0-2-2L4.8 14.2z"/></svg>重命名</button>
              <button class="danger-menu-item" @click="emit('noteDelete', node.id); menuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11M8.5 8.5v5M11.5 8.5v5"/></svg>删除笔记</button>
            </template>
          </div>
        </details>
      </div>
    </div>
    <div v-if="isDirectory && expanded && node.children?.length" class="tree-children">
      <TreeItem
        v-for="child in node.children" :key="child.id" :node="child" :selected-id="selectedId" :depth="(depth || 0) + 1"
        @select="emit('select', $event)" @directory="emit('directory', $event)" @add="emit('add', $event)"
        @rename="emit('rename', $event)" @remove="emit('remove', $event)"
        @add-note="emit('addNote', $event)" @note-open="emit('noteOpen', $event)"
        @note-rename="emit('noteRename', $event)" @note-delete="emit('noteDelete', $event)"
      />
    </div>
  </div>
</template>
