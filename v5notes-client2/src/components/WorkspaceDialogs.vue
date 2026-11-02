<script setup lang="ts">
import { useWorkspaceContext } from '../hooks/workspaceContext'
const { dialog, dialogValue, dialogError, dialogBusy, submitNameDialog, closeDialog, confirmDialog, profileDialogOpen, profileAvatarUrl, profileForm, avatarBusy, uploadProfileAvatar, removeProfileAvatar, profileError, profileBusy, saveProfile, promptVisible, respond } = useWorkspaceContext()
</script>

<template>
  <div v-if="dialog" class="modal-backdrop" role="presentation" @click.self="closeDialog">
    <section class="modal crud-modal" role="dialog" aria-modal="true" :aria-label="dialog.title">
      <form v-if="dialog.kind === 'name'" @submit.prevent="submitNameDialog">
        <span class="eyebrow">{{ dialog.entity === 'note' ? 'NOTE' : 'FOLDER' }}</span>
        <h2>{{ dialog.title }}</h2>
        <label class="dialog-field">
          <span>{{ dialog.entity === 'note' ? '笔记名称' : '目录名称' }}</span>
          <input v-model="dialogValue" autofocus maxlength="100" :placeholder="dialog.entity === 'note' ? '输入笔记名称' : '输入目录名称'" />
        </label>
        <p v-if="dialogError" class="dialog-error" role="alert">{{ dialogError }}</p>
        <div class="modal-actions">
          <button type="button" :disabled="dialogBusy" @click="closeDialog">取消</button>
          <button class="primary" type="submit" :disabled="dialogBusy">{{ dialogBusy ? '正在保存…' : '保存' }}</button>
        </div>
      </form>
      <template v-else>
        <span class="eyebrow danger-eyebrow">请确认操作</span>
        <h2>{{ dialog.title }}</h2>
        <p>{{ dialog.message }}</p>
        <p v-if="dialogError" class="dialog-error" role="alert">{{ dialogError }}</p>
        <div class="modal-actions">
          <button type="button" @click="closeDialog">取消</button>
          <button class="danger-button" type="button" @click="confirmDialog">{{ dialog.confirmLabel }}</button>
        </div>
      </template>
    </section>
  </div>

  <div v-if="profileDialogOpen" class="modal-backdrop profile-backdrop" role="presentation" @click.self="profileDialogOpen = false">
    <section class="modal crud-modal profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title" @keydown.esc.stop="profileDialogOpen = false">
      <form @submit.prevent="saveProfile">
        <span class="eyebrow">ACCOUNT</span>
        <h2 id="profile-title">个人信息</h2>
        <div class="profile-avatar-editor">
          <span class="profile-avatar profile-avatar-large"><img v-if="profileAvatarUrl" :src="profileAvatarUrl" alt="个人头像预览" /><span v-else>{{ profileForm.nickName.slice(0, 1) || 'U' }}</span></span>
          <div class="avatar-actions">
            <label class="secondary-action avatar-select" :class="{ disabled: avatarBusy }">{{ avatarBusy ? '正在上传…' : '更换头像' }}<input type="file" accept="image/*" :disabled="avatarBusy" @change="uploadProfileAvatar" /></label>
            <button v-if="profileAvatarUrl || profileForm.avatar" class="quiet-action" type="button" @click="removeProfileAvatar">移除</button>
            <span class="avatar-hint">支持 JPG、PNG、GIF，最大 2 MB</span>
          </div>
        </div>
        <div class="profile-fields">
          <label class="profile-field"><span>用户名</span><input :value="profileForm.userName" disabled /></label>
          <label class="profile-field"><span>昵称</span><input v-model="profileForm.nickName" maxlength="30" required /></label>
          <label class="profile-field"><span>手机号码</span><input v-model="profileForm.phonenumber" maxlength="11" inputmode="tel" /></label>
          <label class="profile-field"><span>邮箱</span><input v-model="profileForm.email" maxlength="50" type="email" /></label>
          <fieldset class="profile-field profile-sex"><legend>性别</legend><label><input v-model="profileForm.sex" type="radio" value="0" />男</label><label><input v-model="profileForm.sex" type="radio" value="1" />女</label><label><input v-model="profileForm.sex" type="radio" value="2" />保密</label></fieldset>
          <label class="profile-field"><span>签名</span><textarea v-model="profileForm.remark" rows="2" maxlength="200" placeholder="添加一句个人签名" /></label>
        </div>
        <p v-if="profileError" class="dialog-error" role="alert">{{ profileError }}</p>
        <div class="modal-actions"><button type="button" :disabled="profileBusy" @click="profileDialogOpen = false">取消</button><button class="primary" type="submit" :disabled="profileBusy || avatarBusy">{{ profileBusy ? '正在保存…' : '保存' }}</button></div>
      </form>
    </section>
  </div>

  <div v-if="promptVisible" class="modal-backdrop" role="presentation">
    <div class="modal" role="dialog" aria-modal="true" aria-label="未保存的笔记">
      <span class="eyebrow">未保存的修改</span>
      <h2>要保留这次编辑吗？</h2>
      <p>保存成功后继续；保存失败时会留在当前笔记。</p>
      <div class="modal-actions"><button @click="respond('cancel')">继续编辑</button><button @click="respond('discard')">放弃修改</button><button class="primary" @click="respond('save')">保存并继续</button></div>
    </div>
  </div>
</template>
