<template>
  <div class="window-controls" :class="platformClass">
    <!-- macOS 风格 - 按钮在左侧 -->
    <template v-if="windowStyle === WindowControlStyle.MAC">
      <div class="mac-controls">
        <button 
          @click="handleAction('close')" 
          @mouseenter="closeHover = true"
          @mouseleave="closeHover = false"
          class="mac-control-btn"
        >
          <MacClose :hover="closeHover" />
        </button>
        <button 
          v-if="showMinimize"
          @click="handleAction('minimize')" 
          @mouseenter="minimizeHover = true"
          @mouseleave="minimizeHover = false"
          class="mac-control-btn"
        >
          <MacMinimize :hover="minimizeHover" />
        </button>
        <button 
          v-if="showMaximize"
          @click="handleAction(isMaximized ? 'restore' : 'maximize')" 
          @mouseenter="maximizeHover = true"
          @mouseleave="maximizeHover = false"
          class="mac-control-btn"
        >
          <MacMaximize :hover="maximizeHover" :isMaximized="isMaximized" />
        </button>
      </div>
    </template>

    <!-- Windows/Linux 风格 - 按钮在右侧 -->
    <template v-else>
      <div class="win-controls">
        <button 
          v-if="showMinimize"
          @click="handleAction('minimize')" 
          class="win-control-btn"
        >
          <template v-if="windowStyle === WindowControlStyle.LINUX">
            <LinuxMinimize />
          </template>
          <template v-else>
            <el-icon class="font-size-4"><Minus /></el-icon>
          </template>
        </button>
        
        <button 
          v-if="showMaximize"
          @click="handleAction(isMaximized ? 'restore' : 'maximize')" 
          class="win-control-btn"
        >
          <template v-if="windowStyle === WindowControlStyle.LINUX">
            <LinuxMaximize :isMaximized="isMaximized" />
          </template>
          <template v-else>
            <Maximize v-if="!isMaximized" style="width: 10px; height: 10px;"/>
            <Minimize v-else style="width: 10px; height: 10px;"/>
          </template>
        </button>
        
        <button 
          @click="handleAction('close')" 
          class="win-control-btn close-btn"
        >
          <template v-if="windowStyle === WindowControlStyle.LINUX">
            <LinuxClose />
          </template>
          <template v-else>
            <el-icon class="font-size-4"><Close /></el-icon>
          </template>
        </button>
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { Minus, Close } from "@element-plus/icons-vue"
import { WindowControlStyle, getWindowControlStyle } from '@/utils/platform'
import { ipc as ipcRenderer } from '@/utils/ipcRenderer'
import Maximize from '@/components/svg/Maximize.vue'
import Minimize from '@/components/svg/Minimize.vue'
import MacClose from '@/components/svg/MacClose.vue'
import MacMinimize from '@/components/svg/MacMinimize.vue'
import MacMaximize from '@/components/svg/MacMaximize.vue'
import LinuxClose from '@/components/svg/LinuxClose.vue'
import LinuxMinimize from '@/components/svg/LinuxMinimize.vue'
import LinuxMaximize from '@/components/svg/LinuxMaximize.vue'

interface Props {
  isMaximized?: boolean
  showMaximize?: boolean
  showMinimize?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isMaximized: false,
  showMaximize: true,
  showMinimize: true
})

const emit = defineEmits<{
  action: [type: string]
}>()

// 平台检测
const windowStyle = ref<WindowControlStyle>(WindowControlStyle.WINDOWS)

// macOS 按钮悬停状态
const closeHover = ref(false)
const minimizeHover = ref(false)
const maximizeHover = ref(false)

const platformClass = computed(() => {
  return {
    'mac-style': windowStyle.value === WindowControlStyle.MAC,
    'linux-style': windowStyle.value === WindowControlStyle.LINUX,
    'windows-style': windowStyle.value === WindowControlStyle.WINDOWS
  }
})

const handleAction = (action: string) => {
  emit('action', action)
  ipcRenderer.send(action)
}

onMounted(async () => {
  windowStyle.value = await getWindowControlStyle()
})
</script>

<style lang="scss" scoped>
.window-controls {
  display: flex;
  align-items: center;
  height: 30px;
  
  &.mac-style {
    justify-content: flex-start;
    padding-left: 0;
  }
  
  &.windows-style,
  &.linux-style {
    justify-content: flex-end;
    padding-right: 0;
  }
}

.mac-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 10px; // 为 macOS 按钮添加左侧边距
}

.mac-control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  width: 12px;
  height: 12px;
  
  &:focus {
    outline: none;
  }
}

.win-controls {
  display: flex;
  align-items: center;
}

.win-control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  width: 40px;
  height: 30px;
  color: #666;
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: rgba(0, 0, 0, 0.1);
  }
  
  &.close-btn:hover {
    background-color: #e81123;
    color: white;
  }
  
  &:focus {
    outline: none;
  }
}

// 不同平台的特定样式调整
.linux-style {
  .win-control-btn {
    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }
  }
}
</style>