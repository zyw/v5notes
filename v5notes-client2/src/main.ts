import { createApp } from 'vue'
import { V5Editor } from '@v5md/vue'
import '@v5md/view/theme.css'
import App from './App.vue'
import './styles/style.css'

createApp(App).component('V5Editor', V5Editor).mount('#app')
