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
}>()
</script>

<template>
  <div class="login-screen">
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
