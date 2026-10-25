"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import StoredPhoto from "../components/stored-photo";
import { tripStops } from "../lib/trip-stops";
import { useDiary } from "../lib/trips-db";
import { getWorldMap } from "../next-trip/maps";
import BackupPanel from "./backup-panel";
import FootprintMap from "./footprint-map";
import MemoryCarousel from "./memory-carousel";

export function DiaryStats() {
  const diary = useDiary();
  const map = getWorldMap();
  const stats = useMemo(() => {
    const countries = new Set<number>();
    diary.trips.forEach((t) =>
      tripStops(t, diary.photos).forEach((s) => {
        const found = map.locate([s.lon, s.lat]);
        // 簡化版世界地圖沒有小島（例如隱岐），離島 200 公里內都算進最近的國家
        if (found && (!found.nearest || found.nearest.km < 200)) countries.add(found.index);
      }),
    );
    const years = diary.trips.map((t) => t.startDate.slice(0, 4)).filter(Boolean).sort();
    return [
      { value: diary.trips.length, label: "趟旅程" },
      { value: countries.size, label: "個國家／地區" },
      { value: diary.photos.size, label: "張照片" },
      { value: years[0] ?? "—", label: "第一趟旅程" },
    ];
  }, [diary, map]);

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl bg-white/15 px-4 py-3 text-white backdrop-blur-md">
          <dt className="text-xs text-white/80">{s.label}</dt>
          <dd className="text-2xl font-bold">{diary.ready ? s.value : "…"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function DiaryHome() {
  const diary = useDiary();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pinnedCount = diary.trips.reduce((n, t) => n + tripStops(t, diary.photos).length, 0);
  const unlocated = diary.trips.filter((t) => tripStops(t, diary.photos).length === 0);

  return (
    <div className="flex flex-col gap-8">
      <section id="map" className="trail-card scroll-mt-24 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <p className="text-sm font-medium text-wood">🗺️ 我的足跡</p>
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">走過的每一個地方</h2>
          </div>
          <p className="text-sm text-muted">
            {pinnedCount > 0 ? `已經插上 ${pinnedCount} 支圖釘，點圖釘看看那趟旅程` : "還沒有圖釘"}
          </p>
        </div>
        {unlocated.length > 0 && (
          <p className="mb-3 rounded-2xl bg-wood-soft px-4 py-3 text-sm text-ink">
            ⚠️ 有 {unlocated.length} 趟旅程（{unlocated.map((t) => `「${t.place}」`).join("、")}）還沒有地點，所以地圖上看不到圖釘。{" "}
            <Link href="/new-trip#trips" className="font-semibold text-forest hover:underline">
              去補上地點 →
            </Link>
          </p>
        )}
        <FootprintMap diary={diary} selectedId={selectedId} onSelect={setSelectedId} />
      </section>

      <section className="trail-card p-4 sm:p-6">
        <div className="mb-4 px-1">
          <p className="text-sm font-medium text-wood">📸 回憶輪播</p>
          <h2 className="text-2xl font-bold text-ink sm:text-3xl">那些風景，都還記得</h2>
        </div>
        <MemoryCarousel diary={diary} />
      </section>

      {diary.trips.length > 0 && (
        <section className="trail-card p-5 sm:p-7">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-wood">🥾 旅程時間軸</p>
              <h2 className="text-2xl font-bold text-ink">最近的旅程</h2>
            </div>
            <Link href="/new-trip" className="text-sm font-medium text-forest hover:underline">
              看全部／新增 →
            </Link>
          </div>
          <ol className="relative grid gap-3 border-l-2 border-dashed border-line pl-5 sm:grid-cols-2 sm:border-none sm:pl-0 lg:grid-cols-3">
            {diary.trips.slice(0, 6).map((t) => {
              const cover = t.photoIds.map((id) => diary.photos.get(id)).find(Boolean);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (tripStops(t, diary.photos).length === 0) return;
                      setSelectedId(`${t.id}:0`);
                      document.getElementById("map")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className="flex w-full gap-3 rounded-2xl border border-line bg-sand p-3 text-left transition-colors hover:border-forest"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-moss">
                      {cover ? (
                        <StoredPhoto blob={cover.blob} alt={t.place} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-2xl">🏞️</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{t.place}</p>
                      <p className="text-xs text-muted">{t.startDate}</p>
                      <p className="mt-1 text-xs text-forest">
                        {(() => {
                          const n = tripStops(t, diary.photos).length;
                          return n > 1 ? `📍 ${n} 站・在地圖上看` : n === 1 ? "📍 在地圖上看" : "尚未定位";
                        })()}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <BackupPanel diary={diary} />
    </div>
  );
}
