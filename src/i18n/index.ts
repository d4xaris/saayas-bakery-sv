import type { AppLocale } from "@/config/locales";
import type { MessageTree } from "@/i18n/translate";
import { enUS } from "@/i18n/messages/en-US";

// Only English exists for now; every other locale falls back to it.
const messagesByLocale: Partial<Record<AppLocale, MessageTree>> = {
  "en-US": enUS as MessageTree,
};

function getMessages(locale: AppLocale): MessageTree {
  return messagesByLocale[locale] ?? (enUS as MessageTree);
}

export function t(
  locale: AppLocale,
  key: string,
  values?: Record<string, string | number>,
): string {
  let node: string | MessageTree | undefined = getMessages(locale);
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) { node = undefined; break; }
    node = node[part];
  }
  if (typeof node !== "string") return "";
  return values
    ? node.replace(/\{(\w+)\}/g, (m, k) => (k in values ? String(values[k]) : m))
    : node;
}

export * from "@/config/locales";
