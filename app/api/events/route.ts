import { cacheLife } from "next/cache";
import type { NextRequest } from "next/server";
import { origins } from "../../next-trip/taiwan-data";

// 文化部「文化資料開放服務網」藝文活動 API
// 類別：1 音樂、2 戲劇、3 舞蹈、4 親子、6 展覽、17 演唱會
const SOURCE = "https://cloud.culture.tw/frontsite/trans/SearchShowAction.do?method=doFindTypeJ&category=";
const ALLOWED = new Set(["1", "2", "3", "4", "6", "17"]);

export type CultureEvent = {
  id: string;
  title: string;
  category: string;
  unit: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  url: string;
  shows: {
    start: string; // YYYY-MM-DD
    end: string;
    venue: string;
    address: string;
    price: string;
    lat: number;
    lon: number;
    approx: boolean; // 沒有座標，用縣市中心估算
  }[];
};

type RawShow = {
  time: string;
  endTime: string;
  location: string;
  locationName: string;
  price: string;
  latitude: string | null;
  longitude: string | null;
};

type RawEvent = {
  UID: string;
  title: string;
  category: string;
  showUnit: string;
  startDate: string;
  endDate: string;
  webSales: string;
  sourceWebPromote: string;
  showInfo: RawShow[];
};

// 很多活動沒有座標，就用地址裡的縣市中心來估算位置
function countyCenter(address: string) {
  const normalized = address.replaceAll("臺", "台");
  return origins.find((o) => normalized.startsWith(o.name))?.at;
}

const inTaiwan = (lat: number, lon: number) => lat > 21 && lat < 27 && lon > 118 && lon < 123;

// "2026/10/25 09:00:00" -> "2026-10-25"
const toDate = (s: string) => s.slice(0, 10).replaceAll("/", "-");

async function getCategory(category: string): Promise<CultureEvent[]> {
  "use cache";
  cacheLife("hours");

  const res = await fetch(SOURCE + category);
  if (!res.ok) throw new Error(`文化部 API 回應 ${res.status}`);
  const raw: RawEvent[] = await res.json();

  return raw
    .map((e) => ({
      id: e.UID,
      title: e.title.trim(),
      category: e.category,
      unit: e.showUnit,
      startDate: toDate(e.startDate),
      endDate: toDate(e.endDate),
      url: e.sourceWebPromote || e.webSales,
      shows: e.showInfo.flatMap((s) => {
        if (s.locationName.includes("線上")) return [];
        const lat = Number(s.latitude);
        const lon = Number(s.longitude);
        const exact = inTaiwan(lat, lon);
        const at = exact ? ([lat, lon] as const) : countyCenter(s.location);
        if (!at) return [];
        return [
          {
            start: toDate(s.time),
            end: toDate(s.endTime || s.time),
            venue: s.locationName,
            address: s.location,
            price: s.price,
            lat: at[0],
            lon: at[1],
            approx: !exact,
          },
        ];
      }),
    }))
    .filter((e) => e.shows.length > 0);
}

export async function GET(request: NextRequest) {
  const categories = (request.nextUrl.searchParams.get("categories") ?? "")
    .split(",")
    .filter((c) => ALLOWED.has(c));

  try {
    const lists = await Promise.all(categories.map(getCategory));
    return Response.json({ events: lists.flat() });
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 502 });
  }
}
