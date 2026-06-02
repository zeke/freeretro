import type { RetroSummary } from "../types";

const STORAGE_KEY = "freeretro-joined-retros";

export interface LocalRetro {
  id: string;
  title: string;
  joinedAt: number;
  lastOpenedAt: number;
}

export function getLocalRetros(): LocalRetro[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (!value) return [];
    const retros = JSON.parse(value) as LocalRetro[];
    if (!Array.isArray(retros)) return [];
    return retros
      .filter((retro) => retro.id && retro.title)
      .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  } catch {
    return [];
  }
}

export function saveLocalRetro(retro: RetroSummary): LocalRetro[] {
  const now = Date.now();
  const existing = getLocalRetros();
  const previous = existing.find((item) => item.id === retro.id);
  const next = [
    {
      id: retro.id,
      title: retro.title,
      joinedAt: previous?.joinedAt ?? now,
      lastOpenedAt: now,
    },
    ...existing.filter((item) => item.id !== retro.id),
  ];

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function removeLocalRetro(retroId: string): LocalRetro[] {
  const next = getLocalRetros().filter((retro) => retro.id !== retroId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
