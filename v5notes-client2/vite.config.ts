import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

const localEditor = process.env.V5MD_LOCAL_ROOT
const aliases = localEditor
  ? ['core', 'view', 'vue'].map(name => ({
      find: new RegExp(`^@v5md/${name}(?=/|$)`),
      replacement: path.resolve(localEditor, `packages/${name}/dist`),
    }))
  : []

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const port = Number(env.VITE_APP_PORT || 1420)

  return {
    plugins: [vue()],
    resolve: { alias: aliases },
    server: { port, strictPort: true, host: '127.0.0.1' },
    clearScreen: false,
  }
})
