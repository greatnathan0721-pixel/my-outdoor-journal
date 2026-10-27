import type { Creature } from "../my-farm/collection";
import type { Stop } from "../lib/trip-stops";
import type { Photo, Trip } from "../lib/trips-db";
import type { Story } from "./storyboard";

// 生成短片和長圖需要的所有素材
export type ShareInput = {
  trip: Trip;
  title: string;
  subtitle: string;
  caption: string;
  hashtags: string[];
  stops: Stop[];
  photos: { blob: Blob; label: string | null; date: string | null }[];
  buddies: { name: string; image: string; cutout: boolean }[];
  story: Story; // 3D 地標打卡短片的分鏡
  handFont: string; // 手寫字型（標題用）
};

// 本機日期（YYYY-MM-DD）
const localDate = (iso: string) => new Date(iso).toLocaleDateString("sv-SE");

// 在旅程日期之間收服的夥伴，就算是「這趟收服的」
export function caughtDuring(trip: Trip, c: Creature) {
  const d = localDate(c.caughtAt);
  return d >= trip.startDate && d <= (trip.endDate || trip.startDate);
}

// 照片拍在哪一站（用來在影片和長圖上標地名）
export function photoLabel(photo: Photo, stops: Stop[], trip: Trip) {
  return stops.find((s) => s.photoIds.includes(photo.id))?.name ?? photo.placeName ?? trip.place;
}

export function defaultText(trip: Trip, stops: Stop[], buddies: string[]) {
  const dates = trip.endDate && trip.endDate !== trip.startDate ? `${trip.startDate} ～ ${trip.endDate}` : trip.startDate;
  const names = stops.map((s) => s.name).filter((n): n is string => !!n);
  const lines = [
    `📍 ${trip.place}｜${dates}`,
    names.length > 1 && `走過 ${names.length} 站：${names.join(" → ")}`,
    buddies.length > 0 && `🐾 這趟收服了 ${buddies.join("、")}`,
  ].filter(Boolean);
  const tag = trip.place.replace(/[\s,，、.。·・()（）]/g, "").slice(0, 12);
  return {
    title: trip.place,
    subtitle: dates,
    caption: lines.join("\n"),
    hashtags: ["我的旅遊遊記", tag, "旅行日記", "travel"].filter((t, i, a) => t && a.indexOf(t) === i),
  };
}

// 照片縮小（送給 AI 參考用，省流量也省錢）
export async function shrinkPhoto(blob: Blob, max: number) {
  const img = await createImageBitmap(blob);
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * s);
  canvas.height = Math.round(img.height * s);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  img.close();
  return canvas;
}
