import { assetConfig } from "@/config/assets";
import type { AppLocale } from "@/config/locales";
import { ASSET_LANGUAGES as SERVER_ASSET_LANGUAGES, GAME_SERVER_PROFILES, GAME_SERVERS, type AssetLanguage, type GameServer } from "@/config/servers";
import { masterTextFieldOrder, type MasterTextField } from "@/games/ournotes/lib/localize-text";

// Asset-server language codes for the MasterText columns: a locale reads assets in its first text language.
const assetLanguageByField: Readonly<Record<MasterTextField, AssetLanguage>> = {
  simplifiedChinese: "zh-Hans",
  traditionalChinese: "zh-Hant",
  japanese: "ja",
  english: "en",
  korean: "ko",
};

const ASSET_LANGUAGES: readonly AssetLanguage[] = SERVER_ASSET_LANGUAGES;

function assetLanguage(locale: AppLocale): AssetLanguage {
  return assetLanguageByField[masterTextFieldOrder(locale)[0]!];
}

/** Every asset-server language code in the locale's text fallback order (the order localizeMasterText reads). */
export function assetLanguageOrder(locale: AppLocale): AssetLanguage[] {
  return masterTextFieldOrder(locale).map((field) => assetLanguageByField[field]);
}

/**
 * Published file by asset path: `/{language}/{key}/{label}.{ext}`. The service maps the path onto the newest
 * export of the key, so new exports appear without rebuilding the site; unexported paths answer 404.
 *
 * The path names the service's default region (`assetConfig.region`, the primary server's). View models keep this
 * server-neutral form, and pages move it to the server they show with serverAssetUrl.
 */
export function releaseFileUrl(key: string, fileName: string, locale: AppLocale): string {
  const segments = [assetLanguage(locale), ...key.split("/"), fileName].map(encodeURIComponent);
  return `${assetConfig.api}/${segments.join("/")}`;
}

/** Path prefix of a server's files: none for the default region, `/{region}` for the others. */
function regionPrefix(server: GameServer): string {
  const region = GAME_SERVER_PROFILES[server].assetRegion;
  return region === assetConfig.region ? "" : `/${encodeURIComponent(region)}`;
}

/**
 * The same file in `server`'s catalog: `/{region}/{language}/{key}/…`. A language the region does not publish
 * becomes its first one (the JP catalog is Japanese only). Other URLs are returned unchanged.
 */
export function serverAssetUrl(url: string, server: GameServer): string {
  const root = `${assetConfig.api}/`;
  if (!url.startsWith(root)) return url;
  const rest = url.slice(root.length);
  const slash = rest.indexOf("/");
  const language = rest.slice(0, slash) as AssetLanguage;
  if (slash < 0 || !ASSET_LANGUAGES.includes(language)) return url;
  const { assetLanguages } = GAME_SERVER_PROFILES[server];
  const published = assetLanguages.includes(language) ? language : assetLanguages[0]!;
  return `${assetConfig.api}${regionPrefix(server)}/${published}${rest.slice(slash)}`;
}





/** Every path prefix under which the service publishes files (`{api}/{language}`, `{api}/{region}/{language}`). */
export function releaseFilePrefixes(): string[] {
  const prefixes = new Set<string>();
  for (const server of GAME_SERVERS) {
    for (const language of GAME_SERVER_PROFILES[server].assetLanguages) prefixes.add(`${assetConfig.api}${regionPrefix(server)}/${language}`);
  }
  return [...prefixes];
}




