<template>
    <div class="display-left-bar" :class="{'win-title': !isMacOS}">
      <div class="flex justify-start pl-10px">
        <button :class="{'i-lucide-panel-right-close': !leftDisplay,'i-lucide-panel-left-close': leftDisplay}" class="font-size-5 font-color m-t-[6px] cursor-pointer win-btn" @click="displayFun" />
        <div class="m-l-30px lh-35px">
          <span v-if="leftMenuStore.type === MenuTypeEnum.MENU_EDITOR" class="font-bold">{{ leftMenuStore.title }}</span>
        </div>
      </div>
      <WindowControls 
        v-if="!isMacOS"
        class="win-btn"
        :isMaximized="isMaximized" 
        :showMaximize="true"
        @action="handleWinEvent"
      />
    </div>
    <div class="router-view-wraper">
        <router-view/>
    </div>
</template>
<script setup lang='ts'>
  import { ipcApiRoute, specialIpcRoute, ipcEvents } from '@/api/ipcMain';
  import { ipc as ipcRenderer } from '@/utils/ipcRenderer'
  import { MenuTypeEnum } from "@/enums/MenuTypeEnum";
  import useLeftMenuStore from "@/stores/modules/leftMenu";
  import WindowControls from '@/components/WindowControls.vue';
import { isMac } from '@/utils/platform';
  
  const emit = defineEmits(['changeDisplay'])

  const leftMenuStore = useLeftMenuStore()

  const isMacOS = ref(false);
  const leftDisplay = ref(true)
  const isMaximized = ref(false);

  const displayFun = () => {
    leftDisplay.value = !leftDisplay.value
    emit('changeDisplay', leftDisplay.value)
  }

  // 处理窗口事件
  const handleWinEvent = (eventName: string) => {
    if(eventName === ipcEvents.maximize) {
      isMaximized.value = true
    }
    if(eventName === ipcEvents.restore) {
      isMaximized.value = false
    }
  }
  
  const initIsMaximized = () => {
    ipcRenderer.invoke(ipcApiRoute.winStatus).then(result => {
      isMaximized.value = result
    })
    // 监听由主进程中发送的事件
    ipcRenderer.removeAllListeners(specialIpcRoute.onUpdateMaximize);
    ipcRenderer.on(specialIpcRoute.onUpdateMaximize, (event, result) => {
      isMaximized.value = result
    })
  }

  onMounted(async () => {
    initIsMaximized()
    isMacOS.value = await isMac()
  })
</script>
<style lang="scss" scoped>
  .display-left-bar {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 30px;
    padding: 0;
    display: flex;
    justify-content: space-between;
  }
  

  
  .router-view-wraper {
    display: block;
    padding: 5px 0;
    margin-top: 30px;
  }
  .font-color {
    color: $global-font-color;
  }
  .notes-title {
    display: flex;
    margin-left: 30px;
    font-weight: bold;
    width: 50px;
    min-width: 50px;
  }
</style>