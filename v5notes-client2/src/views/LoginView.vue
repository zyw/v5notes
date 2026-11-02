<script setup lang="ts">
defineProps<{
  server: string
  username: string
  password: string
  busy: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:server': [value: string]
  'update:username': [value: string]
  'update:password': [value: string]
  submit: []
  settings: []
}>()
</script>

<template>
  <div class="login-screen">
    <button class="login-settings-trigger" type="button" aria-label="设置" title="设置" @click="emit('settings')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Z"/><path d="m19.3 13.8 1.1.9-1.5 2.6-1.4-.5a7.7 7.7 0 0 1-1.4.8l-.2 1.5h-3l-.3-1.5a7.7 7.7 0 0 1-1.5-.8l-1.3.5-1.5-2.6 1.1-.9a7.6 7.6 0 0 1 0-1.7l-1.1-.9 1.5-2.6 1.4.5a7.7 7.7 0 0 1 1.4-.8l.2-1.5h3l.3 1.5a7.7 7.7 0 0 1 1.5.8l1.3-.5 1.5 2.6-1.1.9a7.6 7.6 0 0 1 0 1.7Z"/></svg></button>
    <div class="login-copy">
      <span class="eyebrow">V5 / NOTES</span>
      <h1>把想法<br />留在这里。</h1>
      <p>连接你的笔记空间，继续写作。</p>
    </div>
    <form class="login-card" @submit.prevent="emit('submit')">
      <span class="eyebrow">连接工作区</span>
      <label>服务器地址<input :value="server" type="url" placeholder="https://notes.example.com" required @input="emit('update:server', ($event.target as HTMLInputElement).value.trim())" /></label>
      <label>用户名<input :value="username" autocomplete="username" required @input="emit('update:username', ($event.target as HTMLInputElement).value.trim())" /></label>
      <label>密码<input :value="password" type="password" autocomplete="current-password" required @input="emit('update:password', ($event.target as HTMLInputElement).value)" /></label>
      <button class="primary" :disabled="busy">{{ busy ? '正在连接…' : '进入笔记' }}</button>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
    </form>
  </div>
</template>
