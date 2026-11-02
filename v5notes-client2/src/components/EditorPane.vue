<script setup lang="ts">
import { useWorkspaceContext } from '../hooks/workspaceContext'
const { sessionExpired, reauthenticate, error, draft, directoryVisible, focusMode, toggleSidebar, editorMode, outlineVisible, editorInstance, activeActionMenu, syncActionMenu, renameNote, copyNoteContent, deleteNote, finishEditing, save, editorHost, selectedId, content, api, editorReady, newNote } = useWorkspaceContext()
</script>

<template>
    <main class="editor-pane">
      <div v-if="sessionExpired" class="session-alert">登录已过期；草稿仍在当前窗口。请重新登录后保存。<button @click="reauthenticate">重新登录</button></div>
      <div v-if="error" class="error-bar" role="alert">{{ error }} <button @click="error = ''">×</button></div>
      <template v-if="draft.note">
        <header class="editor-header">
          <div class="editor-toolbar-left">
            <button class="toolbar-icon sidebar-toggle" :aria-pressed="directoryVisible && !focusMode" :aria-label="directoryVisible ? '收起侧栏' : '展开侧栏'" :title="directoryVisible ? '收起侧栏' : '展开侧栏'" @click="toggleSidebar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M9 4v16"/><path v-if="directoryVisible" d="m15 9-3 3 3 3"/><path v-else d="m12 9 3 3-3 3"/></svg>
            </button>
            <span class="breadcrumb"><span>{{ focusMode ? '专注写作' : '笔记' }}</span><span aria-hidden="true">/</span><strong>{{ draft.note.name }}</strong></span>
          </div>
          <div class="actions">
            <template v-if="editorMode === 'preview'">
              <span class="mode-label">预览</span>
              <span v-if="draft.dirty" class="save-state unsaved"><i />未保存</span>
              <button class="quiet-action" :aria-pressed="outlineVisible" @click="outlineVisible = !outlineVisible; editorInstance?.setOutlineVisible(outlineVisible)">{{ outlineVisible ? '隐藏大纲' : '显示大纲' }}</button>
              <button class="primary edit-button" @click="editorMode = 'edit'">编辑</button>
            </template>
            <template v-else>
              <span class="mode-label">编辑</span>
              <span class="save-state" :class="{ unsaved: draft.dirty }"><i />{{ draft.dirty ? '未保存' : '已保存' }}</span>
              <details class="action-menu" data-action-menu="note" :open="activeActionMenu === 'note'" @toggle="syncActionMenu('note', $event)"><summary>笔记操作</summary><div class="popover-menu" @click="activeActionMenu = null"><button @click="renameNote"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m12.8 3.2 4 4M3 17l3.8-.8L16 7a1.4 1.4 0 0 0-2-2L4.8 14.2z"/></svg>重命名</button><button @click="copyNoteContent"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="6" width="10" height="11" rx="1.5"/><path d="M13 6V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3"/></svg>复制内容</button><button class="danger-menu-item" @click="deleteNote"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11M8.5 8.5v5M11.5 8.5v5"/></svg>删除笔记</button></div></details>
              <details class="action-menu" data-action-menu="view" :open="activeActionMenu === 'view'" @toggle="syncActionMenu('view', $event)"><summary>视图</summary><div class="popover-menu" @click="activeActionMenu = null"><button @click="outlineVisible = !outlineVisible; editorInstance?.setOutlineVisible(outlineVisible)"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h2M8 5h9M3 10h2M8 10h9M3 15h2M8 15h9"/></svg>{{ outlineVisible ? '隐藏大纲' : '显示大纲' }}</button><button @click="focusMode = !focusMode"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/></svg>{{ focusMode ? '退出专注' : '专注写作' }}</button><button @click="finishEditing"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 10s2.7-5 7.5-5 7.5 5 7.5 5-2.7 5-7.5 5-7.5-5-7.5-5Z"/><circle cx="10" cy="10" r="2"/></svg>预览模式</button></div></details>
              <button class="primary save-button" :disabled="!draft.dirty" @click="save">保存 <kbd>⌘S / Ctrl+S</kbd></button>
            </template>
          </div>
        </header>
        <div class="editor-scroll" :class="{ 'preview-scroll': editorMode === 'preview', 'edit-scroll': editorMode === 'edit' }">
          <div class="editor-paper">
            <div ref="editorHost" class="editor-mount">
              <V5Editor :key="selectedId" v-model="content" placeholder="开始编写…" :on-upload-image="api.upload" :on-ready="editorReady" />
            </div>
          </div>
        </div>
      </template>
      <div v-else class="empty-editor">
        <span class="empty-mark">✳</span><p class="eyebrow">V5 NOTES</p><h2>选择一篇笔记开始阅读</h2><p>从左侧目录树打开笔记。笔记默认以预览模式显示，需要修改时再进入编辑。</p>
        <div class="empty-actions"><button class="primary" @click="newNote">新建笔记</button><button class="secondary-action" @click="directoryVisible = true">显示目录</button></div>
      </div>
    </main>
</template>
