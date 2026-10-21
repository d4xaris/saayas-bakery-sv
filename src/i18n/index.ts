import type { MessageTree } from "@/i18n/translate";
import { enUS } from "@/i18n/messages/en-US";

export function t(
  key: string,
  values?: Record<string, string | number>,
): string {
  let node: string | MessageTree | undefined = enUS as MessageTree;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) { node = undefined; break; }
    node = node[part];
  }
  if (typeof node !== "string") return "";
  return values
    ? node.replace(/\{(\w+)\}/g, (m, k) => (k in values ? String(values[k]) : m))
    : node;
}
