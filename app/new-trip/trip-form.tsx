"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Place } from "../api/geocode/route";
import StoredPhoto from "../components/stored-photo";
import { inputClass, primaryButton, secondaryButton, StepLabel, Tag } from "../components/trail-ui";
import { preparePhoto, type PhotoInfo } from "../lib/photo-utils";
import { groupStops, tripStops } from "../lib/trip-stops";
import PlaceSearch from "../components/place-search";
import { deleteTrip, saveTrip, updateTripLocation, useDiary } from "../lib/trips-db";

type Pending = { key: string; name: string; preview: string; info: PhotoInfo | null };
type Location = { lat: number; lon: number; label: string; source: "photo" | "search" };

// 座標取到小數第二位（約 1 公里）當地名快取的 key
const coordKey = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

async function reverseGeocode(lat: number, lon: number): Promise<Place | null> {
  try {
    const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
    return (await res.json()).place ?? null;
  } catch {
    return null;
  }
}

export default function TripForm() {
  const [place, setPlace] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState<Location | null>(null);
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [photos, setPhotos] = useState<Pending[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [stopNames, setStopNames] = useState<Record<string, string>>({});
  const [fixingId, setFixingId] = useState<string | null>(null); // 正在補地點的旅程
  const fileRef = useRef<HTMLInputElement>(null);
  const diary = useDiary();

  const processing = photos.some((p) => !p.info);
  const processed = photos.filter((p) => p.info);
  const withoutLocation = processed.filter((p) => p.info!.lat === null).length;
  // 依照片位置分成幾站，首頁地圖會各插一支圖釘
  const stops = groupStops(
    processed
      .filter((p) => p.info!.lat !== null && p.info!.lon !== null)
      .map((p) => ({ id: p.key, lat: p.info!.lat!, lon: p.info!.lon!, takenAt: p.info!.takenAt })),
  );

  async function handleFiles(files: FileList | null) {
    const list = Array.from(files ?? []);
    if (fileRef.current) fileRef.current.value = "";
    const pending = list.map((file) => ({ key: crypto.randomUUID(), name: file.name, preview: URL.createObjectURL(file), info: null }));
    setPhotos((prev) => [...prev, ...pending]);

    const infos = await Promise.all(list.map((f) => preparePhoto(f)));
    setPhotos((prev) => prev.map((p) => ({ ...p, info: p.info ?? infos[pending.findIndex((x) => x.key === p.key)] ?? null })));

    // 用照片的拍攝日期自動填出發／回程日期
    const dates = infos.map((i) => i.takenAt).filter((d): d is string => Boolean(d)).sort();
    if (dates.length > 0 && !startDate) {
      setStartDate(dates[0]);
      if (dates[dates.length - 1] !== dates[0]) setEndDate(dates[dates.length - 1]);
    }

    // 用照片的 GPS 自動定位，並查出每個地點的地名（Nominatim 限制每秒 1 次，所以一個一個查）
    const keys = new Map<string, { lat: number; lon: number }>();
    infos.forEach((i) => {
      if (i.lat !== null && i.lon !== null) keys.set(coordKey(i.lat, i.lon), { lat: i.lat, lon: i.lon });
    });
    let first = true;
    for (const [key, { lat, lon }] of keys) {
      if (stopNames[key]) continue;
      const found = await reverseGeocode(lat, lon);
      const name = found?.name ?? `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
      setStopNames((prev) => ({ ...prev, [key]: name }));
      if (first && !location) {
        setLocation({ lat, lon, label: found?.detail ?? name, source: "photo" });
        if (found) setPlace((current) => current || found.name);
      }
      first = false;
    }
  }

  function removePhoto(key: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.key === key);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((p) => p.key !== key);
    });
  }

  async function searchPlace() {
    if (!place.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(place.trim())}`);
      const data: { places?: Place[] } = await res.json();
      setResults(data.places ?? []);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }

  // 每張照片存它所屬那一站的地名
  function stopNameOf(photoKey: string) {
    const stop = stops.find((s) => s.photoIds.includes(photoKey));
    return stop ? (stopNames[coordKey(stop.lat, stop.lon)] ?? null) : null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (processing) return;
    // 沒有任何地點就存檔的話，地圖上不會有圖釘，先提醒一下
    if (!location && stops.length === 0) {
      const ok = confirm(
        "這趟旅程還沒有地點，首頁地圖上不會出現紅色圖釘。\n\n建議先按「📍 找地點」選位置。要先存起來、之後再補嗎？",
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      await saveTrip(
        { place: place.trim(), startDate, endDate, lat: location?.lat ?? null, lon: location?.lon ?? null },
        processed.map((p) => ({
          blob: p.info!.blob,
          takenAt: p.info!.takenAt,
          lat: p.info!.lat,
          lon: p.info!.lon,
          placeName: stopNameOf(p.key),
        })),
      );
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      setPlace("");
      setStartDate("");
      setEndDate("");
      setLocation(null);
      setResults(null);
      setPhotos([]);
      setMessage(`「${place.trim()}」已經存進你的旅遊遊記了！`);
    } catch {
      setMessage("儲存失敗，可能是裝置空間不足，請刪掉一些照片再試試。");
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="trail-card flex flex-col gap-8 p-5 sm:p-7">
        <div>
          <StepLabel step={1}>放上這次的照片</StepLabel>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-sand px-4 py-8 text-center transition-colors hover:border-forest">
            <span className="text-3xl">🏞️</span>
            <span className="font-semibold text-ink">從相簿選照片（可以一次選多張）</span>
            <span className="text-sm text-muted">照片有記錄拍攝地點和時間的話，會自動幫你填好</span>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} className="sr-only" />
          </label>
          {photos.length > 0 && (
            <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5">
              {photos.map((p) => (
                <li key={p.key} className="relative aspect-square overflow-hidden rounded-xl border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 本機預覽 */}
                  <img src={p.preview} alt={p.name} className="h-full w-full object-cover" />
                  {!p.info && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">處理中⋯</span>
                  )}
                  {p.info?.lat !== null && p.info && (
                    <span className="absolute bottom-1 left-1 rounded-full bg-black/55 px-1.5 text-[10px] text-white">📍 有定位</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removePhoto(p.key)}
                    aria-label={`移除 ${p.name}`}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!processing && processed.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 text-sm">
              {stops.length > 0 && (
                <p className="rounded-2xl bg-moss p-3 text-ink">
                  📍 照片分布在 <b>{stops.length}</b> 個地點，首頁地圖會插上 {stops.length} 支圖釘：
                  <span className="mt-1 block text-forest">
                    {stops
                      .map((s, i) => `${"①②③④⑤⑥⑦⑧⑨⑩"[i] ?? `${i + 1}.`} ${stopNames[coordKey(s.lat, s.lon)] ?? "查詢地名中⋯"}`)
                      .join("  →  ")}
                  </span>
                </p>
              )}
              {stops.length === 0 && (
                <p className="rounded-2xl bg-wood-soft p-3 text-ink">
                  🤔 這些照片沒有拍攝地點的資訊，所以沒辦法自動定位。常見原因：手機上傳時為了保護隱私把地點移除了、照片是從
                  LINE 等通訊軟體存下來的，或拍照時沒開定位。請在下面用「📍 找地點」手動選擇位置。
                </p>
              )}
              {stops.length > 0 && withoutLocation > 0 && (
                <p className="text-muted">另外有 {withoutLocation} 張照片沒有地點資訊，它們會出現在回憶輪播，但不會插圖釘。</p>
              )}
            </div>
          )}
        </div>

        <div>
          <StepLabel step={2}>去了哪裡？</StepLabel>
          <div className="flex gap-2">
            <input
              required
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  searchPlace();
                }
              }}
              placeholder="例如：合歡山、京都、太魯閣"
              className={inputClass}
            />
            <button type="button" onClick={searchPlace} disabled={searching || !place.trim()} className={`${secondaryButton} shrink-0`}>
              {searching ? "搜尋中⋯" : "📍 找地點"}
            </button>
          </div>

          {results && (
            <div className="mt-3">
              {results.length === 0 ? (
                <p className="text-sm text-muted">找不到這個地點，換個寫法試試（例如加上縣市或國家）。</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {results.map((r) => (
                    <li key={`${r.lat},${r.lon}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setLocation({ lat: r.lat, lon: r.lon, label: r.detail, source: "search" });
                          setResults(null);
                        }}
                        className="w-full rounded-xl border border-line bg-sand px-3 py-2 text-left text-sm text-ink hover:border-forest"
                      >
                        <b>{r.name}</b>
                        <span className="block text-xs text-muted">{r.detail}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {location ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink">
              <Tag tone="good">{location.source === "photo" ? "📷 從照片定位" : "🔍 搜尋定位"}</Tag>
              📍 {location.label}
              <button type="button" onClick={() => setLocation(null)} className="text-xs text-wood hover:underline">
                清除
              </button>
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted">按「找地點」選一個位置，首頁的世界地圖就會插上紅色圖釘。沒選也可以存。</p>
          )}
        </div>

        <div>
          <StepLabel step={3}>什麼時候去的？</StepLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm text-muted">
              出發日期
              <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-muted">
              回程日期（選填）
              <input
                type="date"
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <button type="submit" disabled={saving || processing} className={primaryButton}>
          {processing ? "照片處理中⋯" : saving ? "儲存中⋯" : "💾 存進旅遊遊記"}
        </button>
        {message && (
          <p className="rounded-2xl bg-moss p-4 text-sm text-ink">
            ✅ {message}{" "}
            <Link href="/" className="font-semibold text-forest hover:underline">
              回首頁看地圖 →
            </Link>
          </p>
        )}
      </form>

      <section id="trips" className="trail-card scroll-mt-24 p-5 sm:p-7">
        <StepLabel step={4}>已經記錄的旅程（{diary.trips.length}）</StepLabel>
        {!diary.ready ? (
          <p className="text-muted">讀取中⋯</p>
        ) : diary.trips.length === 0 ? (
          <p className="rounded-2xl bg-sand p-4 text-muted">還沒有任何遊記，從上面開始記錄第一趟旅程吧！</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {diary.trips.map((t) => {
              const cover = t.photoIds.map((id) => diary.photos.get(id)).find(Boolean);
              return (
                <li key={t.id} className="flex flex-wrap gap-3 rounded-2xl border border-line bg-sand p-3">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-moss">
                    {cover ? (
                      <StoredPhoto blob={cover.blob} alt={t.place} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-2xl">🏞️</span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate font-semibold text-ink">{t.place}</p>
                    <p className="text-xs text-muted">
                      {t.startDate}
                      {t.endDate && t.endDate !== t.startDate && ` ～ ${t.endDate}`}・{t.photoIds.length} 張照片
                    </p>
                    <p className="text-xs">
                      {(() => {
                        const n = tripStops(t, diary.photos).length;
                        return n > 0 ? (
                          <span className="text-forest">📍 {n} 支圖釘</span>
                        ) : (
                          <span className="font-semibold text-wood">⚠️ 尚未定位，地圖上看不到</span>
                        );
                      })()}
                    </p>
                    <div className="mt-auto flex gap-3 text-xs">
                      {tripStops(t, diary.photos).length === 0 && (
                        <button
                          type="button"
                          onClick={() => setFixingId(fixingId === t.id ? null : t.id)}
                          className="font-semibold text-forest hover:underline"
                        >
                          📍 補上地點
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => confirm(`確定要刪除「${t.place}」和裡面的照片嗎？刪除後無法復原。`) && deleteTrip(t)}
                        className="text-wood hover:underline"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                  {fixingId === t.id && (
                    <div className="w-full">
                      <PlaceSearch
                        initial={t.place}
                        autoFocus
                        onPick={async (p) => {
                          await updateTripLocation(t, p.lat, p.lon);
                          setFixingId(null);
                        }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
