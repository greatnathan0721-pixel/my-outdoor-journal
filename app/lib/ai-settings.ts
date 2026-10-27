"use client";

import { useSyncExternalStore } from "react";

// BYOK：使用者自己的 OpenAI API 金鑰只存在這台裝置的瀏覽器（localStorage）
// 呼叫我們的 /api/ai/* 時放在 x-openai-key 標頭帶過去，伺服器轉送給 OpenAI 後就丟掉，不會保存

export type AiSettings = {
  key: string;
  imageModel: string;
  textModel: string;
  imageModels: string[]; // 上次驗證時這把金鑰能用的模型
  textModels: string[];
  checkedAt: string;
};

const STORAGE_KEY = "my-travel-diary:openai";
const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cached: AiSettings | null = null;

function read(): AiSettings | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // 無痕模式或封鎖網站資料時讀不到
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cached = raw ? (JSON.parse(raw) as AiSettings) : null;
    } catch {
      cached = null;
    }
  }
  return cached;
}

const notify = () => listeners.forEach((l) => l());

export function saveAiSettings(settings: AiSettings | null) {
  try {
    if (settings) localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    throw new Error("這個瀏覽器不允許儲存資料（可能是無痕模式），沒辦法記住金鑰");
  }
  notify();
}

export function useAiSettings() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      // 其他分頁改了設定也要同步
      const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && listener();
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    read,
    () => null,
  );
}

export const maskKey = (key: string) => `${key.slice(0, 7)}⋯${key.slice(-4)}`;

// 呼叫我們自己的 AI API，自動帶上金鑰；失敗時丟出伺服器給的中文錯誤訊息
export async function aiFetch(path: string, key: string, init: RequestInit = {}) {
  const res = await fetch(path, { ...init, headers: { ...init.headers, "x-openai-key": key } });
  if (!res.ok) {
    const message = await res
      .json()
      .then((b) => b.error as string)
      .catch(() => null);
    throw new Error(message ?? `發生錯誤（${res.status}）`);
  }
  return res;
}
