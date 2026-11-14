/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLIENT_ID?: string
  readonly VITE_API_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
