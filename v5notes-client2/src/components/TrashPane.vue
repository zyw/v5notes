<script setup lang="ts">
import { computed } from 'vue'
import { useWorkspaceContext } from '../hooks/workspaceContext'

const { trashRows, trashTotal, trashPage, notice, emptyTrash, changeTrashPage, restoreTrashItem, purgeTrashItem } = useWorkspaceContext()
const pageSize = 20
const pageCount = computed(() => Math.max(1, Math.ceil(trashTotal.value / pageSize)))

function kindLabel(objectType: string): string {
  return objectType === '1' ? '笔记' : '目录'
}

function summary(item: { objectType: string; noteCount: number; dirCount: number }): string {
  if (item.objectType !== '2') return ''
  return `${item.dirCount} 个目录，${item.noteCount} 篇笔记`
}
</script>

<template>
  <main class="trash-pane">
    <header class="trash-header">
      <h1>回收站</h1>
      <button class="danger-button" type="button" :disabled="!trashRows.length" @click="emptyTrash">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>清空回收站
      </button>
    </header>
    <p v-if="notice" class="notice-bar">{{ notice }}</p>
    <p v-if="!trashRows.length" class="empty-list">回收站是空的。</p>
    <ul v-else class="trash-list">
      <li v-for="item in trashRows" :key="item.id">
        <div class="trash-copy">
          <strong>{{ item.name }}</strong>
          <span>{{ kindLabel(item.objectType) }}</span>
          <span v-if="summary(item)">{{ summary(item) }}</span>
          <span>{{ item.originalPath }}</span>
          <span>{{ item.deletedTime }}</span>
          <span>剩余 {{ item.daysLeft }} 天</span>
        </div>
        <div class="trash-actions">
          <button type="button" @click="restoreTrashItem(item)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>恢复
          </button>
          <button class="danger-button" type="button" @click="purgeTrashItem(item)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="m10 11 4 4M14 11l-4 4"/></svg>彻底删除
          </button>
        </div>
      </li>
    </ul>
    <div v-if="pageCount > 1" class="trash-pager">
      <button type="button" :disabled="trashPage <= 1" @click="changeTrashPage(trashPage - 1)">上一页</button>
      <span>{{ trashPage }} / {{ pageCount }}</span>
      <button type="button" :disabled="trashPage >= pageCount" @click="changeTrashPage(trashPage + 1)">下一页</button>
    </div>
  </main>
</template>
