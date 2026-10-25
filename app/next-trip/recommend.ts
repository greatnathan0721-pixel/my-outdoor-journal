import type { CultureEvent } from "../api/events/route";
import {
  islandGateways,
  origins,
  spots,
  tripTypes,
  type Island,
  type Transport,
  type TripType,
} from "./taiwan-data";

type LatLon = [number, number];

export type Preferences = {
  types: TripType[];
  origin: string;
  transport: Transport;
  maxMinutes: number;
  stayHours: number;
  date: string; // YYYY-MM-DD
  allowIslands: boolean;
};

export type Recommendation = {
  key: string;
  title: string;
  place: string;
  desc: string;
  minutes: number;
  via?: string;
  link: string;
  linkLabel: string;
  badges: string[];
  misses: string[]; // 沒達到的條件，空陣列代表完全符合
  score: number;
};

const MIN_RESULTS = 10;
const MAX_RESULTS = 15;

function haversineKm([lat1, lon1]: LatLon, [lat2, lon2]: LatLon) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// 粗估路上的時間：直線距離 × 1.35 當作實際路程，市區慢、長途快
function groundMinutes(from: LatLon, to: LatLon, transport: Transport) {
  const road = haversineKm(from, to) * 1.35;
  if (transport === "car") {
    return (Math.min(road, 30) / 35) * 60 + (Math.max(road - 30, 0) / 75) * 60 + 5;
  }
  if (transport === "scooter") {
    return (road / 38) * 60 + 5;
  }
  // 大眾運輸：轉乘等車 25 分鐘，長途搭高鐵／火車
  return 25 + (Math.min(road, 20) / 25) * 60 + (Math.max(road - 20, 0) / 80) * 60;
}

function travel(
  from: { at: LatLon; island?: Island },
  to: { at: LatLon; island?: Island },
  transport: Transport,
  allowIslands: boolean,
): { minutes: number; via?: string } | null {
  if (from.island === to.island) return { minutes: groundMinutes(from.at, to.at, transport) };
  if (!allowIslands) return null;

  if (to.island && !from.island) {
    const gw = islandGateways[to.island];
    const minutes = Math.min(...gw.at.map((g) => groundMinutes(from.at, g, transport))) + gw.extra;
    return { minutes, via: gw.label };
  }
  if (from.island && !to.island) {
    const gw = islandGateways[from.island];
    const minutes = gw.extra + Math.min(...gw.at.map((g) => groundMinutes(g, to.at, transport)));
    return { minutes, via: gw.label };
  }
  // 離島到另一個離島，通常要回本島轉機
  return {
    minutes: islandGateways[from.island!].extra + islandGateways[to.island!].extra + 60,
    via: "回本島轉乘",
  };
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const mapsLink = ([lat, lon]: LatLon) => `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

// 交通時間越接近 0 分越加分，最多 0.5
function closeness(minutes: number, maxMinutes: number) {
  const scale = Number.isFinite(maxMinutes) ? maxMinutes : 600;
  return 0.5 * Math.max(0, 1 - minutes / scale);
}

export function recommend(prefs: Preferences, events: CultureEvent[]): Map<TripType, Recommendation[]> {
  const origin = origins.find((o) => o.name === prefs.origin)!;
  const month = Number(prefs.date.slice(5, 7));
  const tripEnd = addDays(prefs.date, Math.max(1, Math.ceil(prefs.stayHours / 24)) - 1);
  const results = new Map<TripType, Recommendation[]>();

  // 檢查哪些條件沒達到；空陣列代表完全符合
  function check(to: { at: LatLon; island?: Island }, minHours: number) {
    const t = travel(origin, to, prefs.transport, true)!;
    const misses: string[] = [];
    if (t.via && !prefs.allowIslands) misses.push("需搭飛機或船");
    if (t.minutes > prefs.maxMinutes) misses.push("超出你設定的交通時間");
    if (minHours > prefs.stayHours) misses.push("建議停留更久");
    // 條件差越多，排越後面
    const penalty = misses.length + Math.max(0, t.minutes - prefs.maxMinutes) / 60;
    return { ...t, misses, penalty };
  }

  for (const type of prefs.types) {
    const list: (Recommendation & { penalty: number })[] = [];
    const liveCategories = tripTypes.find((t) => t.id === type)?.live;

    // 精選景點
    for (const spot of spots) {
      if (!spot.types.includes(type)) continue;
      const t = check(spot, spot.hours[0]);

      const fit = spot.hours[1] >= prefs.stayHours ? 1 : spot.hours[1] / prefs.stayHours;
      const inSeason = spot.months ? spot.months.includes(month) : undefined;
      const badges = [`建議停留 ${formatHours(spot.hours)}`];
      if (inSeason === true) badges.push("正值最佳季節");
      if (inSeason === false) badges.push(`最佳季節：${formatMonths(spot.months!)}`);

      list.push({
        key: `spot-${spot.name}`,
        title: spot.name,
        place: spot.county,
        desc: spot.desc,
        minutes: t.minutes,
        via: t.via,
        link: mapsLink(spot.at),
        linkLabel: "在 Google 地圖查看",
        badges,
        misses: t.misses,
        penalty: t.penalty,
        score: fit + closeness(t.minutes, prefs.maxMinutes) + (inSeason === true ? 0.3 : inSeason === false ? -0.6 : 0),
      });
    }

    // 即時藝文活動：一定要在出遊期間有場次
    if (liveCategories) {
      const seen = new Set<string>();
      for (const event of events) {
        if (!liveCategories.includes(event.category) || seen.has(event.title)) continue;

        let best: { show: CultureEvent["shows"][number] } & ReturnType<typeof check> | null = null;
        for (const show of event.shows) {
          if (show.start > tripEnd || show.end < prefs.date) continue;
          const t = check({ at: [show.lat, show.lon], island: islandOf(show.address) }, 0);
          if (!best || t.penalty < best.penalty || (t.penalty === best.penalty && t.minutes < best.minutes)) {
            best = { show, ...t };
          }
        }
        if (!best) continue;
        seen.add(event.title);

        const { show } = best;
        const endsSoon = show.end <= addDays(prefs.date, 14) && show.start !== show.end;
        const badges = [show.start === show.end ? `演出日期 ${show.start}` : `${show.start} ～ ${show.end}`];
        if (endsSoon) badges.push("即將結束");
        if (show.price) badges.push(show.price.length > 24 ? `${show.price.slice(0, 24)}…` : show.price);

        list.push({
          key: `event-${event.id}`,
          title: event.title,
          place: [show.venue, show.address].filter(Boolean).join("｜"),
          desc: [event.unit && `主辦：${event.unit}`, show.approx && "（場地沒有座標，交通時間以縣市中心估算）"]
            .filter(Boolean)
            .join(" "),
          minutes: best.minutes,
          via: best.via,
          link: event.url || mapsLink([show.lat, show.lon]),
          linkLabel: event.url ? "活動官方資訊" : "在 Google 地圖查看",
          badges,
          misses: best.misses,
          penalty: best.penalty,
          score: (prefs.stayHours <= 5 ? 1 : 0.6) + closeness(best.minutes, prefs.maxMinutes) + (endsSoon ? 0.2 : 0),
        });
      }
    }

    // 完全符合的優先；不到 10 個時，用「差一點符合」的補滿
    const matched = list.filter((r) => r.misses.length === 0).sort((a, b) => b.score - a.score);
    const nearMiss = list
      .filter((r) => r.misses.length > 0)
      .sort((a, b) => a.penalty - b.penalty || b.score - a.score);
    const picked = matched.slice(0, MAX_RESULTS);
    if (picked.length < MIN_RESULTS) picked.push(...nearMiss.slice(0, MIN_RESULTS - picked.length));
    results.set(type, picked);
  }

  return results;
}

function islandOf(address: string): Island | undefined {
  if (address.includes("澎湖")) return "penghu";
  if (address.includes("金門")) return "kinmen";
  if (address.includes("連江") || address.includes("馬祖")) return "matsu";
  if (address.includes("琉球")) return "liuqiu";
  if (address.includes("綠島")) return "greenisland";
  if (address.includes("蘭嶼")) return "orchid";
  return undefined;
}

function formatHours([min, max]: [number, number]) {
  const f = (h: number) => (h < 24 ? `${h} 小時` : h <= 36 ? "兩天一夜" : "三天兩夜");
  if (max < 24) return `${min}–${max} 小時`;
  return f(min) === f(max) ? f(max) : `${f(min)}～${f(max)}`;
}

function formatMonths(months: number[]) {
  return `${months[0]}–${months[months.length - 1]} 月`;
}

export function formatMinutes(minutes: number) {
  const m = Math.round(minutes / 10) * 10;
  if (m < 60) return `${Math.max(m, 10)} 分鐘`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} 小時 ${rest} 分` : `${h} 小時`;
}
