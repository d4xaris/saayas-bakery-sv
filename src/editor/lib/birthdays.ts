import data from "@/data/birthdays.json"

export type GroupId = "ournotes" | "bandori"

export const GROUPS: Record<GroupId, { label: string; color: string }> = {
  ournotes: { label: "BanG Dream! Our Notes", color: "rgb(236 72 153 / 0.6)" },
  bandori: { label: "BanG Dream! Girls Band Party", color: "rgb(56 189 248 / 0.6)" },
}

export type Birthday = {
  /** 1 to 12 */
  month: number
  day: number
  en: string
  /** Ukrainian name; may be empty */
  uk: string
  group: GroupId
  /** Band name, shown in the details panel */
  band?: string
}

// The list itself lives in src/data/birthdays.json: edit that file to add or fix birthdays.
export const BIRTHDAYS = data as Birthday[]