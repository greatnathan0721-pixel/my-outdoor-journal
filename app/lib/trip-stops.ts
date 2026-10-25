import type { Photo, Trip } from "./trips-db";

// 一趟旅程在地圖上的每一站（一支圖釘）
export type Stop = {
  key: string; // `${tripId}:${index}`
  tripId: string;
  index: number; // 第幾站，從 0 開始
  lat: number;
  lon: number;
  photoIds: string[];
  date: string | null; // 這一站最早的拍攝日期
  name: string | null; // 這一站的地名
};

// 距離小於這個值的照片算同一站
const SAME_STOP_KM = 3;

function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

type Located = { id: string; lat: number; lon: number; takenAt: string | null; placeName?: string | null };

// 把同一趟旅程裡有定位的照片，依拍攝時間排好、相近的合併成一站
export function groupStops(photos: Located[]): Omit<Stop, "key" | "index" | "tripId">[] {
  const sorted = [...photos].sort((a, b) => (a.takenAt ?? "9999").localeCompare(b.takenAt ?? "9999"));
  const stops: Omit<Stop, "key" | "index" | "tripId">[] = [];
  for (const p of sorted) {
    const near = stops.find((s) => km(s, p) < SAME_STOP_KM);
    if (near) {
      near.photoIds.push(p.id);
      if (p.takenAt && (!near.date || p.takenAt < near.date)) near.date = p.takenAt;
      near.name ??= p.placeName ?? null;
    } else {
      stops.push({ lat: p.lat, lon: p.lon, photoIds: [p.id], date: p.takenAt, name: p.placeName ?? null });
    }
  }
  return stops;
}

export function tripStops(trip: Trip, photos: Map<string, Photo>): Stop[] {
  const located: Located[] = trip.photoIds
    .map((id) => photos.get(id))
    .filter((p): p is Photo & { lat: number; lon: number } => typeof p?.lat === "number" && typeof p?.lon === "number")
    .map((p) => ({ id: p.id, lat: p.lat, lon: p.lon, takenAt: p.takenAt, placeName: p.placeName }));

  const groups = groupStops(located);
  // 照片都沒定位時，用手動搜尋的地點當唯一一站
  if (groups.length === 0 && trip.lat !== null && trip.lon !== null) {
    groups.push({ lat: trip.lat, lon: trip.lon, photoIds: trip.photoIds, date: trip.startDate, name: trip.place });
  }
  return groups.map((g, index) => ({ ...g, key: `${trip.id}:${index}`, tripId: trip.id, index }));
}
