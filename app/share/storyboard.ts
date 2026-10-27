import { km, type Stop } from "../lib/trip-stops";
import type { Photo, Trip } from "../lib/trips-db";

// 3D 地標打卡短片的分鏡：每一站用哪張照片、從地圖長出什麼、怎麼移動到下一站、結尾特效怎麼組

export const MAX_SCENES = 6;

export type Point = { x: number; y: number }; // 照片上的位置（0～1）

// 每一站從地圖長出來的東西
export type Pop = "landmark" | "subject" | "photo";
export const POPS: { id: Pop; label: string; hint: string }[] = [
  { id: "landmark", label: "🏛️ 地標模型", hint: "AI 把照片裡的地標做成 3D 迷你模型（需要金鑰）" },
  { id: "subject", label: "🙋 人或主角", hint: "點照片選要跳出來的人或東西" },
  { id: "photo", label: "📷 直接進照片", hint: "圖釘插下去後直接進到照片" },
];

export type SceneSetup = { pop: Pop; point: Point; label?: string }; // label：使用者自己改的站名

// 移動到下一站的方式，依距離自動決定
export type Travel = "stay" | "walk" | "car" | "plane";
export function travelFor(distanceKm: number): Travel {
  if (distanceKm < 0.01) return "stay"; // 10 公尺內（幾乎同一個點）才繞一圈
  if (distanceKm < 5) return "walk";
  if (distanceKm < 300) return "car";
  return "plane";
}
// 距離文字：1 公里內用公尺
export const fmtDist = (distanceKm: number) =>
  distanceKm < 1 ? `${Math.max(10, Math.round((distanceKm * 1000) / 10) * 10)} m` : distanceKm < 10 ? `${distanceKm.toFixed(1)} km` : `${Math.round(distanceKm).toLocaleString()} km`;

// 讓兩點在畫面上相距約 px 個（CSS）像素所需的地圖放大程度（MapLibre 圖磚 512px）
export const zoomForDistance = (distanceKm: number, lat: number, px: number) =>
  Math.log2((40075016.686 * Math.cos((lat * Math.PI) / 180) * px) / (512 * Math.max(distanceKm * 1000, 5)));

export const TRAVEL_LABEL: Record<Travel, string> = { stay: "👣 附近走走", walk: "👣 步行", car: "🚗 開車", plane: "✈️ 飛過去" };

// 結尾特效積木：主角 × 動作 × 粒子 × 跟標題的互動
export type Action = "dash" | "jump" | "spin" | "zoom" | "freeze";
export type Impact = "smash" | "splash" | "push" | "stamp";
export const ACTIONS: { id: Action; label: string }[] = [
  { id: "dash", label: "⚡ 衝出去" },
  { id: "jump", label: "🦘 跳起來" },
  { id: "spin", label: "🌀 旋轉飛走" },
  { id: "zoom", label: "🔍 衝向鏡頭" },
  { id: "freeze", label: "📸 定格拍立得" },
];
export const IMPACTS: { id: Impact; label: string }[] = [
  { id: "smash", label: "💥 撞碎標題" },
  { id: "splash", label: "💦 噴滿畫面" },
  { id: "push", label: "👉 把標題推進來" },
  { id: "stamp", label: "🔖 蓋章" },
];
export const PARTICLES = ["✨", "❄️", "🌸", "🍂", "💧", "🎈", "🐟", "🎉", "⭐", "🔥"];

export type Finale = { point: Point; action: Action; particle: string; impact: Impact; subject: string | null };

// 萬用結尾：定格成拍立得、標題像印章一樣蓋下來，什麼照片都適合
export const DEFAULT_FINALE: Finale = { point: { x: 0.5, y: 0.55 }, action: "freeze", particle: "✨", impact: "stamp", subject: null };
export const DEFAULT_POINT: Point = { x: 0.5, y: 0.55 };

export type Scene = {
  photoId: string;
  blob: Blob;
  lat: number;
  lon: number;
  label: string;
  date: string | null; // M/D
  pop: Pop;
  point: Point;
};

export type Story = {
  scenes: Scene[];
  finale: Finale;
  guide: { image: string; facing: "left" | "right" } | null; // 帶路的夥伴（null 就只有腳印）
};

// 照片的拍攝位置：照片自己的 GPS → 所在那一站 → 旅程的地點
export function photoLocation(photo: Photo, stops: Stop[], trip: Trip) {
  if (typeof photo.lat === "number" && typeof photo.lon === "number") return { lat: photo.lat, lon: photo.lon };
  const stop = stops.find((s) => s.photoIds.includes(photo.id));
  if (stop) return { lat: stop.lat, lon: stop.lon };
  if (trip.lat !== null && trip.lon !== null) return { lat: trip.lat, lon: trip.lon };
  return null;
}

export const shortDate = (iso: string | null) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : null);

export { km };
