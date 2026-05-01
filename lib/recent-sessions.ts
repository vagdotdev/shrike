const STORAGE_KEY = "shrike.recentSessions";
const MAX = 10;

export type RecentSessionEntry = { id: string; at: number };

export const RECENT_SESSIONS_EVENT = "shrike-recent-sessions";

export function recordSessionVisit(id: string) {
  if (typeof window === "undefined") return;
  let list: RecentSessionEntry[] = [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    list = raw ? (JSON.parse(raw) as RecentSessionEntry[]) : [];
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }
  const next = [{ id, at: Date.now() }, ...list.filter((e) => e.id !== id)].slice(
    0,
    MAX,
  );
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(RECENT_SESSIONS_EVENT));
}

export function readRecentSessions(): RecentSessionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list = raw ? (JSON.parse(raw) as RecentSessionEntry[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
