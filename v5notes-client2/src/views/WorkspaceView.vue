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
import UpdateDialog from '../components/UpdateDialog.vue'
const state = useWorkspace()
provideWorkspace(state)
const { server, useOfficialServer, saveServerSettings, username, password, token, busy, error, login, focusMode, directoryVisible, resizingSidebar, sidebarWidth, settingsDialogOpen, openSettings, defaultDirectoryVisible, setDefaultDirectoryVisible, defaultTreeExpanded, setDefaultTreeExpanded, defaultOutlineVisible, setDefaultOutlineVisible, trashOpen, updateState, currentVersion, updateChecking, offeredVersion, releaseNotesAvailable, requestUpdateCheck, showInstalledNotes, downloadUpdate, installReadyUpdate, retryUpdate, dismissUpdateLater, closeUpdate, cancelUpdateDownload } = state
</script>

<template>
  <LoginView v-if="!token" :server="server" :use-official="useOfficialServer" :username="username" :password="password" :busy="busy" :error="error"
    @update:username="username = $event" @update:password="password = $event" @submit="login" @settings="openSettings" />
  <div v-else class="workspace" :class="{ 'directory-hidden': focusMode, 'sidebar-collapsed': !directoryVisible && !focusMode, 'focus-mode': focusMode, 'is-resizing': resizingSidebar }" :style="{ '--sidebar-width': `${sidebarWidth}px` }">
    <WorkspaceSidebar />
    <TrashPane v-if="trashOpen" />
    <EditorPane v-else />
    <WorkspaceDialogs />
    <NoteHistoryDialog />
  </div>
  <SettingsDialog v-if="settingsDialogOpen" :server="server" :use-official="useOfficialServer" :default-directory-visible="defaultDirectoryVisible" :default-tree-expanded="defaultTreeExpanded" :default-outline-visible="defaultOutlineVisible" :update-checking="updateChecking" :offered-version="offeredVersion" :release-notes-available="releaseNotesAvailable" @save-server="saveServerSettings" @set-default-directory-visible="setDefaultDirectoryVisible" @set-default-tree-expanded="setDefaultTreeExpanded" @set-default-outline-visible="setDefaultOutlineVisible" @check-update="requestUpdateCheck" @show-release-notes="showInstalledNotes" @close="settingsDialogOpen = false" />
  <UpdateDialog v-if="updateState.visible" :phase="updateState.phase" :current-version="currentVersion" @download="downloadUpdate" @install="installReadyUpdate" @retry="retryUpdate" @later="dismissUpdateLater" @close="closeUpdate" @cancel="cancelUpdateDownload" />
</template>
