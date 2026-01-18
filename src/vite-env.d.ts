/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly ARK_API_KEY?: string;
  readonly ARK_BASE_URL?: string;
  readonly ARK_MODEL?: string;
  readonly DOUBAO_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
