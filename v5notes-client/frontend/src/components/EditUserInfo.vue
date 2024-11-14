<template>
    <!-- 个人信息对话框 -->
    <el-dialog 
        :title="dialog.title" 
        v-model="dialog.visible" 
        @close="handleClose"
        @open="handleOpen"
        width="500px" append-to-body :close-on-click-modal="false">
      <el-form ref="userInfoFormRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="头像" prop="avatar">
            <UploadImage 
              v-model:imageUrl="userStore.avatarUrl"
              :file-size="2" 
              width="80px" 
              height="80px"
              :show-label="false"
              @upload-success="handleAvatarSuccess"
              @image-delete="handleAvaterDelete">
                <template #content>
                    <el-icon><Avatar /></el-icon>
                    <span>请上传头像</span>
                </template>
                <template #tip>支持JPG、PGN、GIF格式，小于2MB</template>
            </UploadImage>
        </el-form-item>
        <el-form-item label="用户名">
           <span>{{ form.userName }}</span>
        </el-form-item>
        <el-form-item label="手机" prop="phonenumber">
          <el-input v-model="form.phonenumber" placeholder="请输入目录名称" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="请输入目录名称" />
        </el-form-item>
        <el-form-item label="昵称" prop="nickName">
          <el-input v-model="form.nickName" placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item label="性别" prop="sex">
          <el-radio-group v-model="form.sex">
            <el-radio value="0">男</el-radio>
            <el-radio value="1">女</el-radio>
            <el-radio value="2">保密</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="签名" prop="remark">
          <el-input v-model="form.remark" type="textarea" placeholder="请输入描述" />
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
    import { FormInstance as ElFormInstance, FormRules } from 'element-plus'
    // 导入图标
    import { Avatar } from '@element-plus/icons-vue'
    import useUserStore from "@/stores/modules/user";
    import { updateUser } from "@/api/user"
    import { UserForm } from '@/api/user/types'
    import { FileVO } from '@/api/upload/types';

    const userStore = useUserStore();

    const emit = defineEmits(["addSuccess"])

    const userInfoFormRef = ref<ElFormInstance>();
    const buttonLoading = ref(false);
    const dialog = reactive<DialogOption>({
        visible: false,
        title: '个人信息'
    })

    const initFormData: UserForm = {
      userId: undefined,
      deptId: undefined,
      userType: undefined,
      userName: undefined,
      nickName: undefined,
      phonenumber: undefined,
      email: undefined,
      avatar: '',
      sex: '0',
      remark: undefined
    };

    let form = toRef({ ...initFormData })

    // 验证手机号码
    const validatePhone = (rule: any, value: any, callback: any) => {
      if(form.value.phonenumber == userStore.userInfo.phonenumber) {
        callback()
      }
      const phoneReg = /^1[3|4|5|6|7|8|9][0-9]\d{8}$/
      if(!phoneReg.test(value)) {
        callback(new Error('请输入正确的手机号码'))
      } else {
        callback()
      }
    }

    // 验证Email
    const validateEmail = (rule: any, value: any, callback: any) => {
      if(form.value.email == userStore.userInfo.email) {
        callback()
      }
      const emailReg = /^[A-Za-z0-9\u4e00-\u9fa5]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/
      if(!emailReg.test(value)) {
        callback(new Error('请输入正确的邮箱地址'))
      } else {
        callback()
      }
    }

    const rules = reactive<FormRules<typeof form>>({
      // @ts-ignore
      phonenumber: [{ validator: validatePhone, trigger: ['blur'] }],
      // @ts-ignore
      email: [{ validator: validateEmail, trigger: ['blur'] }],
      nickName: [{ required: true, message: '昵称不能为空', trigger: 'blur' }],
    });

    /** 取消按钮 */
    const cancel = () => {
        reset();
        dialog.visible = false;
    };

    /** 表单重置 */
    const reset = () => {
        form.value = { ...initFormData };
        userInfoFormRef.value?.resetFields();
    };

    /**
     * 提交前处理
     */
    const submitAfter = () => {
      if(form.value.phonenumber == userStore.userInfo.phonenumber) {
        form.value.phonenumber = null
      }
      if(form.value.email == userStore.userInfo.email) {
        form.value.email = null
      }
    }

    /** 提交按钮 */
    const submitForm = () => {
      userInfoFormRef.value?.validate(async (valid: boolean) => {
        if (valid) {
            buttonLoading.value = true;
            submitAfter()
            await updateUser(form.value).finally(() =>  buttonLoading.value = false);
            ElMessage.success("操作成功");
            dialog.visible = false;
            reset();
            // 更新用户信息
            await userStore.getInfo()
            emit("addSuccess")
        }
      });
    }

    const handleAvatarSuccess = (value: FileVO) => {
        form.value.avatar = value.id as string
    }

    const handleAvaterDelete = () => {
        form.value.avatar = ''
    }

    const handleOpen = async () => {
      Object.assign(form.value, userStore.userInfo);
      form.value.avatar = null;
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

    })
</script>
<style lang="scss" scoped>
</style>