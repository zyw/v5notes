/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_ENV: string
  readonly VITE_APP_PORT: string
  readonly VITE_OFFICIAL_SERVER: string
  readonly VITE_CLIENT_ID: string
  readonly VITE_API_PUBLIC_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
