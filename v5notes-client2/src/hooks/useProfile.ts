import { computed, reactive, ref } from 'vue'
import { t } from '../i18n'
import { formatBytes } from '../models/appUpdate'
import type { ClientQuota, createApi, UserProfile, UserProfileUpdate } from '../service/api'

type NotesApi = ReturnType<typeof createApi>

type ProfileFormState = UserProfileUpdate & {
  userName: string
  remark: string
}

export type CloudPlanKind = 'unlimited' | 'trial' | 'trialExpired' | 'plan'

function formatProfileDate(value?: string | null): string {
  if (!value) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return value.trim()
  return `${match[1]}-${match[2]}-${match[3]}`
}

export function useProfile(api: NotesApi) {
  const currentUser = ref<UserProfile | null>(null)
  const profileDialogOpen = ref(false)
  const profileBusy = ref(false)
  const avatarBusy = ref(false)
  const profileError = ref('')
  const profileAvatarUrl = ref('')
  const accountQuota = ref<ClientQuota | null>(null)
  const profileForm = reactive<ProfileFormState>({
    userName: '',
    nickName: '',
    phoneNumber: '',
    email: '',
    gender: '0',
    avatar: '',
    remark: '',
  })

  const cloudPlanKind = computed<CloudPlanKind>(() => {
    const quota = accountQuota.value
    if (!quota) return 'unlimited'
    if (quota.planName) return 'plan'
    if (!quota.limited) return 'unlimited'
    return quota.expired ? 'trialExpired' : 'trial'
  })

  const cloudStorageLabel = computed(() => {
    const quota = accountQuota.value
    if (!quota) return ''
    const used = formatBytes(quota.usedBytes || 0)
    if (!quota.limited && !quota.planName) return used
    if (quota.quotaBytes > 0) return `${used} / ${formatBytes(quota.quotaBytes)}`
    return used
  })

  const cloudStoragePercent = computed(() => {
    const quota = accountQuota.value
    if (!quota || quota.quotaBytes <= 0) return 0
    if (!quota.limited && !quota.planName) return 0
    return Math.min(100, Math.round((Math.max(0, quota.usedBytes) / quota.quotaBytes) * 100))
  })

  const cloudExpireLabel = computed(() => {
    const quota = accountQuota.value
    if (!quota) return ''
    if (quota.planName) return formatProfileDate(quota.planExpireAt)
    if (quota.limited) return formatProfileDate(quota.expireAt)
    return ''
  })

  async function refreshProfile(): Promise<void> {
    currentUser.value = await api.userInfo()
  }

  function fillProfileForm(profile: UserProfile): void {
    Object.assign(profileForm, {
      userName: profile.userName || '',
      nickName: profile.nickName || '',
      phoneNumber: profile.phoneNumber || '',
      email: profile.email || '',
      gender: profile.gender || '0',
      avatar: profile.avatar || '',
      remark: profile.remark || '',
    })
    profileAvatarUrl.value = profile.avatar || ''
  }

  async function openProfile(): Promise<void> {
    if (!currentUser.value) return
    fillProfileForm(currentUser.value)
    profileError.value = ''
    profileDialogOpen.value = true
    profileBusy.value = true
    try {
      const [profile, quota] = await Promise.all([
        // 走个人中心接口，避免 getInfo 对无 system:user:edit 权限用户脱敏手机号/邮箱
        api.userProfile(),
        api.quota().catch(() => null),
      ])
      currentUser.value = {
        ...currentUser.value,
        ...profile,
        userId: profile.userId || currentUser.value.userId,
      }
      fillProfileForm(currentUser.value)
      accountQuota.value = quota
    } catch (cause) {
      profileError.value = cause instanceof Error ? cause.message : t('profile.saveFailed')
    } finally {
      profileBusy.value = false
    }
  }

  function closeProfile(): void {
    if (profileBusy.value || avatarBusy.value) return
    profileDialogOpen.value = false
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
    profileForm.phoneNumber = profileForm.phoneNumber?.trim() || ''
    profileForm.email = profileForm.email?.trim() || ''
    if (!profileForm.nickName) {
      profileError.value = t('profile.nicknameRequired')
      return
    }
    if (profileForm.nickName.length > 30) {
      profileError.value = t('profile.nicknameTooLong')
      return
    }
    if (profileForm.phoneNumber && !/^1[3-9]\d{9}$/.test(profileForm.phoneNumber)) {
      profileError.value = t('profile.phoneInvalid')
      return
    }
    if (profileForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email)) {
      profileError.value = t('profile.emailInvalid')
      return
    }
    profileBusy.value = true
    try {
      const payload: UserProfileUpdate = {
        nickName: profileForm.nickName,
        gender: profileForm.gender || '0',
        avatar: profileForm.avatar || '',
      }
      // 空串会触发后端 @Pattern，未填写时省略字段
      if (profileForm.phoneNumber) payload.phoneNumber = profileForm.phoneNumber
      if (profileForm.email) payload.email = profileForm.email
      await api.updateUserProfile(payload)
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
    profileAvatarUrl, profileForm, accountQuota, cloudPlanKind, cloudStorageLabel,
    cloudStoragePercent, cloudExpireLabel, refreshProfile, openProfile, closeProfile,
    uploadProfileAvatar, removeProfileAvatar, saveProfile,
  }
}
