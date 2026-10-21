export const DEFAULT_LOCALE = "zh-CN" as const;
const SUPPORTED_LOCALES = [
  "zh-CN",
  "zh-TW",
  "ja-JP",
  "en-US",
  "ko-KR",
  "th-TH",
  "id-ID",
  "vi-VN",
  "es-ES",
  "pt-BR",
  "fr-FR",
  "de-DE",
  "ru-RU",
] as const;

export type AppLocale = typeof SUPPORTED_LOCALES[number];








