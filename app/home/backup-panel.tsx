"use client";

import { useEffect, useRef, useState } from "react";
import { primaryButton, secondaryButton, Tag } from "../components/trail-ui";
import { exportBackup, importBackup, isPersisted, requestPersistence, type DiaryState } from "../lib/trips-db";

// 只有讀到備份紀錄（瀏覽器端）才會呼叫
function daysAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function BackupPanel({ diary }: { diary: DiaryState }) {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    isPersisted().then(setPersisted);
  }, [diary.trips.length]);

  const daysSince = diary.lastBackup ? daysAgo(diary.lastBackup) : null;
  const needBackup = diary.trips.length > 0 && (daysSince === null || daysSince > 30 || diary.tripsSinceBackup >= 3);

  async function download() {
    setBusy(true);
    try {
      await exportBackup();
      setMessage("✅ 備份檔已下載，建議存到 Google 雲端硬碟、iCloud 或電腦裡。");
    } catch {
      setMessage("備份失敗，請再試一次。");
    }
    setBusy(false);
  }

  async function restore(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const r = await importBackup(file);
      setMessage(`✅ 已還原 ${r.trips} 趟旅程、${r.photos} 張照片。`);
    } catch (e) {
      setMessage(`還原失敗：${e instanceof Error ? e.message : "檔案格式不正確"}`);
    }
    if (fileRef.current) fileRef.current.value = "";
    setBusy(false);
  }

  return (
    <section className={`trail-card p-5 sm:p-7 ${needBackup ? "ring-2 ring-wood/60" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-wood">🛟 保護你的回憶</p>
          <h2 className="mt-1 text-2xl font-bold text-ink">備份與還原</h2>
          <p className="mt-2 text-sm text-muted">
            照片只存在這台裝置的瀏覽器裡，不花任何費用。定期下載備份檔，就算清除瀏覽器資料或換手機，也能一鍵救回所有旅程（神奇寶貝世界的收藏也會一起備份）。
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5 text-sm">
          <Tag tone={persisted ? "good" : "warn"}>{persisted ? "🔒 已開啟持久保存" : "⚠️ 尚未開啟持久保存"}</Tag>
          <Tag tone={needBackup ? "warn" : "neutral"}>
            {diary.lastBackup ? `上次備份：${daysSince === 0 ? "今天" : `${daysSince} 天前`}` : "還沒備份過"}
            {diary.tripsSinceBackup > 0 && `・之後新增了 ${diary.tripsSinceBackup} 趟`}
          </Tag>
        </div>
      </div>

      {needBackup && (
        <p className="mt-4 rounded-2xl bg-wood-soft p-3 text-sm text-ink">📌 你有新的旅程還沒備份，建議現在下載一份備份檔。</p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button onClick={download} disabled={busy || diary.trips.length === 0} className={primaryButton}>
          ⬇ 下載備份檔
        </button>
        <label className={`${secondaryButton} flex cursor-pointer items-center`}>
          ⬆ 從備份檔還原
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => restore(e.target.files?.[0])} />
        </label>
        {persisted === false && (
          <button
            type="button"
            onClick={async () => setPersisted(await requestPersistence())}
            className="text-sm font-medium text-forest hover:underline"
          >
            開啟持久保存
          </button>
        )}
      </div>
      {message && <p className="mt-3 text-sm text-ink">{message}</p>}
      <p className="mt-4 text-xs text-muted">
        📱 iPhone／iPad 小提醒：用 Safari 的「分享 → 加入主畫面」把這個網站加到桌面，可以避免太久沒打開時資料被系統清除。
      </p>
    </section>
  );
}
