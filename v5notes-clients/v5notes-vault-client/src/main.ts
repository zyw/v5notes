import { createApp } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import '@v5md/view/theme.css'
import App from './App.vue'
import './styles/tokens.css'
import './styles/style.css'
import { applyAppearance, loadAppearancePrefs } from './appearance/themes'

if (isTauri()) document.documentElement.classList.add('tauri-app')
applyAppearance(loadAppearancePrefs())

createApp(App).mount('#app')
