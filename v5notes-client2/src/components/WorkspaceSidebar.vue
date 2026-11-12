<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceContext } from '../hooks/workspaceContext'
import { flattenNotes, sortTree } from '../models/sidebarBrowse'
import TreeItem from './TreeItem.vue'
import TreeIcon from './TreeIcon.vue'
import brandIcon from '../assets/brand-icon.png'
const { t } = useI18n()
const { directoryVisible, focusMode, sidebarSearchVisible, scheduleSearch, runSearch, exitSearch, query, searching, notes, workspaceMenuOpen, noteGroup, noteSort, setNoteGroup, setNoteSort, openSettings, addDirectory, newNote, selectedId, openNote, directories, defaultTreeExpanded, chooseDirectory, editDirectory, deleteDirectory, addNoteInDirectory, openTreeNoteActions, currentUser, openProfile, username, logout, resizeSidebarStart, trashOpen, openTrash } = useWorkspaceContext()

const sortedTree = computed(() => sortTree(directories.value, noteSort.value))
const flatNotes = computed(() => flattenNotes(directories.value, noteSort.value))
const browseEmpty = computed(() => noteGroup.value === 'list' ? flatNotes.value.length === 0 : directories.value.length === 0)

function closeProfileMenu(event: Event): void {
  const menu = (event.currentTarget as HTMLElement).closest('details.profile-menu')
  if (!(menu instanceof HTMLDetailsElement)) return
  menu.open = false
  if (event instanceof KeyboardEvent) menu.querySelector('summary')?.focus()
}
</script>

<template>
    <aside class="sidebar">
      <div v-if="directoryVisible && !focusMode" class="sidebar-full">
      <div class="brand">
        <img class="brand-mark" :src="brandIcon" alt="" />
        <span>V5Notes</span>
      </div>
      <div class="tree-heading">
        <span v-if="!sidebarSearchVisible">{{ t('sidebar.notes') }}</span>
        <Transition name="inline-search">
        <form v-if="sidebarSearchVisible" class="search search-inline" @submit.prevent="runSearch">
          <span class="search-symbol" aria-hidden="true"><svg viewBox="0 0 20 20"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg></span>
          <input v-model="query" autofocus :placeholder="t('sidebar.searchPlaceholder')" :aria-label="t('sidebar.searchLabel')" @input="scheduleSearch" />
          <button type="button" :title="t('sidebar.closeSearch')" :aria-label="t('sidebar.closeSearch')" @click="exitSearch(); sidebarSearchVisible = false">×</button>
        </form>
        </Transition>
        <div class="workspace-controls">
          <button v-if="!sidebarSearchVisible" type="button" :title="t('sidebar.search')" :aria-label="t('sidebar.search')" @click="sidebarSearchVisible = true"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.4 4.4"/></svg></button>
          <details class="workspace-menu" :open="workspaceMenuOpen" @toggle="workspaceMenuOpen = ($event.target as HTMLDetailsElement).open">
            <summary :title="t('sidebar.noteActions')" :aria-label="t('sidebar.noteActions')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="8" cy="18" r="2"/></svg></summary>
            <div class="popover-menu view-menu">
              <button type="button" @click="addDirectory(); workspaceMenuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 6h5.8L10 8h7.5v8H2.5zM13.5 3v5M11 5.5h5"/></svg>{{ t('sidebar.newDirectory') }}</button>
              <button type="button" @click="newNote(); workspaceMenuOpen = false"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5h6l4 4V17H5zM11 2.8v4h3.7M8 10h4M8 13h4M16.5 12v5M14 14.5h5"/></svg>{{ t('sidebar.newNote') }}</button>
              <div class="menu-divider" role="separator"></div>
              <p class="menu-caption">{{ t('sidebar.groupBy') }}</p>
              <button class="menu-choice" type="button" :aria-pressed="noteGroup === 'tree'" @click="setNoteGroup('tree')"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5h5M4 10h5M4 15h5M9 5v10M12 5h4M12 10h4M12 15h4"/></svg><span>{{ t('sidebar.byTree') }}</span><svg v-if="noteGroup === 'tree'" class="menu-check" viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.2 3.4 3.4 7.2-7.4"/></svg></button>
              <button class="menu-choice" type="button" :aria-pressed="noteGroup === 'list'" @click="setNoteGroup('list')"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 5.5h12M4 10h12M4 14.5h12"/></svg><span>{{ t('sidebar.flatList') }}</span><svg v-if="noteGroup === 'list'" class="menu-check" viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.2 3.4 3.4 7.2-7.4"/></svg></button>
              <div class="menu-divider" role="separator"></div>
              <p class="menu-caption">{{ t('sidebar.sortBy') }}</p>
              <button class="menu-choice" type="button" :aria-pressed="noteSort === 'name'" @click="setNoteSort('name')"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M4 10h9M4 14h6"/></svg><span>{{ t('sidebar.byName') }}</span><svg v-if="noteSort === 'name'" class="menu-check" viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.2 3.4 3.4 7.2-7.4"/></svg></button>
              <button class="menu-choice" type="button" :aria-pressed="noteSort === 'updated'" @click="setNoteSort('updated')"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="6.2"/><path d="M10 6.8V10l2.2 1.6"/></svg><span>{{ t('sidebar.byUpdated') }}</span><svg v-if="noteSort === 'updated'" class="menu-check" viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.2 3.4 3.4 7.2-7.4"/></svg></button>
            </div>
          </details>
          <button type="button" :title="t('sidebar.newDirectory')" :aria-label="t('sidebar.newDirectory')" @click="addDirectory()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h6l2 2H20a1 1 0 0 1 1 1v7.8a1.7 1.7 0 0 1-1.7 1.7H4.7A1.7 1.7 0 0 1 3 18.3V8a.5.5 0 0 1 .5-.5Z"/><path d="M16.5 3.5v6M13.5 6.5h6"/></svg></button>
        </div>
      </div>
      <div v-if="searching" class="tree-heading search-heading"><span>{{ t('sidebar.results') }}</span><button type="button" @click="exitSearch()">{{ t('sidebar.clear') }}</button></div>
      <div v-if="searching" class="tree-scroll search-results">
        <button v-for="note in notes" :key="note.id" class="search-result" :class="{ active: selectedId === note.id }" :title="note.name" @click="openNote(note.id)">
          <TreeIcon kind="note" />
          <span class="search-result-text">
            <span class="search-result-name">{{ note.name }}</span>
            <span v-if="note.content" class="search-result-snippet">{{ note.content }}</span>
          </span>
        </button>
        <p v-if="!notes.length" class="empty-list">{{ t('sidebar.noMatches') }}</p>
      </div>
      <div v-else class="tree-scroll">
        <template v-if="noteGroup === 'tree'">
          <TreeItem
            v-for="node in sortedTree" :key="node.id" :node="node" :selected-id="selectedId" :default-tree-expanded="defaultTreeExpanded"
            @select="openNote" @directory="chooseDirectory" @add="addDirectory" @rename="editDirectory" @remove="deleteDirectory"
            @add-note="addNoteInDirectory" @note-open="(id) => openNote(id)"
            @note-rename="(id) => openTreeNoteActions(id, 'rename')" @note-delete="(id) => openTreeNoteActions(id, 'delete')"
          />
        </template>
        <template v-else>
          <TreeItem
            v-for="item in flatNotes" :key="item.note.id" :node="item.note" :hint="item.path" :selected-id="selectedId" :default-tree-expanded="defaultTreeExpanded"
            @select="openNote" @directory="chooseDirectory" @add="addDirectory" @rename="editDirectory" @remove="deleteDirectory"
            @add-note="addNoteInDirectory" @note-open="(id) => openNote(id)"
            @note-rename="(id) => openTreeNoteActions(id, 'rename')" @note-delete="(id) => openTreeNoteActions(id, 'delete')"
          />
        </template>
        <p v-if="browseEmpty" class="empty-list">{{ noteGroup === 'list' ? t('sidebar.emptyNotes') : t('sidebar.emptyTree') }}</p>
      </div>
      <button class="trash-entry" type="button" :class="{ active: trashOpen }" :aria-pressed="trashOpen" @click="openTrash">
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11"/></svg>
        <span>{{ t('sidebar.trash') }}</span>
      </button>
      <footer class="sidebar-footer">
        <details class="profile-menu" @keydown.esc.prevent="closeProfileMenu">
          <summary class="profile-trigger" :aria-label="t('sidebar.userMenu')" :title="t('sidebar.userMenu')">
            <span class="profile-avatar"><img v-if="currentUser?.avatar" :src="currentUser.avatar" alt="" /><span v-else>{{ currentUser?.nickName?.slice(0, 1) || username.slice(0, 1) || 'U' }}</span></span>
            <span class="profile-trigger-name">{{ currentUser?.nickName || username }}</span>
            <svg class="profile-trigger-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5" /></svg>
          </summary>
          <div class="popover-menu profile-popover" role="group" :aria-label="t('sidebar.userActions')">
            <button type="button" :disabled="!currentUser" @click="closeProfileMenu($event); openProfile()"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="6" r="3"/><path d="M3.5 17a6.5 6.5 0 0 1 13 0"/></svg>{{ t('sidebar.profile') }}</button>
            <button class="danger-menu-item" type="button" @click="closeProfileMenu($event); logout()"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 3H4.5A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17H8"/><path d="M11 14.5 15.5 10 11 5.5M15 10H7"/></svg>{{ t('sidebar.logout') }}</button>
          </div>
        </details>
        <button class="settings-trigger" type="button" :aria-label="t('sidebar.settings')" :title="t('sidebar.settings')" @click="openSettings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 1.72l-.06.4a2 2 0 0 1-1 1.4l-.7.4a2 2 0 0 1-1.72.2l-.38-.13a2 2 0 0 0-2.48.9l-.22.38a2 2 0 0 0 .43 2.55l.3.27a2 2 0 0 1 .66 1.6v.8a2 2 0 0 1-.66 1.6l-.3.27a2 2 0 0 0-.43 2.55l.22.38a2 2 0 0 0 2.48.9l.38-.13a2 2 0 0 1 1.72.2l.7.4a2 2 0 0 1 1 1.4l.06.4a2 2 0 0 0 2 1.72h.44a2 2 0 0 0 2-1.72l.06-.4a2 2 0 0 1 1-1.4l.7-.4a2 2 0 0 1 1.72-.2l.38.13a2 2 0 0 0 2.48-.9l.22-.38a2 2 0 0 0-.43-2.55l-.3-.27a2 2 0 0 1-.66-1.6v-.8a2 2 0 0 1 .66-1.6l.3-.27a2 2 0 0 0 .43-2.55l-.22-.38a2 2 0 0 0-2.48-.9l-.38.13a2 2 0 0 1-1.72-.2l-.7-.4a2 2 0 0 1-1-1.4l-.06-.4a2 2 0 0 0-2-1.72z"/><circle cx="12" cy="12" r="3"/></svg></button>
      </footer>
      <div class="sidebar-resize" role="separator" :aria-label="t('sidebar.resize')" aria-orientation="vertical" @pointerdown="resizeSidebarStart" />
      </div>
      <div v-else-if="!focusMode" class="sidebar-rail">
        <button class="rail-brand" type="button" :aria-label="t('sidebar.expandNotes')" :title="t('sidebar.expandNotes')" @click="directoryVisible = true"><img class="brand-mark" :src="brandIcon" alt="V5Notes" /></button>
        <button class="rail-notes" type="button" :aria-label="t('sidebar.expandNotes')" @click="directoryVisible = true"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14"/><circle cx="5" cy="5" r=".7"/><circle cx="5" cy="10" r=".7"/><circle cx="5" cy="15" r=".7"/></svg><span>{{ t('sidebar.notes') }}</span></button>
        <div class="rail-spacer" />
        <button class="rail-trash" type="button" :aria-label="t('sidebar.trash')" :title="t('sidebar.trash')" :aria-pressed="trashOpen" @click="openTrash"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11"/></svg></button>
        <button class="rail-settings" type="button" :aria-label="t('sidebar.settings')" :title="t('sidebar.settings')" @click="openSettings"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 1.72l-.06.4a2 2 0 0 1-1 1.4l-.7.4a2 2 0 0 1-1.72.2l-.38-.13a2 2 0 0 0-2.48.9l-.22.38a2 2 0 0 0 .43 2.55l.3.27a2 2 0 0 1 .66 1.6v.8a2 2 0 0 1-.66 1.6l-.3.27a2 2 0 0 0-.43 2.55l.22.38a2 2 0 0 0 2.48.9l.38-.13a2 2 0 0 1 1.72.2l.7.4a2 2 0 0 1 1 1.4l.06.4a2 2 0 0 0 2 1.72h.44a2 2 0 0 0 2-1.72l.06-.4a2 2 0 0 1 1-1.4l.7-.4a2 2 0 0 1 1.72-.2l.38.13a2 2 0 0 0 2.48-.9l.22-.38a2 2 0 0 0-.43-2.55l-.3-.27a2 2 0 0 1-.66-1.6v-.8a2 2 0 0 1 .66-1.6l.3-.27a2 2 0 0 0 .43-2.55l-.22-.38a2 2 0 0 0-2.48-.9l-.38.13a2 2 0 0 1-1.72-.2l-.7-.4a2 2 0 0 1-1-1.4l-.06-.4a2 2 0 0 0-2-1.72z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <details class="profile-menu rail-profile-menu" @keydown.esc.prevent="closeProfileMenu">
          <summary class="rail-profile" :aria-label="t('sidebar.userMenu')" :title="t('sidebar.userMenu')"><span class="profile-avatar"><img v-if="currentUser?.avatar" :src="currentUser.avatar" alt="" /><span v-else>{{ currentUser?.nickName?.slice(0, 1) || username.slice(0, 1) || 'U' }}</span></span></summary>
          <div class="popover-menu profile-popover" role="group" :aria-label="t('sidebar.userActions')">
            <button type="button" :disabled="!currentUser" @click="closeProfileMenu($event); openProfile()"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="6" r="3"/><path d="M3.5 17a6.5 6.5 0 0 1 13 0"/></svg>{{ t('sidebar.profile') }}</button>
            <button class="danger-menu-item" type="button" @click="closeProfileMenu($event); logout()"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 3H4.5A1.5 1.5 0 0 0 3 4.5v11A1.5 1.5 0 0 0 4.5 17H8"/><path d="M11 14.5 15.5 10 11 5.5M15 10H7"/></svg>{{ t('sidebar.logout') }}</button>
          </div>
        </details>
      </div>
    </aside>
</template>