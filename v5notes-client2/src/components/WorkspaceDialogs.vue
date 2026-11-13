<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWorkspaceContext } from '../hooks/workspaceContext'
import { providerLabelKey, providerTone } from '../models/socialAuth'
import SocialProviderIcon from './SocialProviderIcon.vue'
const { t } = useI18n()
const {
  dialog, dialogValue, dialogError, dialogBusy, submitNameDialog, closeDialog, confirmDialog,
  profileDialogOpen, profileAvatarUrl, profileForm, avatarBusy, uploadProfileAvatar, removeProfileAvatar,
  profileError, profileBusy, saveProfile, closeProfile, accountQuota, cloudPlanKind, cloudStorageLabel,
  socialBindings, socialBusy, bindableProviders, profileThirdPartyEnabled, startBindSocial, requestUnbindSocial,
  cloudStoragePercent, cloudExpireLabel, promptVisible, respond,
} = useWorkspaceContext()

const cloudBadgeLabel = computed(() => {
  switch (cloudPlanKind.value) {
    case 'plan':
      return accountQuota.value?.planName || t('profile.cloudPlan')
    case 'trialExpired':
      return t('profile.cloudTrialExpired')
    case 'trial':
      return t('profile.cloudTrial')
    case 'unlimited':
      return t('profile.cloudUnlimited')
    default:
      return t('profile.cloudLoading')
  }
})

const cloudExpireTitle = computed(() => (
  cloudPlanKind.value === 'plan' ? t('profile.cloudPlanExpire') : t('profile.cloudExpire')
))

const cloudStorageTitle = computed(() => (
  cloudPlanKind.value === 'unlimited' ? t('profile.cloudStorageUnlimited') : t('profile.cloudStorage')
))

const cloudSectionClass = computed(() => (
  cloudPlanKind.value ? `is-${cloudPlanKind.value}` : 'is-loading'
))
</script>

<template>
  <div v-if="profileDialogOpen" class="modal-backdrop settings-backdrop" role="presentation" @click.self="closeProfile">
    <section class="modal settings-dialog profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title" aria-describedby="profile-subtitle" @keydown.esc.stop.prevent="closeProfile">
      <header class="settings-header">
        <div class="settings-heading">
          <span class="eyebrow">ACCOUNT</span>
          <h2 id="profile-title">{{ t('profile.title') }}</h2>
          <p id="profile-subtitle" class="settings-subtitle">{{ t('profile.subtitle') }}</p>
        </div>
        <button class="settings-close" type="button" :aria-label="t('profile.close')" :disabled="profileBusy || avatarBusy" @click="closeProfile">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9" /></svg>
        </button>
      </header>

      <div class="settings-body">
        <section class="settings-panel profile-hero-panel" aria-label="avatar">
          <div class="profile-hero">
            <span class="profile-avatar profile-avatar-large">
              <img v-if="profileAvatarUrl" :src="profileAvatarUrl" :alt="t('profile.avatarAlt')" />
              <span v-else>{{ profileForm.nickName.slice(0, 1) || 'U' }}</span>
            </span>
            <div class="avatar-actions">
              <label class="secondary-action avatar-select" :class="{ disabled: avatarBusy }">
                {{ avatarBusy ? t('images.uploading') : t('profile.changeAvatar') }}
                <input type="file" accept="image/*" :disabled="avatarBusy" @change="uploadProfileAvatar" />
              </label>
              <button v-if="profileAvatarUrl || profileForm.avatar" class="quiet-action" type="button" @click="removeProfileAvatar">{{ t('profile.remove') }}</button>
              <span class="avatar-hint">{{ t('profile.avatarHint') }}</span>
            </div>
          </div>
        </section>

        <section class="settings-conn profile-cloud" :class="cloudSectionClass" aria-labelledby="profile-cloud-title">
          <div class="settings-panel-head">
            <span class="settings-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="M4.8 11.2h6.8a2.6 2.6 0 0 0 .3-5.2 3.4 3.4 0 0 0-6.5-.9A2.4 2.4 0 0 0 4.8 11.2Z" /></svg>
            </span>
            <h3 id="profile-cloud-title">{{ t('profile.cloudTitle') }}</h3>
            <span class="conn-pill" :class="{
              'is-custom': cloudPlanKind === 'trial' || cloudPlanKind === 'trialExpired',
              'is-plan': cloudPlanKind === 'plan',
              'is-danger': cloudPlanKind === 'trialExpired',
            }">
              <span class="conn-dot" aria-hidden="true" />
              {{ cloudBadgeLabel }}
            </span>
          </div>

          <p v-if="!accountQuota && profileBusy" class="conn-hint">{{ t('profile.cloudLoading') }}</p>
          <div v-else-if="accountQuota" class="profile-cloud-grid">
            <div class="profile-cloud-metric profile-cloud-storage">
              <span class="profile-cloud-label">{{ cloudStorageTitle }}</span>
              <strong>{{ cloudStorageLabel || '—' }}</strong>
              <div
                v-if="cloudPlanKind !== 'unlimited'"
                class="profile-storage-bar"
                role="progressbar"
                :aria-valuenow="cloudStoragePercent"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <span :style="{ width: `${cloudStoragePercent}%` }" />
              </div>
            </div>
            <div v-if="cloudExpireLabel" class="profile-cloud-metric">
              <span class="profile-cloud-label">{{ cloudExpireTitle }}</span>
              <strong>{{ cloudExpireLabel }}</strong>
            </div>
            <div v-else-if="cloudPlanKind === 'unlimited'" class="profile-cloud-metric">
              <span class="profile-cloud-label">{{ t('profile.cloudPlan') }}</span>
              <strong>{{ t('profile.cloudUnlimited') }}</strong>
            </div>
          </div>
        </section>

        <section class="settings-panel" aria-labelledby="profile-basics-title">
          <div class="settings-panel-head">
            <span class="settings-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16"><circle cx="8" cy="5.2" r="2.4" /><path d="M3.2 13c.7-2.2 2.4-3.4 4.8-3.4s4.1 1.2 4.8 3.4" /></svg>
            </span>
            <h3 id="profile-basics-title">{{ t('profile.basicTitle') }}</h3>
          </div>
          <div class="profile-fields">
            <label class="profile-field"><span>{{ t('profile.username') }}</span><input :value="profileForm.userName" disabled /></label>
            <label class="profile-field"><span>{{ t('profile.nickname') }}</span><input v-model="profileForm.nickName" maxlength="30" /></label>
            <label class="profile-field"><span>{{ t('profile.phone') }}</span><input v-model="profileForm.phoneNumber" maxlength="11" inputmode="tel" /></label>
            <label class="profile-field"><span>{{ t('profile.email') }}</span><input v-model="profileForm.email" maxlength="50" type="email" /></label>
            <fieldset class="profile-field profile-sex">
              <legend>{{ t('profile.sex') }}</legend>
              <label><input v-model="profileForm.gender" type="radio" value="0" />{{ t('profile.male') }}</label>
              <label><input v-model="profileForm.gender" type="radio" value="1" />{{ t('profile.female') }}</label>
              <label><input v-model="profileForm.gender" type="radio" value="2" />{{ t('profile.private') }}</label>
            </fieldset>
            <label class="profile-field"><span>{{ t('profile.signature') }}</span><textarea v-model="profileForm.remark" rows="2" maxlength="200" :placeholder="t('profile.signaturePlaceholder')" /></label>
          </div>
        </section>

        <section v-if="profileThirdPartyEnabled" class="settings-panel profile-social-panel" aria-labelledby="profile-social-title">
          <div class="settings-panel-head">
            <span class="settings-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16">
                <path d="M6.4 9.6 9.6 6.4" />
                <path d="M7.1 11.3a2.5 2.5 0 0 1 0-3.5l1.5-1.5a2.5 2.5 0 1 1 3.5 3.5l-.9.9" />
                <path d="M8.9 4.7a2.5 2.5 0 0 1 0 3.5L7.4 9.7a2.5 2.5 0 1 1-3.5-3.5l.9-.9" />
              </svg>
            </span>
            <h3 id="profile-social-title">{{ t('profile.socialTitle') }}</h3>
          </div>
          <p class="profile-social-lead">{{ t('profile.socialHint') }}</p>

          <div v-if="socialBindings.length" class="profile-social-bound">
            <span class="profile-social-kicker">{{ t('profile.socialBound') }}</span>
            <ul class="profile-social-list">
              <li v-for="row in socialBindings" :key="row.id" class="profile-social-row" :data-tone="providerTone(row.source)">
                <span class="profile-social-mark" aria-hidden="true">
                  <img v-if="row.avatar" :src="row.avatar" alt="" />
                  <SocialProviderIcon v-else :source="row.source" />
                </span>
                <div class="profile-social-meta">
                  <strong>{{ t(providerLabelKey(row.source)) }}</strong>
                  <span>{{ row.userName || row.nickName || row.source }}</span>
                </div>
                <button
                  class="profile-social-unbind"
                  type="button"
                  :disabled="profileBusy || avatarBusy || socialBusy"
                  @click="requestUnbindSocial(row)"
                >
                  {{ t('profile.socialUnbind') }}
                </button>
              </li>
            </ul>
          </div>
          <p v-else class="profile-social-empty">{{ t('profile.socialEmpty') }}</p>

          <div v-if="bindableProviders.length" class="profile-social-bind">
            <span class="profile-social-kicker">{{ t('profile.socialBindable') }}</span>
            <div class="profile-social-actions">
              <button
                v-for="provider in bindableProviders"
                :key="provider.source"
                class="profile-social-chip"
                type="button"
                :data-tone="provider.tone"
                :disabled="profileBusy || avatarBusy || socialBusy"
                @click="startBindSocial(provider.source)"
              >
                <span class="profile-social-chip-icon" aria-hidden="true">
                  <SocialProviderIcon :source="provider.source" />
                </span>
                <span>{{ t(provider.labelKey) }}</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      <footer class="settings-footer profile-footer">
        <p v-if="profileError" class="dialog-error" role="alert">{{ profileError }}</p>
        <button type="button" :disabled="profileBusy || avatarBusy || socialBusy" @click="closeProfile">{{ t('common.cancel') }}</button>
        <button class="primary" type="button" :disabled="profileBusy || avatarBusy || socialBusy" @click="saveProfile">{{ profileBusy ? t('common.saving') : t('common.save') }}</button>
      </footer>
    </section>
  </div>

  <!-- Render after profile so nested confirms (e.g. social unbind) stack above it. -->
  <div v-if="dialog" class="modal-backdrop confirm-backdrop" role="presentation" @click.self="closeDialog">
    <section class="modal crud-modal" role="dialog" aria-modal="true" :aria-label="dialog.title">
      <form v-if="dialog.kind === 'name'" @submit.prevent="submitNameDialog">
        <span class="eyebrow">{{ dialog.entity === 'note' ? 'NOTE' : 'FOLDER' }}</span>
        <h2>{{ dialog.title }}</h2>
        <label class="dialog-field">
          <span>{{ dialog.entity === 'note' ? t('dialogs.noteName') : t('dialogs.directoryName') }}</span>
          <input v-model="dialogValue" autofocus maxlength="100" :placeholder="dialog.entity === 'note' ? t('dialogs.notePlaceholder') : t('dialogs.directoryPlaceholder')" />
        </label>
        <p v-if="dialogError" class="dialog-error" role="alert">{{ dialogError }}</p>
        <div class="modal-actions">
          <button type="button" :disabled="dialogBusy" @click="closeDialog">{{ t('common.cancel') }}</button>
          <button class="primary" type="submit" :disabled="dialogBusy">{{ dialogBusy ? t('common.saving') : t('common.save') }}</button>
        </div>
      </form>
      <template v-else>
        <span class="eyebrow danger-eyebrow">{{ t('common.confirmEyebrow') }}</span>
        <h2>{{ dialog.title }}</h2>
        <p>{{ dialog.message }}</p>
        <p v-if="dialogError" class="dialog-error" role="alert">{{ dialogError }}</p>
        <div class="modal-actions">
          <button type="button" @click="closeDialog">{{ t('common.cancel') }}</button>
          <button :class="dialog.danger ? 'danger-button' : 'primary'" type="button" @click="confirmDialog">{{ dialog.confirmLabel }}</button>
        </div>
      </template>
    </section>
  </div>

  <div v-if="promptVisible" class="modal-backdrop" role="presentation">
    <div class="modal" role="dialog" aria-modal="true" :aria-label="t('dialogs.unsavedLabel')">
      <span class="eyebrow">{{ t('dialogs.unsavedEyebrow') }}</span>
      <h2>{{ t('dialogs.unsavedTitle') }}</h2>
      <p>{{ t('dialogs.unsavedBody') }}</p>
      <div class="modal-actions"><button @click="respond('cancel')">{{ t('dialogs.keepEditing') }}</button><button @click="respond('discard')">{{ t('dialogs.discard') }}</button><button class="primary" @click="respond('save')">{{ t('dialogs.saveAndContinue') }}</button></div>
    </div>
  </div>
</template>
