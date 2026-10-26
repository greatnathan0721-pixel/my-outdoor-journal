"use client";

import { useSyncExternalStore } from "react";
import { FARM_UPDATED, getAll, run } from "../lib/trips-db";
import type { Category } from "./species";

export type Creature = {
  id: string;
  name: string;
  emoji: string | null; // 名字跟 AI 判斷一致時才準，只當小徽章用
  category: Category;
  photo: string; // 縮小過的原照片（data URL）
  cutout?: string | null; // 去背後的透明 PNG（data URL），在農場裡當角色
  facing?: "left" | "right"; // 去背圖裡牠面向哪邊，走路時才知道要不要翻轉
  aiGuess: string | null; // AI 原本猜的名稱，方便之後對照
  caughtAt: string;
};

// 收服的夥伴存在瀏覽器的 IndexedDB（去背圖比較大，localStorage 放不下）
const OLD_KEY = "my-farm-creatures-v1";
const EMPTY: Creature[] = [];
let cache: Creature[] = EMPTY;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

async function load() {
  let list = await getAll<Creature>("creatures");
  // 舊版存在 localStorage，第一次讀取時搬過來
  try {
    const old = JSON.parse(localStorage.getItem(OLD_KEY) ?? "[]") as Creature[];
    if (old.length > 0) {
      const ids = new Set(list.map((c) => c.id));
      const moving = old.filter((c) => !ids.has(c.id));
      await Promise.all(moving.map((c) => run("creatures", "readwrite", (s) => s.put(c))));
      localStorage.removeItem(OLD_KEY);
      list = [...list, ...moving];
    }
  } catch {
    // 讀不到舊資料就算了
  }
  cache = list.sort((a, b) => a.caughtAt.localeCompare(b.caughtAt));
  notify();
}

function reload() {
  loading = load().catch(() => notify());
  return loading;
}

if (typeof window !== "undefined") window.addEventListener(FARM_UPDATED, () => reload());

export async function addCreature(c: Creature) {
  await run("creatures", "readwrite", (s) => s.put(c));
  await reload();
}

export async function updateCreature(c: Creature) {
  await run("creatures", "readwrite", (s) => s.put(c));
  await reload();
}

export async function removeCreature(id: string) {
  await run("creatures", "readwrite", (s) => s.delete(id));
  await reload();
}

export function useCollection() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      if (!loading) reload();
      return () => listeners.delete(listener);
    },
    () => cache,
    () => EMPTY,
  );
}
