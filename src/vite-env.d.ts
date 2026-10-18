/// <reference types="vite/client" />

/** Versione dell'app (commit o data della build), definita in vite.config.ts. */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_VBG_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Versione leggibile dell'app (package.json), es. 1.0.1. */
declare const __APP_RELEASE__: string
