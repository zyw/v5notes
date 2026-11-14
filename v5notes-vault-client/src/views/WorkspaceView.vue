<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import VaultTree from '../components/VaultTree.vue'
import type { OpenedVault, VaultTreeNode } from '../vault/types'
import { vaultFs } from '../vault/vaultFs'
import { VaultPathError } from '../path/identity'

const props = defineProps<{
  vault: OpenedVault
}>()

const emit = defineEmits<{
  close: []
  error: [message: string]
}>()

const tree = ref<VaultTreeNode[]>([])
const selectedPath = ref<string | null>(null)
const content = ref('')
const savedContent = ref('')
const editorMode = ref<'preview' | 'edit'>('preview')
const busy = ref(false)
const status = ref('')
const sidebarOpen = ref(true)

const dirty = computed(() => selectedPath.value != null && content.value !== savedContent.value)
const noteTitle = computed(() => {
  if (!selectedPath.value) return ''
  const name = selectedPath.value.split('/').pop() ?? selectedPath.value
  return name.replace(/\.md$/i, '')
})

async function refreshTree() {
  tree.value = await vaultFs.listTree(props.vault.rootPath)
}

async function openNote(node: VaultTreeNode) {
  if (node.kind !== 'note') return
  if (dirty.value) {
    const ok = await saveCurrent()
    if (!ok) return
  }
  busy.value = true
  status.value = ''
  try {
    const text = await vaultFs.readText(props.vault.rootPath, node.path)
    selectedPath.value = node.path
    content.value = text
    savedContent.value = text
    editorMode.value = 'preview'
  } catch (error) {
    emit('error', error instanceof Error ? error.message : String(error))
  } finally {
    busy.value = false
  }
}

async function saveCurrent(): Promise<boolean> {
  if (!selectedPath.value || !dirty.value) return true
  busy.value = true
  status.value = ''
  try {
    await vaultFs.writeText(props.vault.rootPath, selectedPath.value, content.value)
    savedContent.value = content.value
    status.value = '已保存'
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    status.value = message
    emit('error', message)
    return false
  } finally {
    busy.value = false
  }
}

async function enterEdit() {
  editorMode.value = 'edit'
}

async function leaveEdit() {
  if (dirty.value) {
    const ok = await saveCurrent()
    if (!ok) return
  }
  editorMode.value = 'preview'
}

async function createNote() {
  if (dirty.value) {
    const ok = await saveCurrent()
    if (!ok) return
  }
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const rel = `未命名-${stamp}.md`
  try {
    await vaultFs.writeText(props.vault.rootPath, rel, `# 未命名\n\n`)
    await refreshTree()
    await openNote({
      path: rel,
      identityKey: rel.toLowerCase(),
      name: rel,
      kind: 'note',
    })
    editorMode.value = 'edit'
  } catch (error) {
    const message = error instanceof VaultPathError || error instanceof Error ? error.message : String(error)
    emit('error', message)
  }
}

watch(
  () => props.vault.rootPath,
  async () => {
    selectedPath.value = null
    content.value = ''
    savedContent.value = ''
    await refreshTree()
  },
)

onMounted(async () => {
  try {
    await refreshTree()
  } catch (error) {
    emit('error', error instanceof Error ? error.message : String(error))
  }
})
</script>

<template>
  <div class="workspace" :class="{ 'sidebar-collapsed': !sidebarOpen }">
    <aside v-show="sidebarOpen" class="sidebar" aria-label="库目录">
      <div class="sidebar-head">
        <div class="vault-title" :title="vault.rootPath">
          <strong>{{ vault.name }}</strong>
          <span>{{ vault.rootPath }}</span>
        </div>
        <div class="sidebar-actions">
          <button type="button" class="ghost compact" @click="createNote">新建笔记</button>
          <button type="button" class="ghost compact" @click="emit('close')">切换库</button>
        </div>
      </div>
      <div class="tree-scroll">
        <VaultTree :nodes="tree" :selected-path="selectedPath" @open="openNote" />
        <p v-if="!tree.length" class="empty-tree">库内暂无笔记。可点「新建笔记」，或在文件夹中放入 <code>.md</code>。</p>
      </div>
    </aside>

    <section class="editor-pane" :class="{ editing: editorMode === 'edit' }">
      <header class="editor-toolbar">
        <button
          type="button"
          class="ghost compact"
          :aria-label="sidebarOpen ? '隐藏侧栏' : '显示侧栏'"
          @click="sidebarOpen = !sidebarOpen"
        >
          {{ sidebarOpen ? '隐藏侧栏' : '显示侧栏' }}
        </button>
        <div class="note-meta">
          <strong v-if="selectedPath">{{ noteTitle }}</strong>
          <span v-else>未打开笔记</span>
          <em v-if="dirty">未保存</em>
          <em v-else-if="status">{{ status }}</em>
        </div>
        <div class="toolbar-actions" v-if="selectedPath">
          <span class="mode-pill">{{ editorMode === 'preview' ? '预览' : '编辑' }}</span>
          <button v-if="editorMode === 'preview'" type="button" class="primary compact" @click="enterEdit">编辑</button>
          <template v-else>
            <button type="button" class="ghost compact" :disabled="busy || !dirty" @click="saveCurrent">保存</button>
            <button type="button" class="primary compact" :disabled="busy" @click="leaveEdit">完成</button>
          </template>
        </div>
      </header>

      <div v-if="selectedPath" class="editor-body">
        <V5Editor
          v-model="content"
          locale="zh-CN"
          placeholder="开始写作…"
          :editable="editorMode === 'edit'"
        />
      </div>
      <div v-else class="editor-empty">
        <p>从左侧打开一篇笔记。打开后为预览；点「编辑」修改，切换回预览前会先保存。</p>
      </div>
    </section>
  </div>
</template>
