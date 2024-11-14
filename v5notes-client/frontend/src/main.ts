import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
// global css
import './styles/index.scss'

import store from './stores';
import router from './router';

// permission control
import './router/permission';

import App from './App.vue'

// 引入全局自定义指令
import V5NotesDirectives from "@/directives/index";

import 'virtual:uno.css';

const app = createApp(App);

app.use(ElementPlus, {
    locale: zhCn,
})

app.use(store);
app.use(router);

// 注册全局自定义指令
app.use(V5NotesDirectives);

app.mount('#app')
