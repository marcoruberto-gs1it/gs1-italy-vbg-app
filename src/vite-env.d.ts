/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VBG_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
