const HOST = "https://assets.bdon.moe/en/en/Story/Banner/Chapter"

/** English chapter banner for Our Notes. Chapter id = groups[0].chapter.id from stories.json. */
export const chapterBannerUrl = (chapterId: number) =>
  `${HOST}/ui_banner_chapter_${chapterId}/ui_banner_chapter_${chapterId}.webp`