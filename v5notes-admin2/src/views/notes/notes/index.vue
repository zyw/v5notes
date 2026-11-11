<template>
  <div class="p-2 notes-page">
    <el-row :gutter="20" class="notes-layout">
      <!-- 笔记目录和笔记树：按所属账号隔离，避免多用户同名混树 -->
      <el-col :lg="5" :xs="24" class="notes-tree-col">
        <el-card shadow="hover" class="tree-panel-shell notes-tree-card">
          <el-select
            v-model="selectedUserId"
            class="tree-owner-select"
            filterable
            clearable
            :loading="ownerLoading"
            :placeholder="$t('notes.tree.selectOwner')"
            @change="handleOwnerChange"
          >
            <el-option
              v-for="item in ownerOptions"
              :key="item.userId"
              :label="ownerLabel(item)"
              :value="item.userId"
            />
          </el-select>
          <el-input
            v-model="dirAndNotesName"
            class="mt-2"
            :placeholder="$t('common.pleaseInput', { label: $t('notes.tree.searchLabel') })"
            prefix-icon="Search"
            clearable
            :disabled="!selectedUserId"
          />
          <div v-if="!selectedUserId" class="tree-empty-hint">{{ $t('notes.tree.selectOwnerHint') }}</div>
          <template v-else>
            <el-tree
              v-show="treeLoading || notesTreeList.length > 0"
              ref="notesTreeRef"
              v-loading="treeLoading"
              class="mt-2 notes-tree"
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
            <div v-if="!treeLoading && notesTreeList.length === 0" class="tree-empty-hint">{{ $t('notes.tree.emptyOwner') }}</div>
          </template>
        </el-card>
      </el-col>
      <el-col :lg="19" :xs="24" class="notes-main-col">
        <notes-list
          v-show="pageState === 'list'"
          ref="notesListRef"
          :owner-user-id="selectedUserId"
          @clear-query="handleClearQuery"
          @view-or-edtor="handleViewOrEditor"
        />
        <editor-md v-show="pageState === 'editor'" ref="notesEditorRef" />
        <preview-md v-show="pageState === 'preview'" ref="notesPreviewRef" @edit-notes="handleEditNotes" />
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="Notes" lang="ts">
import { Folder, Tickets } from '@element-plus/icons-vue';
import { useClientOwnerOptions } from '@/composables/useClientOwnerOptions';
import { dirNotesTree } from '@/api/notes/directory';
import type { NotesTreeVo } from '@/api/notes/directory/types';
import EditorMd from '@/views/notes/notes/editor-md.vue';
import NotesList from '@/views/notes/notes/notes-list.vue';
import PreviewMd from '@/views/notes/notes/preview-md.vue';

const pageState = ref('list');

const dirAndNotesName = ref('');
const selectedUserId = ref<string | number | undefined>();
const { ownerOptions, ownerLoading, ownerLabel, loadOwnerOptions } = useClientOwnerOptions();
const treeLoading = ref(false);
const notesTreeList = ref<NotesTreeVo[]>([]);

const notesTreeRef = ref<ElTreeInstance>();
const notesListRef = ref();
const notesEditorRef = ref();
const notesPreviewRef = ref();

const ensureDefaultOwner = async () => {
  await loadOwnerOptions();
  if (!selectedUserId.value && ownerOptions.value.length > 0) {
    selectedUserId.value = ownerOptions.value[0].userId;
  }
};

const notesTreeListFun = async () => {
  if (!selectedUserId.value) {
    notesTreeList.value = [];
    return;
  }
  treeLoading.value = true;
  try {
    const res = await dirNotesTree({ userId: selectedUserId.value });
    notesTreeList.value = res.data ?? [];
  } finally {
    treeLoading.value = false;
  }
};

const handleOwnerChange = async () => {
  dirAndNotesName.value = '';
  notesTreeList.value = [];
  notesTreeRef.value?.setCurrentKey(undefined);
  pageState.value = 'list';
  await notesTreeListFun();
  notesListRef.value?.applyOwner(selectedUserId.value);
};

/** 根据名称筛选目录或者笔记树 */
watchEffect(
  () => {
    notesTreeRef.value?.filter(dirAndNotesName.value);
  },
  {
    flush: 'post'
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
  if (data.type === 2) {
    pageState.value = 'preview';
    notesPreviewRef.value?.previewNotes(data.id);
  } else {
    notesListRef.value?.handleDirIdQuery(data.id);
    pageState.value = 'list';
  }
};

const handleClearQuery = () => {
  notesTreeRef.value?.setCurrentKey(undefined);
};

const handleEditNotes = (id: number) => {
  pageState.value = 'editor';
  notesEditorRef.value.notesInfo(id);
};

const handleViewOrEditor = (info: any) => {
  if (info.type === 'editor') {
    pageState.value = 'editor';
    notesEditorRef.value.notesInfo(info.notesId);
  } else {
    pageState.value = 'preview';
    notesPreviewRef.value?.previewNotes(info.notesId);
  }
};

onMounted(async () => {
  await ensureDefaultOwner();
  await notesTreeListFun();
  notesListRef.value?.applyOwner(selectedUserId.value);
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
.tree-owner-select {
  width: 100%;
}
.tree-empty-hint {
  margin-top: 16px;
  padding: 0 4px;
  font-size: 12.5px;
  line-height: 1.6;
  color: #5f7067;
}
</style>

<style lang="scss" scoped>
/* 笔记管理：左右两栏各自撑满视口，内部滚动 */
.notes-tree-col,
.notes-main-col {
  min-height: 0;
}
.notes-tree-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
.notes-tree-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.notes-tree-card :deep(.tree-owner-select),
.notes-tree-card :deep(.el-input) {
  flex: none;
}
.notes-tree-card .notes-tree {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}
.notes-tree-card .notes-tree::-webkit-scrollbar {
  width: 6px;
}
.notes-tree-card .notes-tree::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: var(--el-text-color-placeholder);
}
.notes-main-col {
  display: flex;
  flex-direction: column;
}
.notes-main-col > * {
  flex: 1;
  min-height: 0;
}
</style>

<style lang="scss" scoped>
/* 页面整体限定在视口内，左右两栏等高撑满 */
.notes-page {
  /* 76px 固定头部 + 24px .app-main 上下内边距 + 8px 余量 */
  height: calc(100vh - 76px - 24px - 8px);
  overflow: hidden;
}
.app-main.with-tags-view .notes-page {
  height: calc(100vh - 111px - 24px - 8px);
}
.notes-page .notes-layout {
  height: 100%;
  margin-bottom: 0;
}
.notes-page .notes-layout > .el-col {
  height: 100%;
  min-height: 0;
}
</style>

<style lang="scss" scoped>
/* 防止左右两栏把页面撑出滚动条 */
.notes-page .notes-layout {
  max-height: 100%;
  overflow: hidden;
}
.notes-page .notes-layout > .el-col > * {
  max-height: 100%;
}
</style>
