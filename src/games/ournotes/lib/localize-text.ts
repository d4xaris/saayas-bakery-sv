import type { AppLocale } from "@/config/locales";

/** One MasterText.json row (leading `_` already stripped by `validateMasterTable`). */
interface MasterTextRow {
  id: string;
  japanese: string;
  english: string;
  simplifiedChinese: string;
  traditionalChinese: string;
  korean: string;
}


export type MasterTextField = Exclude<keyof MasterTextRow, "id">;

// Untranslated cells sometimes carry a text key instead of copy (english "Music_Tilte_33", "Tag_Name_Ikka").

/** Language columns in the order a UI locale reads them; release assets follow the same chain. */
export function masterTextFieldOrder(locale: AppLocale): MasterTextField[] {
  if (locale === "zh-CN") return ["simplifiedChinese", "traditionalChinese", "japanese", "english", "korean"];
  if (locale === "zh-TW") return ["traditionalChinese", "simplifiedChinese", "japanese", "english", "korean"];
  if (locale === "ja-JP") return ["japanese", "english", "simplifiedChinese", "traditionalChinese", "korean"];
  if (locale === "ko-KR") return ["korean", "english", "japanese", "simplifiedChinese", "traditionalChinese"];
  // en-US and UI-only locales (th/id/vi/es/pt/fr/de/ru, …)
  return ["english", "japanese", "simplifiedChinese", "traditionalChinese", "korean"];
}



