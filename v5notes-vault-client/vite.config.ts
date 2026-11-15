import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

const localEditor = process.env.V5MD_LOCAL_ROOT
const aliases: { find: string | RegExp; replacement: string }[] = localEditor
  ? ['core', 'view', 'vue'].map((name) => ({
      find: new RegExp(`^@v5md/${name}(?=/|$)`),
      replacement: path.resolve(localEditor, `packages/${name}/dist`),
    }))
  : []

aliases.push({
  find: '@v5notes/vault-plugin-api',
  replacement: path.resolve(__dirname, '../packages/vault-plugin-api/src/index.ts'),
})

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: aliases },
  // Distinct from Cloud client2 (1420) so both can run side by side.
  server: { port: 1421, strictPort: true, host: '127.0.0.1' },
  clearScreen: false,
  test: {
    environment: 'node',
  },
})
