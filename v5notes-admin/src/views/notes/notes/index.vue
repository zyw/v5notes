<template>
  <div class="p-2">
    <el-row :gutter="20">
      <!-- 笔记目录和笔记树 -->
      <el-col :lg="4" :xs="24" style="">
        <el-card shadow="hover">
          <el-input v-model="dirAndNotesName" placeholder="请输入目录或笔记名称" prefix-icon="Search" clearable />
          <el-tree
            ref="notesTreeRef"
            class="mt-2"
            node-key="id"
            :data="notesTreeList"
            :props="{ label: 'label', children: 'children' }"
            :expand-on-click-node="false"
            :filter-node-method="filterNode"
            highlight-current
            default-expand-all
            @node-click="handleNodeClick"
          >
          <template #default="{ node, data }">
              <span class="notes-list" v-if="data.type == 2">
                  <el-icon class="mr-1 va-1"><Tickets /></el-icon>
                  <span>{{ node.label }}</span>
              </span>
              <span class="notes-list" v-else>
                  <el-icon class="mr-1 va-1"><Folder /></el-icon>
                  <span>{{ node.label }}</span>
              </span>
          </template>
        </el-tree>
        </el-card>
      </el-col>
      <el-col :lg="20" :xs="24">
        <notes-list ref="notesListRef" v-if="pageState === 'list'" @clear-query="handleClearQuery"/>
        <editor-md v-else/>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="Notes" lang="ts">
import { Tickets, Folder } from '@element-plus/icons-vue'
import NotesList from '@/views/notes/notes/notes-list.vue';
import EditorMd from '@/views/notes/notes/editor-md.vue';
import { dirNotesTree } from '@/api/notes/directory';
import { NotesTreeVo } from '@/api/notes/directory/types';
import { NotesVO } from '@/api/notes/notes/types';

const { proxy } = getCurrentInstance() as ComponentInternalInstance;

const pageState = ref("list")

const dirAndNotesName = ref('');
const notesTreeList = ref<NotesTreeVo[]>()

const notesList = ref<NotesVO[]>([]);

const notesTreeRef = ref<ElTreeInstance>();
const notesListRef = ref<ElTreeInstance>();


const notesTreeListFun = async () => {
  const res = await dirNotesTree();
  notesTreeList.value = res.data;
}

/** 根据名称筛选目录或者笔记树 */
watchEffect(
  () => {
    notesTreeRef.value?.filter(dirAndNotesName.value);
  },
  {
    flush: 'post' // watchEffect会在DOM挂载或者更新之前就会触发，此属性控制在DOM元素更新后运行
  }
);

/** 通过条件过滤节点  */
const filterNode = (value: string, data: any) => {
  if (!value) return true;
  return data.label.indexOf(value) !== -1;
};

/** 节点单击事件 */
const handleNodeClick = (data: NotesTreeVo) => {
  // 节点类型，1：目录，2：笔记
  if(data.type === 2) {
      pageState.value = "editor";
  } else {
    notesListRef.value?.handleDirIdQuery(data.id);
    pageState.value = "list";
  }
};

const handleClearQuery = () => {
  notesTreeRef.value?.setCurrentKey(undefined);
}

onMounted(() => {
  notesTreeListFun();
});
</script>
<style lang="scss" scoped>
    .notes-list:hover {
        background-color: #edf2f7;
        font-weight: 700;
    }
    .va-1 {
        vertical-align: -1px;
    }
</style>