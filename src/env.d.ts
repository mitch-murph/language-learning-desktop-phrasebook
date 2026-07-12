/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HMAC_SECRET: string;
  readonly VITE_LAMBDA_URL: string;
  readonly VITE_AUDIO_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
