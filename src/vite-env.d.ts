/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PUBLIC_ASSET_API?: string;
  readonly PUBLIC_CHART_SITE?: string;
  readonly PUBLIC_CUBISM_CORE?: string;
  readonly PUBLIC_CUBISM_MOTIONSYNC_CORE?: string;
  readonly PUBLIC_SPINE_RUNTIME?: string;
  readonly PUBLIC_STORY_SITE?: string;
  readonly PUBLIC_STORY_SITE_JP?: string;
  readonly PUBLIC_GAME_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}