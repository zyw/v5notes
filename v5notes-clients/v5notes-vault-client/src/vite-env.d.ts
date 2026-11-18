/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLIENT_ID?: string
  readonly VITE_API_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.css?raw' {
  const content: string
  export default content
}

declare module '*.js?raw' {
  const content: string
  export default content
}
