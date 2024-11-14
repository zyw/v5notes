<template>
    <!-- 添加或修改目录对话框 -->
    <el-dialog 
        :title="dialog.title" 
        v-model="dialog.visible" 
        @close="handleClose"
        @open="handleOpen"
        width="500px" append-to-body :close-on-click-modal="false">
      <el-form ref="directoryFormRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="父目录" prop="pid">
          <el-tree-select
            v-model="form.pid"
            :data="dirTreeData"
            value-key="id"
            default-expand-all
            check-strictly
            :render-after-expand="false"
            placeholder="请选择父目录"
          />
        </el-form-item>
        <el-form-item label="目录名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入目录名称" />
        </el-form-item>
        <el-form-item label="描述" prop="descr">
          <el-input v-model="form.descr" type="textarea" placeholder="请输入描述" />
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
    import { addDirectory, updateDirectory, getDirectory, dirTree } from '@/api/dir';
    import { DirectoryForm, NotesTreeVo, EditInfoVo } from '@/api/dir/types';
    import { EditTypeEnum } from '@/enums/EditTypeEnum';

    interface PropType {
        editInfo: EditInfoVo
    }

    const props = withDefaults(defineProps<PropType>(), {
        editInfo: ()=> {return {dirId: 0, type: EditTypeEnum.ADD_ROOT} as EditInfoVo} 
    });

    const emit = defineEmits(["addSuccess"])

    const directoryFormRef = ref<ElFormInstance>();
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

    const initFormData: DirectoryForm = {
        id: undefined,
        pid: undefined,
        name: undefined,
        descr: undefined
    };

    let form = toRef({ ...initFormData })

    const rules = {
        pid: [{ required: true, message: '父目录ID不能为空', trigger: 'blur' }],
        name: [{ required: true, message: '目录名称不能为空', trigger: 'blur' }]
    }

    /** 取消按钮 */
    const cancel = () => {
        reset();
        dialog.visible = false;
    };

    /** 表单重置 */
    const reset = () => {
        form.value = { ...initFormData };
        directoryFormRef.value?.resetFields();
    };

    /** 提交按钮 */
    const submitForm = () => {
        directoryFormRef.value?.validate(async (valid: boolean) => {
            if (valid) {
                buttonLoading.value = true;
                if (form.value.id) {
                    await updateDirectory(form.value).finally(() =>  buttonLoading.value = false);
                } else {
                    await addDirectory(form.value).finally(() =>  buttonLoading.value = false);
                }
                ElMessage.success("操作成功");
                dialog.visible = false;
                reset();
                dirTreeList()
                emit("addSuccess")
            }
        });
    }

    const dirTreeList = async () => {
        const res = await dirTree()
        dirTreeData.value[0].children = res.data
    }

    const handleOpen = async () => {
        dirTreeList()
        const {dirId, type} = {...props.editInfo}
        if(type === EditTypeEnum.ADD_ROOT) {
            form.value.pid = 0
        } else if(type === EditTypeEnum.ADD_NOT_ROOT) {
            form.value.pid = dirId
        } else if(type === EditTypeEnum.UPDATED) {
            const res = await getDirectory(dirId)
            form.value = { ...res.data }
        }
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