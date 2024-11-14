<template>
    <div class="display-left-bar win-title">
      <div class="w-200px flex justify-start">
        <button :class="{'i-lucide-panel-right-close': !leftDisplay,'i-lucide-panel-left-close': leftDisplay}" class="font-size-5 font-color m-t-[6px] cursor-pointer win-btn" @click="displayFun" />
        <div class="m-l-30px lh-35px">
          <span v-if="leftMenuStore.type === MenuTypeEnum.MENU_EDITOR" class="font-bold">{{ leftMenuStore.title }}</span>
        </div>
      </div>
      <div class="flex justify-end" style="margin-right: 13px;">
        <el-button text @click="handleWinEvent('minimize')" style="width: 40px;" class="win-btn">
          <el-icon class="font-size-4"><Minus /></el-icon>
        </el-button>
        <el-button text @click="handleWinEvent(!isMaximized ? 'maximize': 'restore')" style="margin-left: 0;" class="win-btn">
            <Maximize v-if="!isMaximized" style="width: 10px; height: 10px;"/>
            <Minimize v-else style="width: 10px; height: 10px;"/>
        </el-button>
        <el-button text @click="handleWinEvent('close')" style="margin-left: 0; width: 40px;" class="win-btn">
          <el-icon class="font-size-4"><Close /></el-icon>
        </el-button>
      </div>
    </div>
    <div class="router-view-wraper">
        <router-view/>
    </div>
</template>
<script setup lang='ts'>
  import { ipcApiRoute, specialIpcRoute } from '@/api/ipcMain';
  import { ipc as ipcRenderer } from '@/utils/ipcRenderer'
  import { Minus, Close } from "@element-plus/icons-vue";
  import { MenuTypeEnum } from "@/enums/MenuTypeEnum";
  import useLeftMenuStore from "@/stores/modules/leftMenu";
  import Maximize from '@/components/svg/Maximize.vue';
  import Minimize from '@/components/svg/Minimize.vue';
  const emit = defineEmits(['changeDisplay'])

  const leftMenuStore = useLeftMenuStore()

  const leftDisplay = ref(true)
  const isMaximized = ref(false);

  const displayFun = () => {
    leftDisplay.value = !leftDisplay.value
    emit('changeDisplay', leftDisplay.value)
  }

    // 关闭登录窗口
  const handleWinEvent = (envtName: string) => {
    if(envtName === 'maximize') {
      isMaximized.value = true
    }
    if(envtName === 'restore') {
      isMaximized.value = false
    }
    // 单向：渲染进程->主进程 invken为双向
    ipcRenderer.send(envtName);
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

  onMounted(() => {
    initIsMaximized()
  })
</script>
<style lang="scss" scoped>
  .display-left-bar {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 30px;
    padding: 0 10px;
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