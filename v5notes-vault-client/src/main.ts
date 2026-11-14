import { createApp } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { V5Editor } from '@v5md/vue'
import '@v5md/view/theme.css'
import App from './App.vue'
import './styles/style.css'

if (isTauri()) document.documentElement.classList.add('tauri-app')

createApp(App).component('V5Editor', V5Editor).mount('#app')
