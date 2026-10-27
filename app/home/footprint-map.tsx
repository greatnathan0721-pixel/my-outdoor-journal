"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, Map as MapLibreMap, Marker, Popup } from "maplibre-gl";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import StoredPhoto from "../components/stored-photo";
import { localizeMap, STYLE_URL } from "../lib/map-style";
import { tripStops, type Stop } from "../lib/trip-stops";
import type { DiaryState, Trip } from "../lib/trips-db";

// OpenFreeMap：免費、不需要金鑰的向量地圖，可以一路放大到街道和步道
const WORLD_VIEW = { center: [125, 25] as [number, number], zoom: 1.3 };

type Props = {
  diary: DiaryState;
  selectedId: string | null; // 選中的那一站（Stop.key）
  onSelect: (id: string | null) => void;
};

function pinHtml(label: string | null) {
  return `
    <svg class="trail-pin-svg" viewBox="-11 -30 22 31" width="30" height="42" aria-hidden="true">
      <ellipse cx="0" cy="0" rx="5" ry="1.8" fill="rgba(0,0,0,.25)"/>
      <path class="trail-pin-body" d="M0 0 C-3 -6 -9 -10 -9 -17 A9 9 0 1 1 9 -17 C9 -10 3 -6 0 0 Z" stroke="white" stroke-width="1.5"/>
      <circle cx="0" cy="-17" r="${label ? 5.5 : 3.5}" fill="white"/>
      ${label ? `<text x="0" y="-14.6" text-anchor="middle" font-size="7.5" font-weight="700" fill="#a61e14">${label}</text>` : ""}
    </svg>`;
}

export default function FootprintMap({ diary, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markersRef = useRef(new Map<string, Marker>());
  const popupRef = useRef<Popup | null>(null);
  const fittedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [popupEl] = useState(() => (typeof document === "undefined" ? null : document.createElement("div")));

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // 每趟旅程依照片位置拆成好幾站，每站一支圖釘
  const { stops, tripsById } = useMemo(
    () => ({
      stops: diary.trips.flatMap((t) => tripStops(t, diary.photos)),
      tripsById: new Map(diary.trips.map((t) => [t.id, t])),
    }),
    [diary],
  );
  const countByTrip = useMemo(() => {
    const m = new Map<string, number>();
    stops.forEach((s) => m.set(s.tripId, (m.get(s.tripId) ?? 0) + 1));
    return m;
  }, [stops]);
  const selected = stops.find((s) => s.key === selectedId) ?? null;

  // 建立地圖（只在瀏覽器端載入 MapLibre）
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    import("maplibre-gl")
      .then((ml) => {
        if (cancelled || !containerRef.current) return;
        libRef.current = ml;
        // worker 檔放在 public/maplibre（由 scripts/copy-runtime-assets.mjs 複製）
        ml.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
        const m = new ml.Map({
          container: containerRef.current,
          style: STYLE_URL,
          ...WORLD_VIEW,
          // 捲動頁面時不會誤觸縮放；電腦按住 Ctrl／⌘ 滾輪、手機兩指縮放
          cooperativeGestures: true,
          attributionControl: { compact: true },
          locale: {
            "CooperativeGesturesHandler.WindowsHelpText": "按住 Ctrl 再滾動滑鼠滾輪來縮放地圖",
            "CooperativeGesturesHandler.MacHelpText": "按住 ⌘ 再滾動來縮放地圖",
            "CooperativeGesturesHandler.MobileHelpText": "用兩根手指移動或縮放地圖",
            "NavigationControl.ZoomIn": "放大",
            "NavigationControl.ZoomOut": "縮小",
          },
        });
        map = m;
        m.addControl(new ml.NavigationControl({ showCompass: false }), "bottom-right");
        m.on("load", () => {
          localizeMap(m);
          m.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
          m.addLayer({
            id: "routes",
            type: "line",
            source: "routes",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": ["case", ["get", "selected"], "#a61e14", "#b8562b"],
              "line-width": ["case", ["get", "selected"], 3.5, 2.5],
              "line-dasharray": [2, 1.6],
              "line-opacity": 0.85,
            },
          });
          setReady(true);
        });
        m.on("click", () => onSelectRef.current(null));
        // 樣式還沒載入就出錯（例如沒網路），才顯示失敗訊息；個別圖磚失敗不影響
        m.on("error", () => {
          if (!m.isStyleLoaded()) setFailed(true);
        });
        mapRef.current = m;
      })
      .catch(() => setFailed(true));

    const markers = markersRef.current;
    return () => {
      cancelled = true;
      markers.forEach((mk) => mk.remove());
      markers.clear();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // 圖釘：資料變動時重新放
  useEffect(() => {
    const map = mapRef.current;
    const ml = libRef.current;
    if (!ready || !map || !ml) return;

    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current.clear();
    stops.forEach((stop, i) => {
      const multi = (countByTrip.get(stop.tripId) ?? 0) > 1;
      const trip = tripsById.get(stop.tripId);
      const el = document.createElement("button");
      el.type = "button";
      el.className = "trail-pin";
      el.style.setProperty("--delay", `${i * 70}ms`);
      el.innerHTML = pinHtml(multi ? String(stop.index + 1) : null);
      el.title = multi ? `${stop.name ?? trip?.place}（第 ${stop.index + 1} 站）` : (trip?.place ?? "");
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectRef.current(stop.key);
      });
      markersRef.current.set(stop.key, new ml.Marker({ element: el, anchor: "bottom" }).setLngLat([stop.lon, stop.lat]).addTo(map));
    });

    // 第一次有資料時，自動縮放到所有足跡
    if (!fittedRef.current && stops.length > 0) {
      fittedRef.current = true;
      const bounds = new ml.LngLatBounds();
      stops.forEach((s) => bounds.extend([s.lon, s.lat]));
      map.fitBounds(bounds, { padding: 80, maxZoom: 9, duration: 0 });
    }
  }, [ready, stops, countByTrip, tripsById]);

  // 選中某一站：更新圖釘樣式、路線顏色、資訊卡
  useEffect(() => {
    const map = mapRef.current;
    const ml = libRef.current;
    if (!ready || !map || !ml) return;

    markersRef.current.forEach((mk, key) => {
      const stop = stops.find((s) => s.key === key);
      mk.getElement().dataset.state = key === selectedId ? "active" : stop && stop.tripId === selected?.tripId ? "trip" : "";
    });

    // 同一趟旅程有好幾站時，依順序畫一條虛線路線
    const routes = diary.trips
      .map((t) => ({ trip: t, points: stops.filter((s) => s.tripId === t.id).sort((a, b) => a.index - b.index) }))
      .filter((r) => r.points.length > 1)
      .map((r) => ({
        type: "Feature" as const,
        properties: { selected: r.trip.id === selected?.tripId },
        geometry: { type: "LineString" as const, coordinates: r.points.map((p) => [p.lon, p.lat]) },
      }));
    (map.getSource("routes") as GeoJSONSource | undefined)?.setData({ type: "FeatureCollection", features: routes });

    popupRef.current?.remove();
    popupRef.current = null;
    if (selected && popupEl) {
      popupRef.current = new ml.Popup({
        closeButton: false,
        closeOnClick: false,
        anchor: "bottom", // 資訊卡固定在圖釘上方
        offset: 44,
        maxWidth: "none",
        className: "trail-popup",
      })
        .setLngLat([selected.lon, selected.lat])
        .setDOMContent(popupEl)
        .addTo(map);
      // 把圖釘移到畫面偏下方，讓上方有空間放資訊卡
      const inView = map.getBounds().contains([selected.lon, selected.lat]);
      map.easeTo({
        center: [selected.lon, selected.lat],
        zoom: inView ? map.getZoom() : Math.max(map.getZoom(), 6),
        offset: [0, Math.min(150, map.getContainer().clientHeight / 4)],
        duration: inView ? 500 : 1200,
      });
    }
  }, [ready, selectedId, selected, stops, diary.trips, popupEl]);

  function showWorld() {
    onSelect(null);
    mapRef.current?.flyTo({ ...WORLD_VIEW });
  }

  function showFootprints() {
    const map = mapRef.current;
    const ml = libRef.current;
    if (!map || !ml || stops.length === 0) return;
    onSelect(null);
    const bounds = new ml.LngLatBounds();
    stops.forEach((s) => bounds.extend([s.lon, s.lat]));
    map.fitBounds(bounds, { padding: 80, maxZoom: 10 });
  }

  const selectedTrip = selected ? tripsById.get(selected.tripId) : undefined;

  return (
    <div className="relative">
      <div className="absolute left-3 top-3 z-10 flex gap-1 rounded-full border border-line bg-card/90 p-1 text-sm shadow-sm backdrop-blur">
        <button type="button" onClick={showWorld} className="rounded-full px-3 py-1 font-medium text-ink hover:bg-sand">
          🌏 全世界
        </button>
        <button
          type="button"
          onClick={showFootprints}
          disabled={stops.length === 0}
          className="rounded-full bg-forest px-3 py-1 font-medium text-on-accent disabled:opacity-40"
        >
          📍 我的足跡
        </button>
      </div>

      <div ref={containerRef} className="aspect-[4/3] w-full overflow-hidden rounded-2xl bg-ocean sm:aspect-[16/9]" />

      {failed && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-sand/90 p-6 text-center text-sm text-ink">
          地圖載入失敗，可能是網路問題或瀏覽器不支援 WebGL，請重新整理再試試。
        </div>
      )}

      {stops.length === 0 && !failed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="trail-card pointer-events-auto mx-4 max-w-sm p-5 text-center">
            <p className="text-3xl">📍</p>
            <p className="mt-1 font-semibold text-ink">地圖上還沒有圖釘</p>
            <p className="mt-1 text-sm text-muted">新增遊記時選好地點（或上傳有定位的照片），就會在這裡插上紅色圖釘。</p>
            <Link href="/new-trip" className="mt-3 inline-block rounded-full bg-forest px-5 py-2 text-sm font-semibold text-on-accent">
              新增第一篇遊記
            </Link>
          </div>
        </div>
      )}

      {/* 資訊卡用 portal 放進地圖的 Popup 裡 */}
      {popupEl &&
        selected &&
        selectedTrip &&
        createPortal(
          <TripPopup
            trip={selectedTrip}
            stop={selected}
            total={countByTrip.get(selected.tripId) ?? 1}
            diary={diary}
            onClose={() => onSelect(null)}
          />,
          popupEl,
        )}
    </div>
  );
}

// 舊的遊記沒有存每站的地名，打開時再查一次（同一個座標只查一次）
const lookedUp = new Map<string, string>();

function useStopName(stop: Stop, needed: boolean) {
  const key = `${stop.lat.toFixed(2)},${stop.lon.toFixed(2)}`;
  const [fetched, setFetched] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!needed || lookedUp.has(key)) return;
    let cancelled = false;
    fetch(`/api/geocode?lat=${stop.lat}&lon=${stop.lon}`)
      .then((res) => res.json())
      .then((data: { place?: { name: string } | null }) => {
        if (!data.place || cancelled) return;
        lookedUp.set(key, data.place.name);
        setFetched((prev) => ({ ...prev, [key]: data.place!.name }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [key, needed, stop.lat, stop.lon]);
  return stop.name ?? fetched[key] ?? lookedUp.get(key) ?? null;
}

type PopupProps = { trip: Trip; stop: Stop; total: number; diary: DiaryState; onClose: () => void };

function TripPopup({ trip, stop, total, diary, onClose }: PopupProps) {
  // 優先用這一站拍的照片當封面
  const cover = [...stop.photoIds, ...trip.photoIds].map((id) => diary.photos.get(id)).find(Boolean);
  const stopName = useStopName(stop, total > 1 && !stop.name);
  return (
    <div className="trail-card relative w-56 overflow-hidden text-left font-sans" onClick={(e) => e.stopPropagation()}>
      {cover && <StoredPhoto blob={cover.blob} alt={trip.place} className="aspect-[4/3] w-full object-cover" />}
      <div className="p-3">
        {total > 1 ? (
          <>
            <p className="font-semibold text-ink">{stopName ?? "查詢地名中⋯"}</p>
            <p className="text-xs text-muted">屬於「{trip.place}」這趟旅程</p>
            <p className="text-xs font-medium text-wood">
              第 {stop.index + 1} 站／共 {total} 站{stop.date && `・${stop.date}`}・這站 {stop.photoIds.length} 張
            </p>
          </>
        ) : (
          <p className="font-semibold text-ink">{trip.place}</p>
        )}
        <p className="text-xs text-muted">
          {trip.startDate}
          {trip.endDate && trip.endDate !== trip.startDate && ` ～ ${trip.endDate}`}・{trip.photoIds.length} 張照片
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="關閉"
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-xs text-white"
      >
        ✕
      </button>
    </div>
  );
}
