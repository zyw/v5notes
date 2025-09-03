<template>
    <div class="app-container home">
        <div class="mac-controls-area win-title" v-if="isMacOS">
            <!-- <WindowControls 
                class="win-btn"
                :isMaximized="isMaximized" 
                :showMaximize="true"
                @action="handleWinEvent"
            /> -->
        </div>
        <el-container id="dept" class="win-height">
            <el-aside width="260px" id="drag-dept-left" :style="{display: isDisplay}">
                <app-left />
            </el-aside>
            <div id="dragBar-dept" class="vertical-dragbar" :style="{display: isDisplay}"></div>
            <el-main class="app-main-wraper">
                <el-container class="win-height">
                <el-main class="app-main">
                    <app-main @change-display="displayLeft" />
                </el-main>
                </el-container>
            </el-main>
        </el-container>
    </div>
</template>
<script setup lang="ts">
 import { onMounted } from 'vue';
 import { layoutDrag } from "../utils/commons"
 import {AppMain,AppLeft} from './components'
//  import WindowControls from '@/components/WindowControls.vue';
 import { isMac } from '@/utils/platform';
//  import { ipcApiRoute, specialIpcRoute } from '@/api/ipcMain';
//  import { ipc as ipcRenderer } from '@/utils/ipcRenderer';
 import useGlobalStore from "@/stores/modules/global";
 import { calcWindowHeight } from '@/utils/platform';

 const globalStore = useGlobalStore();

 const isDisplay = ref('block')
 const isMacOS = ref(false);
//  const isMaximized = ref(false);

 const displayLeft = (_isDisplay) => {
  if(_isDisplay) {
    isDisplay.value = 'block';
  } else {
    isDisplay.value = 'none';
  }
 }

 // 处理MacOS窗口事件
//  const handleWinEvent = (eventName: string) => {
//    if(eventName === 'enter-fullscreen') {
//      isMaximized.value = true
//    }
//    if(eventName === 'exit-fullscreen') {
//      isMaximized.value = false
//    }
//  }
 
//  const initIsMaximized = () => {
//   //  ipcRenderer.invoke(ipcApiRoute.winStatus).then(result => {
//   //    isMaximized.value = result
//   //  })
//    // 监听由主进程中发送的事件
//    ipcRenderer.removeAllListeners(specialIpcRoute.onUpdateMaximize);
//   //  ipcRenderer.on(specialIpcRoute.onUpdateMaximize, (event, result) => {
//   //    isMaximized.value = result
//   //  })
//  }

 const calcWinHeight = async () => {
    const indexHeight = await calcWindowHeight(120);
    const editorHeight = await calcWindowHeight(40);
    globalStore.setGlobalState('indexWinHeight', indexHeight)
    globalStore.setGlobalState('editorWinHeight', editorHeight)
 }

 onMounted(async () => {
    layoutDrag("dragBar-dept")
    isMacOS.value = await isMac()
    // initIsMaximized()
    await calcWinHeight()
 })
</script>
<style scoped>
  .mac-controls-area {
    width: 100%;
    height: 29px;
    background: var(--el-bg-color);
    border-bottom: 1px solid rgb(238,238,238);
    z-index: 1000;
    display: flex;
    align-items: center;
  }
  
  .vertical-dragbar {
      width: 3px;
      min-width: 3px;
      /* height: 100vh; */
      background: rgb(238,238,238);
      cursor: e-resize;
  }

  .app-main-wraper {
    padding: 0;
  }

  .app-main {
    padding: 0;
    position: relative;
    overflow: hidden;
  }

  .win-height {
    height: 100%;
  }
</style>