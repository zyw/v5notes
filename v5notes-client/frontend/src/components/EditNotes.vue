<template>
    <!-- 添加或修改目录对话框 -->
    <el-dialog 
        :title="dialog.title" 
        @close="handleClose"
        @open="handleOpen"
        v-model="dialog.visible" width="500px" append-to-body :close-on-click-modal="false">
      <el-form ref="notesFormRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="所属目录" prop="dirId">
          <el-tree-select
            v-model="form.dirId"
            :data="dirTreeData"
            value-key="id"
            default-expand-all
            check-strictly
            :render-after-expand="false"
            placeholder="请选择所属目录"
          />
        </el-form-item>
        <el-form-item label="笔记名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入笔记名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button :loading="buttonLoading" type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>
</template>
<script setup lang="ts">
    import { FormInstance as ElFormInstance } from 'element-plus'
    import { dirTree } from '@/api/dir';
    import { NotesTreeVo } from '@/api/dir/types';
    import { addNotes, updateNotes } from '@/api/notes'
    import { NotesForm } from '@/api/notes/types'
    import { useRouter } from "vue-router";
    import useLeftMenuStore from '@/stores/modules/leftMenu'
    import { MenuTypeEnum } from '@/enums/MenuTypeEnum';

    const router = useRouter()
    const leftMenuStore = useLeftMenuStore()

    interface PropType {
        notes: NotesForm;
    }

    // 接笔记单信息
    const props = withDefaults(defineProps<PropType>(), {});

    const emit = defineEmits(["addSuccess"])

    const notesFormRef = ref<ElFormInstance>();
    const buttonLoading = ref(false);
    const dialog = reactive<DialogOption>({
        visible: false,
        title: ''
    })
    const dirTreeData = ref<NotesTreeVo[]>([{
        id: 0,
        label: '根节点',
        type: 1
    } as NotesTreeVo]);
    // const initFormData = computed(() => props.user);
    const initFormData: NotesForm = {
        id: undefined,
        name: undefined,
        dirId: undefined,
    };

    let form = toRef({ ...initFormData })

    const rules = {
        dirId: [{ required: true, message: '所属目录不能为空', trigger: 'blur' }],
        name: [{ required: true, message: '笔记名称不能为空', trigger: 'blur' }]
    }

    /** 取消按钮 */
    const cancel = () => {
        reset();
        dialog.visible = false;
    };

    /** 表单重置 */
    const reset = () => {
        form.value = { ...props.notes };
        notesFormRef.value?.resetFields();
    };

    /** 提交按钮 */
    const submitForm = () => {
        notesFormRef.value?.validate(async (valid: boolean) => {
            if (valid) {
                buttonLoading.value = true;
                let res = null
                if (form.value.id) {
                    await updateNotes(form.value).finally(() =>  buttonLoading.value = false);
                    leftMenuStore.refreshList = new Date().getTime()
                } else {
                    res = await addNotes(form.value).finally(() =>  buttonLoading.value = false);
                    leftMenuStore.setLeftMenu(res.data, form.value.name, MenuTypeEnum.MENU_EDITOR)
                }
                ElMessage.success("操作成功");
                dialog.visible = false;
                reset();
                emit("addSuccess")
                if(!(form.value.id)) {
                    await router.push("/md/editor/" + res.data)
                }
            }
        });
    }

    const dirTreeList = async () => {
        const res = await dirTree()
        dirTreeData.value[0].children = res.data
    }

    const handleOpen = () => {
        dirTreeList()
        form.value = { ...props.notes }
    }

    const handleClose = () => {
        form = toRef({...initFormData})
    }

    const open = () => {
        dialog.visible = true
    }

    const close = () => {
        dialog.visible = false
    }
    // 暴露方法
    defineExpose({ open, close });
    onMounted(() => {
        // dirTreeList()
    })
</script>
<style lang="scss" scoped>
</style>