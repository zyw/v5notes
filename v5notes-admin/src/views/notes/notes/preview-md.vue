<template>
    <div class="editor-container">
        <div class="note-title">
            <el-card shadow="hover">
                <el-text size="large">
                    <el-tooltip
                        class="box-item"
                        effect="dark"
                        content="编辑笔记"
                        placement="top">
                        <el-link :icon="Edit" @click="handleEditNotes">&nbsp;{{ notesName }}</el-link>
                    </el-tooltip>
                </el-text>
            </el-card>
        </div>
        <div class="editor-wrapper">
            <div id="previewVditor" class="vditor preview-content"></div>
        </div>
    </div>
</template>

<script setup lang="ts" name="PreviewMd">
import { onMounted } from 'vue';
import { Edit } from '@element-plus/icons-vue'
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import { getNotes } from '@/api/notes/notes'

const loading = ref();
const notesId = ref();
const notesName = ref("");
const notesContent = ref("");

const emit = defineEmits(['editNotes'])

const handlLoading =() => {
  loading.value = ElLoading.service({
      target: '.editor-container',
      lock: true,
      text: '加载中。。。',
  })
}

const previewNotes = async (id: string) => {
    handlLoading()
    let res = await getNotes(id)
    if (!!(res.data)) {
        notesName.value = res.data?.name;
        notesId.value = res.data?.id;
        notesContent.value = res.data?.content
    }
    
    Vditor.preview((document.getElementById("previewVditor") as HTMLDivElement), notesContent.value, {
        mode: "dark",
        anchor: 1
    });
    loading.value.close()
}

const handleEditNotes = () => {
    emit('editNotes', notesId.value)
}

defineExpose({ previewNotes })

onMounted(() => {
    
});
</script>
<style scoped lang="scss">
.editor-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
  background: #fff;
  border-radius: 4px;

  .note-title {
    flex: none;
    margin-bottom: 12px;
  }

  .editor-wrapper {
    flex: 1;
    overflow: hidden;
  }

  .vditor {
    height: 100%;
    border: 1px solid #e4e7ed;
  }
}
</style>
