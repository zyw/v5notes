<script setup lang="ts">
import { useWorkspace } from '../hooks/useWorkspace'
import { provideWorkspace } from '../hooks/workspaceContext'
import LoginView from './LoginView.vue'
import WorkspaceSidebar from '../components/WorkspaceSidebar.vue'
import EditorPane from '../components/EditorPane.vue'
import TrashPane from '../components/TrashPane.vue'
import WorkspaceDialogs from '../components/WorkspaceDialogs.vue'
import NoteHistoryDialog from '../components/NoteHistoryDialog.vue'
import SettingsDialog from '../components/SettingsDialog.vue'
const state = useWorkspace()
provideWorkspace(state)
const { server, username, password, token, busy, error, login, focusMode, directoryVisible, resizingSidebar, sidebarWidth, settingsDialogOpen, openSettings, defaultDirectoryVisible, setDefaultDirectoryVisible, defaultTreeExpanded, setDefaultTreeExpanded, defaultOutlineVisible, setDefaultOutlineVisible, trashOpen } = state
</script>

<template>
  <LoginView v-if="!token" :server="server" :username="username" :password="password" :busy="busy" :error="error"
    @update:server="server = $event" @update:username="username = $event" @update:password="password = $event" @submit="login" @settings="openSettings" />
  <div v-else class="workspace" :class="{ 'directory-hidden': focusMode, 'sidebar-collapsed': !directoryVisible && !focusMode, 'focus-mode': focusMode, 'is-resizing': resizingSidebar }" :style="{ '--sidebar-width': `${sidebarWidth}px` }">
    <WorkspaceSidebar />
    <TrashPane v-if="trashOpen" />
    <EditorPane v-else />
    <WorkspaceDialogs />
    <NoteHistoryDialog />
  </div>
  <SettingsDialog v-if="settingsDialogOpen" :default-directory-visible="defaultDirectoryVisible" :default-tree-expanded="defaultTreeExpanded" :default-outline-visible="defaultOutlineVisible" @set-default-directory-visible="setDefaultDirectoryVisible" @set-default-tree-expanded="setDefaultTreeExpanded" @set-default-outline-visible="setDefaultOutlineVisible" @close="settingsDialogOpen = false" />
</template>
