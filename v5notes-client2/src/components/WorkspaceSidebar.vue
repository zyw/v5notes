<script setup lang="ts">
import { useWorkspaceContext } from '../hooks/workspaceContext'
import TreeItem from './TreeItem.vue'
import TreeIcon from './TreeIcon.vue'
import brandIcon from '../assets/brand-icon.png'
const { directoryVisible, focusMode, sidebarSearchVisible, runSearch, query, searching, notes, workspaceMenuOpen, addDirectory, newNote, selectedId, openNote, directories, chooseDirectory, editDirectory, deleteDirectory, addNoteInDirectory, openTreeNoteActions, currentUser, openProfile, username, logout, resizeSidebarStart } = useWorkspaceContext()
</script>

<template>
    <aside class="sidebar">
      <div v-if="directoryVisible && !focusMode" class="sidebar-full">
      <div class="brand">
        <img class="brand-mark" :src="brandIcon" alt="" />
        <span>V5Notes</span>
      </div>
      <div class="tree-heading">
        <span v-if="!sidebarSearchVisible">笔记</span>
        <Transition name="inline-search">
        <form v-if="sidebarSearchVisible" class="search search-inline" @submit.prevent="runSearch">
          <span class="search-symbol" aria-hidden="true"><svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg></span>
          <input v-model="query" autofocus placeholder="搜索笔记名称" aria-label="搜索笔记" @input="runSearch" />
          <button type="button" title="关闭搜索" aria-label="关闭搜索" @click="query = ''; searching = false; notes = []; sidebarSearchVisible = false">×</button>
        </form>
        </Transition>
        <div class="workspace-controls">
          <button v-if="!sidebarSearchVisible" type="button" title="搜索" aria-label="搜索" @click="sidebarSearchVisible = true"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.4 4.4"/></svg></button>
          <details class="workspace-menu" :open="workspaceMenuOpen" @toggle="workspaceMenuOpen = ($event.target as HTMLDetailsElement).open">
            <summary title="笔记操作" aria-label="笔记操作"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/></svg></summary>
            <div class="popover-menu">
              <button type="button" @click="addDirectory(); workspaceMenuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 6h5.8L10 8h7.5v8H2.5zM13.5 3v5M11 5.5h5"/></svg>新建目录</button>
              <button type="button" @click="newNote(); workspaceMenuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5h6l4 4V17H5zM11 2.8v4h3.7M8 10h4M8 13h4M16.5 12v5M14 14.5h5"/></svg>新建笔记</button>
            </div>
          </details>
          <button type="button" title="新建目录" aria-label="新建目录" @click="addDirectory()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h6l2 2H20a1 1 0 0 1 1 1v7.8a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 18.3V8a.5.5 0 0 1 .5-.5Z"/><path d="M16.5 3.5v6M13.5 6.5h6"/></svg></button>
        </div>
      </div>
      <div v-if="searching" class="tree-heading search-heading"><span>搜索结果</span><button @click="searching = false; query = ''">清除</button></div>
      <div v-if="searching" class="tree-scroll search-results">
        <button v-for="note in notes" :key="note.id" class="search-result" :class="{ active: selectedId === note.id }" :title="note.name" @click="openNote(note.id)">
          <TreeIcon kind="note" /><span>{{ note.name }}</span>
        </button>
        <p v-if="!notes.length" class="empty-list">没有找到匹配的笔记。</p>
      </div>
      <div v-else class="tree-scroll">
        <TreeItem
          v-for="node in directories" :key="node.id" :node="node" :selected-id="selectedId"
          @select="openNote" @directory="chooseDirectory" @add="addDirectory" @rename="editDirectory" @remove="deleteDirectory"
          @add-note="addNoteInDirectory" @note-open="(id) => openNote(id)"
          @note-rename="(id) => openTreeNoteActions(id, 'rename')" @note-delete="(id) => openTreeNoteActions(id, 'delete')"
        />
        <p v-if="!directories.length" class="empty-list">还没有目录或笔记。</p>
      </div>
      <footer class="sidebar-footer">
        <button class="profile-trigger" type="button" :disabled="!currentUser" @click="openProfile" title="个人信息">
          <span class="profile-avatar"><img v-if="currentUser?.avatarUrl" :src="currentUser.avatarUrl" alt="" /><span v-else>{{ currentUser?.nickName?.slice(0, 1) || username.slice(0, 1) || 'U' }}</span></span>
          <span class="profile-trigger-name">{{ currentUser?.nickName || username }}</span>
        </button>
        <button class="logout-action" type="button" @click="logout">退出登录</button>
      </footer>
      <div class="sidebar-resize" role="separator" aria-label="调整侧栏宽度" aria-orientation="vertical" @pointerdown="resizeSidebarStart" />
      </div>
      <div v-else-if="!focusMode" class="sidebar-rail">
        <button class="rail-brand" type="button" aria-label="展开笔记栏" title="展开笔记栏" @click="directoryVisible = true"><img class="brand-mark" :src="brandIcon" alt="V5Notes" /></button>
        <button class="rail-notes" type="button" aria-label="展开笔记栏" @click="directoryVisible = true"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14"/><circle cx="5" cy="5" r=".7"/><circle cx="5" cy="10" r=".7"/><circle cx="5" cy="15" r=".7"/></svg><span>笔记</span></button>
        <div class="rail-spacer" />
        <button class="rail-profile" type="button" :disabled="!currentUser" aria-label="个人信息" title="个人信息" @click="openProfile"><span class="profile-avatar"><img v-if="currentUser?.avatarUrl" :src="currentUser.avatarUrl" alt="" /><span v-else>{{ currentUser?.nickName?.slice(0, 1) || username.slice(0, 1) || 'U' }}</span></span></button>
      </div>
    </aside>
</template>
