const HOST = "https://bestdori.com";

/** Мініатюра картки. trained = true дає варіант після тренування (лише для 3★+). */
export function cardThumbUrl(
  cardId: number,
  resourceSetName: string,
  opts: { trained?: boolean; server?: "jp" | "en" } = {},
): string {
  const server = opts.server ?? "jp";
  const group = String(Math.floor(cardId / 50)).padStart(5, "0");
  const suffix = opts.trained ? "after_training" : "normal";
  return `${HOST}/assets/${server}/thumb/chara/card${group}_rip/${resourceSetName}_${suffix}.png`;
}

/** Кругла іконка персонажа. */
export function characterIconUrl(characterId: number): string {
  return `${HOST}/res/icon/chara_icon_${characterId}.png`;
}

/** Зірка рарності. */
export function starIconUrl(trained = false): string {
  return `${HOST}/res/icon/${trained ? "star_trained" : "star"}.png`;
}

/** EN event banner, or null if the event has no bundle name. bundle = EventSummary.bundle. */
export function eventBannerUrl(bundle: string): string | null {
  return bundle ? `${HOST}/assets/en/event/${bundle}/images_rip/banner.png` : null;
}