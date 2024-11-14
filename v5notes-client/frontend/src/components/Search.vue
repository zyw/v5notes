<template>
    <!-- 搜索对话框 -->
    <el-dialog 
        :title="dialog.title" 
        @close="handleClose"
        @open="handleOpen"
        v-model="dialog.visible" width="750px"
        append-to-body :close-on-click-modal="false">
      
        <div class="w-full">
            <el-input 
                v-model="searchValue" 
                class="w-full" 
                placeholder="搜索笔记" 
                size="large" 
                v-debounceInput:600="handleSearch"
                :prefix-icon="Search"/>
        </div>
        <el-scrollbar max-height="500px" v-loading="loading">
            <div class="w-full search-list">
                <template v-if="notesSearchList && notesSearchList.length > 0">
                    <div v-for="item in notesSearchList" :key="item.id" class="search-item cursor-pointer" @click="handleSearchItem(item)">
                        <div class="search-title">
                            <Markdown class="search-icon"/>
                            {{ item.name }}
                        </div>
                        <div class="search-content">{{ item.content }}</div>
                    </div>
                </template>
                <template v-else>
                    <div class="flex justify-center search-item-nodata">
                        没有匹配的数据
                    </div>
                </template>
            </div>
        </el-scrollbar>

      <template #footer>
        <div class="dialog-footer">
        </div>
      </template>
    </el-dialog>
</template>
<script setup lang="ts">
    // 导入图标
    import { Search } from '@element-plus/icons-vue'
    import Markdown from '@/components/svg/Markdown.vue';
    import { searchNotes } from '@/api/notes'
    import { NotesSearch, NotesVO } from '@/api/notes/types'
    import { useRouter } from "vue-router";
    import useLeftMenuStore from "@/stores/modules/leftMenu";
    import { MenuTypeEnum } from '@/enums/MenuTypeEnum';

    const router = useRouter();
    const leftMenuStore = useLeftMenuStore();

    const loading = ref(false);
    const searchValue = ref<string>('')
    const notesSearch = ref<NotesSearch>({
        dirId: undefined,
        searchValue: undefined
    })
    const notesSearchList = ref<NotesVO[]>()

    const dialog = reactive<DialogOption>({
        visible: false,
        title: '搜索'
    })

    
    const handleSearch = async () => {
        if(!searchValue.value) {
            notesSearchList.value = []
            return
        }
        loading.value = true
        notesSearch.value.searchValue = searchValue.value
        const res = await searchNotes(notesSearch.value)
        notesSearchList.value = res.data
        loading.value = false
    }

    const handleSearchItem = async (item: any) => {
        leftMenuStore.setLeftMenu(item.id, item.name, MenuTypeEnum.MENU_EDITOR)
        await router.push("/md/editor/" + item.id)
        close()
    }

    const handleOpen = () => {
        
    }

    const handleClose = () => {
        
    }

    const open = () => {
        dialog.visible = true
    }

    const close = () => {
        dialog.visible = false
    }
    // 暴露方法
    defineExpose({ open, close });
</script>
<style lang="scss" scoped>
    .search-list {
        margin-top: 10px;
        overflow-x: hidden;
        overflow-y: auto;
    }
    .search-item {
        padding: 10px 10px;
        border-radius: 5px;
        border-bottom: 1px solid #eceff4;
    }
    .search-item:hover {
        background-color: #edf2f7;
    }
    .search-item-nodata {
        padding-top: 20px;
        color: var(--el-text-color-secondary);
    }
    .search-icon {
        width: 18px;
        height: 18px;
        margin-right: 5px;
    }
    .search-title {
        margin-bottom: 5px;
        display: flex;
        align-items: center;
    }
    .search-content {
        padding-left: 22px;
        font-size: 12px;
        color: #7a8599;
    }
</style>