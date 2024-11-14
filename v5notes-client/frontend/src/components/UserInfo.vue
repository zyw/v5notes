<template>
    <div class="koi-logo flex flex-items-center p-l-20px">
        <el-dropdown trigger="click" @command="userInfoHandleCommand">
        <div class="flex w-full cursor-pointer">
            <div class="rounded-full" style="width: 34px; height: 34px;">
                <el-image class="rounded-full w-36px h-36px" :src="userStore.avatarUrl" />
            </div>
            <div class="chroma-text w-160px m-l-20px font-bold truncate tracking-1px lh-8">{{ userStore.userInfo.nickName }}</div>
            <i class="i-material-symbols-chevron-right font-size-5 icon-height"></i>
        </div>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="user">
                <i class="i-material-symbols-account-box-outline font-size-5"></i>个人信息
            </el-dropdown-item>
            <el-dropdown-item command="exit" divided>
                <i class="i-material-symbols-exit-to-app-rounded font-size-5"></i>退出
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
    <EditUserInfo ref="editUserInfoRef" />
</template>
<script setup lang="ts">
    import { MenuTypeEnum } from "@/enums/MenuTypeEnum";
    import useLeftMenuStore from "@/stores/modules/leftMenu";
    import useUserStore from "@/stores/modules/user";
    import { useRouter } from "vue-router";
    import EditUserInfo from "./EditUserInfo.vue";

    const leftMenuStore = useLeftMenuStore()
    const userStore = useUserStore();
    const router = useRouter();

    const editUserInfoRef = ref()

    const userInfoHandleCommand = async (command: string | number | object) => {
        if(command === 'exit') {
            ElMessageBox.confirm(
            '确认要退出登录吗？',
            '提示',
            {
                confirmButtonText: '确认',
                cancelButtonText: '取消',
                type: 'warning',
            }
            ).then(async () => {
                await userStore.logout()
                leftMenuStore.setLeftMenu(0, "全部笔记", MenuTypeEnum.MENU_LIST)
                router.replace('/login');
            }).catch(() => {

            })
        } else if(command === 'user') {
            editUserInfoRef.value.open()
        }
    }

</script>
<style lang="scss" scoped>
    .koi-logo {
        height: 56px;
        line-height: 56px;
    }

    .flex-items-center, .items-center {
        align-items: center;
    }

    .rounded-full {
        border-radius: 9999px;
    }

    .icon-height {
        height: 34px;
        font-weight: bold;
        color: $global-font-color;
    }
</style>