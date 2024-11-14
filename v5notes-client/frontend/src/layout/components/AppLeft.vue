<template>
    <user-info />
    <div class="pl-2 pr-2">
        <!-- <el-button type="primary" :icon="Plus" class="w-full">新建</el-button> -->
        <el-dropdown class="w-full" trigger="click" @command="handleAddFolderNotes">
            <el-button type="primary" :icon="Plus" class="w-full">
                新建
            </el-button>
            <template #dropdown>
                <el-dropdown-menu style="width: 180px;">
                    <el-dropdown-item command="1"><el-icon class="text-size-base fw-bold v-sub"><FolderAdd /></el-icon>新建目录</el-dropdown-item>
                    <el-dropdown-item command="2"><el-icon class="text-size-base fw-bold v-sub"><Tickets /></el-icon>新建笔记</el-dropdown-item>
                </el-dropdown-menu>
            </template>
        </el-dropdown>
    </div>
    <div class="pl-2 pr-2">
        <el-collapse v-model="activeNames" @change="handleChange">
            <el-collapse-item name="1" class="collapse-item-wrap">
                <template #title >
                    <div @click.stop="handleCollapseItem(1, '最新笔记')" class="w-full text-left">
                        <el-icon class="text-size-base fw-bold v-sub"><Calendar /></el-icon>
                        <span class="pl-1 text-size-sm fw-bold">最新笔记</span>
                    </div>
                    
                </template>
                <template v-if="newNotesList && newNotesList.length > 0">
                    <p
                        v-for="notes in newNotesList" 
                        :key="notes.id"
                        @click="newNodeClick(notes.id, notes.name)"
                        @contextmenu.prevent="handleContextMenu($event,notes,'new',null)" 
                        class="notes-list text item mt-1 mb-1 pl-3 lh-8 cursor-pointer text-size-sm">
                        <el-icon class="mr-1 text-size-sm va-1"><Tickets /></el-icon>{{ notes.name }}
                    </p>
                </template>
                <template v-else>
                    <p 
                        class="text item mt-1 mb-1 pl-3 lh-8 cursor-pointer text-size-sm text-align-center"
                        style="color: var(--el-text-color-secondary);">
                        还没有最新笔记
                    </p>
                </template>
                
            </el-collapse-item>
            <el-collapse-item name="2">
                <template #title>
                    <div @click.stop="handleCollapseItem(0, '全部笔记')" class="w-full text-left">
                        <el-icon class="text-size-base fw-bold v-sub"><Memo /></el-icon>
                        <span class="pl-1 text-size-sm fw-bold">全部笔记</span>
                    </div>
                </template>
                <el-tree
                    ref="treeRef"
                    style="max-width: 600px"
                    :expand-on-click-node="false"
                    :data="notesTreeList"
                    node-key="id"
                    :highlight-current="true"
                    empty-text="还没有笔记"
                    @node-click="handleNodeClick"
                    @node-contextmenu.prevent="handleContextMenu"
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
            </el-collapse-item>
        </el-collapse>
    </div>

    <RightClickMenu :menus="menus" ref="rightClickMenu" />

    <EditFolder ref="editFolderRef" @addSuccess="handleFolderAddSuccess" :editInfo="editFolder" />
    <EditNotes ref="editNotesRef" @addSuccess="handleNotesAddSuccess" :notes="editNotes" />

</template>
<script setup lang="ts">
    // import { ref } from 'vue'
    import UserInfo from '@/components/UserInfo.vue'
    import useLeftMenuStore from "@/stores/modules/leftMenu";
    import { MenuTypeEnum } from '@/enums/MenuTypeEnum'
    import { useRouter } from "vue-router";
    import { listNewNotes, delNotes } from '@/api/notes'
    import { NotesVO, NotesQuery, NotesForm } from '@/api/notes/types'
    import { delDirectory, dirNotesTree } from '@/api/dir'
    import { NotesTreeVo, EditInfoVo } from '@/api/dir/types'
    // 导入图标
    import { Plus, Memo, Calendar, Tickets, Folder, Delete, FolderAdd, Edit } from '@element-plus/icons-vue'
    import { markRaw } from 'vue';
    import { EditTypeEnum } from '@/enums/EditTypeEnum';

    const router = useRouter();
    const leftMenuStore = useLeftMenuStore()

    const treeRef = ref()
    const newNotesList = ref<NotesVO[]>()
    const notesTreeList = ref<NotesTreeVo[]>()

    const editFolderRef = ref()
    const editNotesRef = ref()
    const rightClickMenu = ref()

    // 菜单
    const menus = ref([]);

    const editNotes = ref<NotesForm>({})
    const editFolder = ref<EditInfoVo>()

    const activeNames = ref(['2'])

    watch(() => leftMenuStore.id, (newVal) => {
        if(newVal && newVal != 0 && newVal != 1) {
            treeRef.value.setCurrentKey(newVal, true)
        }
    })

    const queryNewNotesParams = reactive<PageQuery>({
        pageNum: 1,
        pageSize: 10
    })

    const newNotesListFun = async () => {
        const res = await listNewNotes(queryNewNotesParams)
        newNotesList.value = res.rows
    }

    const notesTreeListFun = async () => {
        const res = await dirNotesTree()
        notesTreeList.value = res.data
    }

    const handleChange = (val: string[]) => {
        console.log(val)
    }

    const newNodeClick = async (id: number, title: string) => {
        leftMenuStore.setLeftMenu(id, title, MenuTypeEnum.MENU_EDITOR)
        await router.push("/md/editor/" + id)
    }

    const handleNodeClick = async (data: NotesTreeVo) => {
        const type = data.type === 2 ? MenuTypeEnum.MENU_EDITOR : MenuTypeEnum.MENU_LIST
        leftMenuStore.setLeftMenu(data.id, data.label, type)
        // 节点类型，1：目录，2：笔记
        if(data.type === 2) {
            await router.push("/md/editor/" + data.id)
        } else {
            await router.push("/");
        }
    }

    const handleCollapseItem = async (id: number, title: string) => {
        leftMenuStore.setLeftMenu(id, title, MenuTypeEnum.MENU_LIST)
        await router.push("/");
    }

    const handleContextMenu = (event: any, data: any, node: any, json: any):void => {
        // 1: 目录，2：笔记
        const type = data.type || 2
        // new: 最新笔记，all：全部笔记
        const menuType = node.id ? 'all' : 'new'
        if(type === 2) {
            menus.value = [{
                icon: markRaw(Edit),
                name: "重命名",
                click: () => {
                    editNotes.value = {
                        id: data.id,
                        dirId: data.dirId || data.pid || 0,
                        name: data.label || data.name
                    }
                    editNotesRef.value.open()
                }
            }, {
                icon: markRaw(Delete),
                name: "删除",
                click: async () => {
                    ElMessageBox.confirm(
                    '确认要删除笔记【' + (data.name || data.label) + '】吗？',
                    '提示',
                    {
                        confirmButtonText: '确认',
                        cancelButtonText: '取消',
                        type: 'warning',
                    }
                    ).then(async () => {
                        await delNotes(data.id)
                        ElMessage.success("删除成功")
                        leftMenuStore.initRightMain(data.id, menuType)
                        handleNotesAddSuccess()
                        leftMenuStore.refreshList = new Date().getTime()
                    }).catch(() => {

                    })
                }
            }];
        } else if(type === 1) {
            menus.value = [{
                icon: markRaw(FolderAdd),
                name: "新增目录",
                click: () => {
                    const editInfo = {
                        dirId: data.id,
                        type: EditTypeEnum.ADD_NOT_ROOT
                    }
                    handleAddFolderNotes('1', editInfo)
                }
            }, {
                icon: markRaw(Tickets),
                name: "新增笔记",
                click: () => {
                    const editInfo = {
                        dirId: data.id,
                        type: EditTypeEnum.ADD_NOT_ROOT
                    }
                    handleAddFolderNotes('2', editInfo)
                }
            }, {
                icon: markRaw(Edit),
                name: "编辑",
                click: () => {
                    editFolder.value = {
                        dirId: data.id,
                        type: EditTypeEnum.UPDATED
                    }
                    editFolderRef.value.open()
                }
            }, {
                icon: markRaw(Delete),
                name: "删除",
                click: () => {
                    ElMessageBox.confirm(
                    '确认要删除目录【' + (data.label) + '】吗？删除目录将删除目录下的所有目录和笔记！',
                    '提示',
                    {
                        confirmButtonText: '确认',
                        cancelButtonText: '取消',
                        type: 'warning',
                    }
                    ).then(async () => {
                        await delDirectory(data.id)
                        ElMessage.success("删除成功")
                        leftMenuStore.initRightMain(data.id, menuType)
                        handleNotesAddSuccess()
                        leftMenuStore.refreshList = new Date().getTime()
                    }).catch(() => {

                    })
                }
            }];
        }
        // 打开右键菜单
        rightClickMenu.value.open(event);
    };

    const handleAddFolderNotes = (item: any, editInfo: EditInfoVo) => {
        
        if(item === '1') {
            editFolder.value = editInfo
            if(!editInfo.dirId) {
                editFolder.value = {dirId: 0, type: EditTypeEnum.ADD_ROOT} as EditInfoVo
            }
            editFolderRef.value.open()
        } else if(item === '2') {
            editNotes.value = {
                dirId: editInfo.dirId || 0
            }
            editNotesRef.value.open()
        }
    }

    const handleFolderAddSuccess = () => {
        notesTreeListFun()
    }

    const handleNotesAddSuccess = () => {
        newNotesListFun()
        notesTreeListFun()
    }

    onMounted(() => {
        handleNotesAddSuccess()
    })
</script>
<style lang="scss" scoped>
    .notes-list:hover {
        background-color: #edf2f7;
        font-weight: 700;
    }
    .collapse-item-wrap {
        :deep(.el-collapse-item__content) {
            padding-bottom: 0;
        }
    }
    .va-1 {
        vertical-align: -1px;
    }

    .el-tree {
        --el-tree-node-content-height: 34px;
    }
</style>