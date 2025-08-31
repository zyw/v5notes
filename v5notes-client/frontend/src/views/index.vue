<template>
  <div class="list-page-wrap">
    <el-container class="tools-bar">
      <div class="notes-group">
          {{leftMenuStore.title}} ({{ total }})
      </div>
      <div class="add-search-warpper">
        <el-tooltip
          effect="dark"
          content="搜索"
          placement="top">
          <el-button :icon="Search" circle @click="handleSearch" />
        </el-tooltip>
        
      </div>
    </el-container>
    <el-scrollbar :max-height="getIndexWinHeight()">
      <el-table 
        v-loading="loading"
        :data="notesList" 
        @row-click="handleRowClick" 
        stripe 
        style="width: 100%" 
        :row-style='{"cursor": "pointer"}'
        :cell-style='{"padding":"12px 0"}'>
          <el-table-column prop="name" label="文件名">
            <template #default="scope">
              <div style="display: flex; align-items: center">
                <Markdown style="width: 30px; height: 30px;"/>
                <span style="margin-left: 8px">{{ scope.row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="updateTime" label="修改时间" width="120" :formatter="updateTimeFormatter" />
          <el-table-column prop="fileSize" label="文件大小" width="120"  />
      </el-table>
      <div class="pagination-wrap">
        <pagination
          v-show="total > 0 && leftMenuStore.id !== 1" 
          :total="total" 
          v-model:page="queryParams.pageNum" 
          v-model:limit="queryParams.pageSize"
          @pagination="notesListFun"
          :background="false"
          layout="prev, pager, next" />
      </div>
    </el-scrollbar>
  </div>
  <SearchView ref="searchViewRef" />
</template>
<script setup name="NotesList" lang="ts">
  // 导入图标
  import { Search } from '@element-plus/icons-vue'
  import { useRouter } from "vue-router";
  import { listNotes } from '@/api/notes/index'
  import { NotesVO, NotesQuery } from '@/api/notes/types'
  import useLeftMenuStore from "@/stores/modules/leftMenu";
  import Markdown from '@/components/svg/Markdown.vue';
  import SearchView from '@/components/Search.vue'
  import { MenuTypeEnum } from '@/enums/MenuTypeEnum';
  import { getIndexWinHeight } from '@/utils/commons';


  const router = useRouter();
  const leftMenuStore = useLeftMenuStore();

  const notesList = ref<NotesVO[]>([]);
  const loading = ref(true);
  const total = ref(0);

  const searchViewRef = ref()

  // const isLogin = () => {
  //   const token = getToken()
  //   if(token == null || token == "" || token == undefined) {
  //     router.replace('/login');
  //   }
  // }

  const queryParams = reactive<NotesQuery>({
    dirId: leftMenuStore.id,
    pageNum: 1,
    pageSize: leftMenuStore.id === 1 ? 10 : 30
  })

  const notesListFun = async () => {
    loading.value = true;
    queryParams.pageSize = leftMenuStore.id === 1 ? 10 : 20
    const res = await listNotes(queryParams)
    notesList.value = res.rows
    total.value = res.total
    loading.value = false;
  }

  // 是否刷新列表
  watch(
      () => leftMenuStore.refreshList,
      (id: number) => {
        notesListFun()
      }
  );

  watch(
      () => leftMenuStore.id,
      (id: number) => {
        queryParams.dirId = id;
        notesListFun()
      }
  );

  const handleRowClick = async (row: any, column: any, event: Event) => {
    leftMenuStore.setLeftMenu(row.id, row.name, MenuTypeEnum.MENU_EDITOR)
    await router.push("/md/editor/" + row.id)
  }

  const updateTimeFormatter = (row: any, column: any, cellValue: any, index: number): string => {
    return row.updateTime.substr(0,11)
  }

  const handleSearch = () => {
    searchViewRef.value.open()
  }

  onMounted(async () => {
    // isLogin();
    notesListFun();
  })
</script>
<style scoped>
  .list-page-wrap {
    padding-left: 20px;
    padding-right: 20px;
  }
  .tools-bar {
      height: 80px;
      display: flex;
      justify-content: space-between;
  }
  .notes-group {
      line-height: 80px;
      font-size: 18px;
      font-weight: bold;
  }
  .add-search-warpper {
      display: flex;
      justify-content: start;
      align-items: center;
      width: 90px;
      height: 80px;
  }
  .pagination-wrap {
    display: flex;
    justify-content: center;
    margin-top: 30px;
  }
</style>