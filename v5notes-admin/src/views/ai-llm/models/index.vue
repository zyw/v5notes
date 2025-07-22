<template>
  <div class="p-2">
    <el-tabs v-model="activeName" class="ai-llm-tabs">
      <el-tab-pane label="服务商" name="first">
        <ModelSuppliers />
      </el-tab-pane>
      <el-tab-pane label="模型列表" name="second">
        <Models />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script lang="ts" setup>
import ModelSuppliers from './model-sup.vue';
import Models from './models.vue';
import { ref } from 'vue';

const activeName = ref('first');
</script>

<style>
.ai-llm-tabs > .el-tabs__header > .el-tabs__nav-wrap:after {
  height: 1px;
}
.ai-llm-tabs > .el-tabs__header {
  margin: 0 0 0;
}
.ai-llm-tabs > .el-tabs__content {
  color: #6b778c;
  font-size: 32px;
  font-weight: 600;
}
</style>
