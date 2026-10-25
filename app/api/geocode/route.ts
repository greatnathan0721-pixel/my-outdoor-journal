import { cacheLife } from "next/cache";
import type { NextRequest } from "next/server";

// 用 OpenStreetMap 的 Nominatim 把地名轉成座標（或反過來）
// 使用規範：要帶可辨識的 User-Agent、每秒不超過 1 次，所以結果會快取起來
const BASE = "https://nominatim.openstreetmap.org";
const HEADERS = { "User-Agent": "my-travel-diary/0.1 (Next.js learning project)" };

export type Place = { name: string; detail: string; lat: number; lon: number };

type RawPlace = { name?: string; display_name: string; lat: string; lon: string };

async function search(q: string): Promise<Place[]> {
  "use cache";
  cacheLife("weeks");
  const res = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=5&accept-language=zh-TW`, {
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`Nominatim 回應 ${res.status}`);
  const rows: RawPlace[] = await res.json();
  return rows.map((r) => ({
    name: r.name || r.display_name.split(",")[0],
    detail: r.display_name,
    lat: Number(r.lat),
    lon: Number(r.lon),
  }));
}

async function reverse(lat: string, lon: string): Promise<Place | null> {
  "use cache";
  cacheLife("weeks");
  const res = await fetch(`${BASE}/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=10&accept-language=zh-TW`, {
    headers: HEADERS,
  });
  if (!res.ok) throw new Error(`Nominatim 回應 ${res.status}`);
  const r: RawPlace & { error?: string } = await res.json();
  if (r.error) return null;
  return { name: r.name || r.display_name.split(",")[0], detail: r.display_name, lat: Number(r.lat), lon: Number(r.lon) };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const lat = params.get("lat");
  const lon = params.get("lon");

  try {
    if (q) return Response.json({ places: await search(q.slice(0, 100)) });
    if (lat && lon && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lon))) {
      // 座標取到小數第三位（約 100 公尺），提高快取命中率
      return Response.json({ place: await reverse(Number(lat).toFixed(3), Number(lon).toFixed(3)) });
    }
    return Response.json({ error: "請提供 q 或 lat/lon" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
}
