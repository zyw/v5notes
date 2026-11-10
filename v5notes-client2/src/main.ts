import { createApp } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { V5Editor } from '@v5md/vue'
import '@v5md/view/theme.css'
import App from './App.vue'
import { i18n, installLocale } from './i18n'
import './styles/style.css'

if (isTauri()) document.documentElement.classList.add('tauri-app')
installLocale()

createApp(App).use(i18n).component('V5Editor', V5Editor).mount('#app')
