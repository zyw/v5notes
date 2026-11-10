<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useWorkspaceContext } from '../hooks/workspaceContext'
const { t } = useI18n()
const { dialog, dialogValue, dialogError, dialogBusy, submitNameDialog, closeDialog, confirmDialog, profileDialogOpen, profileAvatarUrl, profileForm, avatarBusy, uploadProfileAvatar, removeProfileAvatar, profileError, profileBusy, saveProfile, promptVisible, respond } = useWorkspaceContext()
</script>

<template>
  <div v-if="dialog" class="modal-backdrop" role="presentation" @click.self="closeDialog">
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

  <div v-if="profileDialogOpen" class="modal-backdrop profile-backdrop" role="presentation" @click.self="profileDialogOpen = false">
    <section class="modal crud-modal profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title" @keydown.esc.stop="profileDialogOpen = false">
      <form @submit.prevent="saveProfile">
        <span class="eyebrow">ACCOUNT</span>
        <h2 id="profile-title">{{ t('profile.title') }}</h2>
        <div class="profile-avatar-editor">
          <span class="profile-avatar profile-avatar-large"><img v-if="profileAvatarUrl" :src="profileAvatarUrl" :alt="t('profile.avatarAlt')" /><span v-else>{{ profileForm.nickName.slice(0, 1) || 'U' }}</span></span>
          <div class="avatar-actions">
            <label class="secondary-action avatar-select" :class="{ disabled: avatarBusy }">{{ avatarBusy ? t('images.uploading') : t('profile.changeAvatar') }}<input type="file" accept="image/*" :disabled="avatarBusy" @change="uploadProfileAvatar" /></label>
            <button v-if="profileAvatarUrl || profileForm.avatar" class="quiet-action" type="button" @click="removeProfileAvatar">{{ t('profile.remove') }}</button>
            <span class="avatar-hint">{{ t('profile.avatarHint') }}</span>
          </div>
        </div>
        <div class="profile-fields">
          <label class="profile-field"><span>{{ t('profile.username') }}</span><input :value="profileForm.userName" disabled /></label>
          <label class="profile-field"><span>{{ t('profile.nickname') }}</span><input v-model="profileForm.nickName" maxlength="30" required /></label>
          <label class="profile-field"><span>{{ t('profile.phone') }}</span><input v-model="profileForm.phonenumber" maxlength="11" inputmode="tel" /></label>
          <label class="profile-field"><span>{{ t('profile.email') }}</span><input v-model="profileForm.email" maxlength="50" type="email" /></label>
          <fieldset class="profile-field profile-sex"><legend>{{ t('profile.sex') }}</legend><label><input v-model="profileForm.sex" type="radio" value="0" />{{ t('profile.male') }}</label><label><input v-model="profileForm.sex" type="radio" value="1" />{{ t('profile.female') }}</label><label><input v-model="profileForm.sex" type="radio" value="2" />{{ t('profile.private') }}</label></fieldset>
          <label class="profile-field"><span>{{ t('profile.signature') }}</span><textarea v-model="profileForm.remark" rows="2" maxlength="200" :placeholder="t('profile.signaturePlaceholder')" /></label>
        </div>
        <p v-if="profileError" class="dialog-error" role="alert">{{ profileError }}</p>
        <div class="modal-actions"><button type="button" :disabled="profileBusy" @click="profileDialogOpen = false">{{ t('common.cancel') }}</button><button class="primary" type="submit" :disabled="profileBusy || avatarBusy">{{ profileBusy ? t('common.saving') : t('common.save') }}</button></div>
      </form>
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
