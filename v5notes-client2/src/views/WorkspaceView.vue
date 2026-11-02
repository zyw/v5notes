<script setup lang="ts">
import { useWorkspace } from '../hooks/useWorkspace'
import { provideWorkspace } from '../hooks/workspaceContext'
import LoginView from './LoginView.vue'
import WorkspaceSidebar from '../components/WorkspaceSidebar.vue'
import EditorPane from '../components/EditorPane.vue'
import WorkspaceDialogs from '../components/WorkspaceDialogs.vue'
const state = useWorkspace()
provideWorkspace(state)
const { server, username, password, token, busy, error, login, focusMode, directoryVisible, resizingSidebar, sidebarWidth } = state
</script>

<template>
  <LoginView v-if="!token" :server="server" :username="username" :password="password" :busy="busy" :error="error"
    @update:server="server = $event" @update:username="username = $event" @update:password="password = $event" @submit="login" />
  <div v-else class="workspace" :class="{ 'directory-hidden': focusMode, 'sidebar-collapsed': !directoryVisible && !focusMode, 'focus-mode': focusMode, 'is-resizing': resizingSidebar }" :style="{ '--sidebar-width': `${sidebarWidth}px` }">
    <WorkspaceSidebar />
    <EditorPane />
    <WorkspaceDialogs />
  </div>
</template>
