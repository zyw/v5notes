import { reactive, ref } from 'vue'
import { t } from '../i18n'
import type { createApi, UserProfile, UserProfileUpdate } from '../service/api'

type NotesApi = ReturnType<typeof createApi>

export function useProfile(api: NotesApi) {
  const currentUser = ref<UserProfile | null>(null)
  const profileDialogOpen = ref(false)
  const profileBusy = ref(false)
  const avatarBusy = ref(false)
  const profileError = ref('')
  const profileAvatarUrl = ref('')
  const profileForm = reactive<UserProfileUpdate>({ userId: '', userName: '', nickName: '', avatar: '', sex: '0' })

  async function refreshProfile(): Promise<void> {
    currentUser.value = await api.userInfo()
  }

  function openProfile(): void {
    if (!currentUser.value) return
    Object.assign(profileForm, {
      userId: currentUser.value.userId,
      deptId: currentUser.value.deptId,
      userType: currentUser.value.userType,
      userName: currentUser.value.userName,
      nickName: currentUser.value.nickName || '',
      phonenumber: currentUser.value.phonenumber || '',
      email: currentUser.value.email || '',
      sex: currentUser.value.sex || '0',
      remark: currentUser.value.remark || '',
      avatar: currentUser.value.avatar || '',
    })
    profileAvatarUrl.value = currentUser.value.avatar || ''
    profileError.value = ''
    profileDialogOpen.value = true
  }

  async function uploadProfileAvatar(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    profileError.value = ''
    if (!file.type.startsWith('image/')) {
      profileError.value = t('profile.chooseImage')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      profileError.value = t('profile.avatarTooLarge')
      return
    }
    avatarBusy.value = true
    try {
      const uploaded = await api.uploadProfileImage(file)
      profileForm.avatar = uploaded.url
      profileAvatarUrl.value = uploaded.url
    } catch (cause) {
      profileError.value = cause instanceof Error ? cause.message : t('profile.avatarFailed')
    } finally {
      avatarBusy.value = false
    }
  }

  function removeProfileAvatar(): void {
    profileForm.avatar = ''
    profileAvatarUrl.value = ''
  }

  async function saveProfile(): Promise<void> {
    if (profileBusy.value) return
    profileError.value = ''
    profileForm.nickName = profileForm.nickName.trim()
    profileForm.phonenumber = profileForm.phonenumber?.trim() || ''
    profileForm.email = profileForm.email?.trim() || ''
    if (!profileForm.nickName) {
      profileError.value = t('profile.nicknameRequired')
      return
    }
    if (profileForm.nickName.length > 30) {
      profileError.value = t('profile.nicknameTooLong')
      return
    }
    if (profileForm.phonenumber && !/^1[3-9]\d{9}$/.test(profileForm.phonenumber)) {
      profileError.value = t('profile.phoneInvalid')
      return
    }
    if (profileForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)) {
      profileError.value = t('profile.emailInvalid')
      return
    }
    profileBusy.value = true
    try {
      await api.updateUserProfile({ ...profileForm })
      await refreshProfile()
      profileDialogOpen.value = false
    } catch (cause) {
      profileError.value = cause instanceof Error ? cause.message : t('profile.saveFailed')
    } finally {
      profileBusy.value = false
    }
  }

  return {
    currentUser, profileDialogOpen, profileBusy, avatarBusy, profileError,
    profileAvatarUrl, profileForm, refreshProfile, openProfile,
    uploadProfileAvatar, removeProfileAvatar, saveProfile,
  }
}
