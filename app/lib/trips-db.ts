"use client";

import { useSyncExternalStore } from "react";

// 遊記和照片存在使用者瀏覽器的 IndexedDB，不會上傳到伺服器，也就不會產生儲存費用

export type Trip = {
  id: string;
  place: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // 可能是空字串
  lat: number | null;
  lon: number | null;
  photoIds: string[];
  createdAt: string;
};

export type Photo = {
  id: string;
  tripId: string;
  blob: Blob;
  takenAt: string | null;
  lat?: number | null; // 照片自己的拍攝地點，用來在一趟旅程裡插多支圖釘
  lon?: number | null;
  placeName?: string | null; // 這張照片拍攝地點的地名（存檔時查好）
};

const DB_NAME = "travel-diary";
const DB_VERSION = 2; // v2：新增 creatures（神奇寶貝世界的收藏）

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("trips")) db.createObjectStore("trips", { keyPath: "id" });
      if (!db.objectStoreNames.contains("photos")) db.createObjectStore("photos", { keyPath: "id" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      if (!db.objectStoreNames.contains("creatures")) db.createObjectStore("creatures", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
const db = () => (dbPromise ??= openDb());

export function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void) {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const tx = d.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
        tx.onerror = () => reject(tx.error);
      }),
  );
}

export const getAll = <T>(store: string) => run<T[]>(store, "readonly", (s) => s.getAll());

// ---------- 給畫面用的 store：讀一次後快取，資料變動時通知 ----------

export type DiaryState = {
  ready: boolean;
  trips: Trip[]; // 依出發日期新到舊
  photos: Map<string, Photo>;
  lastBackup: string | null;
  tripsSinceBackup: number;
};

const EMPTY: DiaryState = { ready: false, trips: [], photos: new Map(), lastBackup: null, tripsSinceBackup: 0 };
let state: DiaryState = EMPTY;
let loading = false;
const listeners = new Set<() => void>();

async function reload() {
  const [trips, photos, lastBackup, since] = await Promise.all([
    getAll<Trip>("trips"),
    getAll<Photo>("photos"),
    run<string | undefined>("meta", "readonly", (s) => s.get("lastBackup")),
    run<number | undefined>("meta", "readonly", (s) => s.get("tripsSinceBackup")),
  ]);
  trips.sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt.localeCompare(a.createdAt));
  state = {
    ready: true,
    trips,
    photos: new Map(photos.map((p) => [p.id, p])),
    lastBackup: lastBackup ?? null,
    tripsSinceBackup: since ?? 0,
  };
  listeners.forEach((l) => l());
}

export function useDiary(): DiaryState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      if (!loading) {
        loading = true;
        reload().catch(() => {
          state = { ...EMPTY, ready: true };
          listeners.forEach((l) => l());
        });
      }
      return () => listeners.delete(listener);
    },
    () => state,
    () => EMPTY,
  );
}

// ---------- 寫入 ----------

export async function saveTrip(
  trip: Omit<Trip, "id" | "createdAt" | "photoIds">,
  photos: { blob: Blob; takenAt: string | null; lat: number | null; lon: number | null; placeName: string | null }[],
) {
  const id = crypto.randomUUID();
  const photoRows: Photo[] = photos.map((p) => ({ id: crypto.randomUUID(), tripId: id, ...p }));
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(["trips", "photos", "meta"], "readwrite");
    tx.objectStore("trips").put({ ...trip, id, createdAt: new Date().toISOString(), photoIds: photoRows.map((p) => p.id) });
    photoRows.forEach((p) => tx.objectStore("photos").put(p));
    tx.objectStore("meta").put(state.tripsSinceBackup + 1, "tripsSinceBackup");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await requestPersistence();
  await reload();
  return id;
}

// 幫已經存好、但沒有地點的旅程補上位置
export async function updateTripLocation(trip: Trip, lat: number, lon: number) {
  await run("trips", "readwrite", (s) => s.put({ ...trip, lat, lon }));
  await reload();
}

export async function deleteTrip(trip: Trip) {
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(["trips", "photos"], "readwrite");
    tx.objectStore("trips").delete(trip.id);
    trip.photoIds.forEach((id) => tx.objectStore("photos").delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await reload();
}

// ---------- 持久保存：請瀏覽器不要在空間不足時自動清掉資料 ----------

export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function isPersisted(): Promise<boolean> {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}

// ---------- 備份／還原 ----------

// 神奇寶貝世界的收藏有變動時通知（例如從備份還原），讓畫面重新讀取
export const FARM_UPDATED = "farm-updated";

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// 把遊記、照片和神奇寶貝世界的收藏打包成一個 JSON 檔下載
export async function exportBackup() {
  const [trips, photos] = await Promise.all([getAll<Trip>("trips"), getAll<Photo>("photos")]);
  const backup = {
    app: "my-travel-diary",
    version: 1,
    exportedAt: new Date().toISOString(),
    trips,
    photos: await Promise.all(photos.map(async ({ blob, ...p }) => ({ ...p, data: await blobToDataUrl(blob) }))),
    farm: await getAll("creatures"),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `我的旅遊遊記備份-${backup.exportedAt.slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  await run("meta", "readwrite", (s) => s.put(backup.exportedAt, "lastBackup"));
  await run("meta", "readwrite", (s) => s.put(0, "tripsSinceBackup"));
  await reload();
}

// 匯入備份：同一筆資料（相同 id）會覆蓋，其他資料保留
export async function importBackup(file: File): Promise<{ trips: number; photos: number }> {
  const backup = JSON.parse(await file.text());
  if (backup.app !== "my-travel-diary") throw new Error("這不是我的旅遊遊記的備份檔");
  const photos: Photo[] = await Promise.all(
    (backup.photos as (Omit<Photo, "blob"> & { data: string })[]).map(async ({ data, ...p }) => ({
      ...p,
      blob: await (await fetch(data)).blob(),
    })),
  );
  const d = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = d.transaction(["trips", "photos"], "readwrite");
    (backup.trips as Trip[]).forEach((t) => tx.objectStore("trips").put(t));
    photos.forEach((p) => tx.objectStore("photos").put(p));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  if (Array.isArray(backup.farm) && backup.farm.length > 0) {
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction("creatures", "readwrite");
      (backup.farm as { id: string }[]).forEach((c) => tx.objectStore("creatures").put(c));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    window.dispatchEvent(new Event(FARM_UPDATED));
  }
  await requestPersistence();
  await reload();
  return { trips: backup.trips.length, photos: photos.length };
}
