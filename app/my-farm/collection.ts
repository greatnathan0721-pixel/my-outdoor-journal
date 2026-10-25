import { useSyncExternalStore } from "react";
import type { Category } from "./species";

export type Creature = {
  id: string;
  name: string;
  emoji: string | null; // null 時用照片當角色
  category: Category;
  photo: string; // 縮小過的照片（data URL）
  aiGuess: string | null; // AI 原本猜的名稱，方便之後對照
  caughtAt: string;
};

// 收服的夥伴存在這個瀏覽器的 localStorage
const KEY = "my-farm-creatures-v1";
const EMPTY: Creature[] = [];
let cache: Creature[] | null = null;
const listeners = new Set<() => void>();

function read(): Creature[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    cache = [];
  }
  return cache!;
}

function write(next: Creature[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 空間不足或無痕模式：至少這次瀏覽還看得到
  }
  listeners.forEach((l) => l());
}

export function addCreature(c: Creature) {
  write([...read(), c]);
}

export function removeCreature(id: string) {
  write(read().filter((c) => c.id !== id));
}

export function useCollection() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => EMPTY,
  );
}
