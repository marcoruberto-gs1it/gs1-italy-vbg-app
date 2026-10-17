/// <reference types="vite/client" />

/** Versione dell'app (commit o data della build), definita in vite.config.ts. */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_VBG_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
