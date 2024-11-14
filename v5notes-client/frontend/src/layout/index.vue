<template>
    <div class="app-container home">
        <el-container id="dept" style="height: 100%;">
            <el-aside width="260px" id="drag-dept-left" :style="{display: isDisplay}">
                <app-left />
            </el-aside>
            <div id="dragBar-dept" class="vertical-dragbar" :style="{display: isDisplay}"></div>
            <el-main class="app-main-wraper">
                <el-container style="height: 100%;">
                <el-main class="app-main">
                    <app-main @change-display="displayLeft" />
                </el-main>
                </el-container>
            </el-main>
        </el-container>
    </div>
</template>
<script setup>
 import { onMounted } from 'vue';
 import { layoutDrag } from "../utils/commons"
 import {AppMain,AppLeft} from './components'

 const isDisplay = ref('block')

 const displayLeft = (_isDisplay) => {
  if(_isDisplay) {
    isDisplay.value = 'block';
  } else {
    isDisplay.value = 'none';
  }
 }

 onMounted(() => {
    layoutDrag("dragBar-dept")
 })
</script>
<style scoped>
  .vertical-dragbar {
      width: 3px;
      min-width: 3px;
      height: 100vh;
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
 
</style>