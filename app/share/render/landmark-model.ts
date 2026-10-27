import { aiFetch } from "../../lib/ai-settings";
import { makeCutout } from "../../my-farm/cutout";
import { shrinkPhoto } from "../share-input";
import type { Point, Pop } from "../storyboard";
import { bitmapFrom, canvasToBlob } from "./canvas";

// 每一站要從地圖上「長出來」的東西
// 地標模型：AI 把照片裡的地標做成 3D 迷你模型（要金鑰）；人或主角：在照片上點的位置去背；都失敗就用立起來的照片卡

export type LandmarkModel = { image: HTMLCanvasElement; kind: "ai" | "cutout" | "card" };

// 同一張照片同一種做法只做一次（AI 要錢也要時間），重新生成影片時直接拿來用
const cache = new Map<string, Promise<LandmarkModel>>();

export function sceneModel(
  photo: { id: string; blob: Blob },
  pop: Pop,
  point: Point,
  place: string,
  ai: { key: string; model: string } | null,
): Promise<LandmarkModel> | null {
  if (pop === "photo") return null;
  const useAi = pop === "landmark" && ai;
  const id = useAi ? `${photo.id}:ai:${ai.model}` : `${photo.id}:cut:${point.x.toFixed(3)},${point.y.toFixed(3)}`;
  let job = cache.get(id);
  if (!job) {
    job = useAi ? fromAi(photo.blob, place, ai) : fromPhoto(photo.blob, point);
    cache.set(id, job);
    job.catch(() => cache.delete(id));
  }
  return job;
}

// 結尾特效用：把最後一張照片裡的主角切出來，連同它在照片裡的位置
// 切不出來、或主角碰到照片邊緣（只拍到半身）就不用，改用「定格拍立得」
export type Subject = { image: HTMLCanvasElement; box: { x: number; y: number; w: number; h: number } };
const subjects = new Map<string, Promise<Subject | null>>();

export function subjectOf(photo: { id: string; blob: Blob }, point: Point) {
  const id = `${photo.id}:${point.x.toFixed(3)},${point.y.toFixed(3)}`;
  let job = subjects.get(id);
  if (!job) {
    job = (async () => {
      try {
        const cut = await makeCutout(await shrinkPhoto(photo.blob, 1024), point, 700);
        if (!cut || cut.clipped || cut.coverage < 0.004 || cut.coverage > 0.7) return null;
        return { image: await canvasFrom(cut.dataUrl), box: cut.box };
      } catch {
        return null;
      }
    })();
    subjects.set(id, job);
  }
  return job;
}

async function fromAi(blob: Blob, place: string, ai: { key: string; model: string }): Promise<LandmarkModel> {
  const form = new FormData();
  form.set("model", ai.model);
  form.set("place", place);
  form.append("photo", await canvasToBlob(await shrinkPhoto(blob, 1024), "image/jpeg", 0.88), "photo.jpg");
  const res = await aiFetch("/api/ai/landmark", ai.key, { method: "POST", body: form });
  const bitmap = await bitmapFrom(await res.blob());
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  if (hasTransparency(canvas)) return { image: trim(canvas), kind: "ai" };
  // 模型給的是白底：點中間去背
  const cut = await makeCutout(canvas, { x: 0.5, y: 0.5 }, 900);
  return { image: cut ? await canvasFrom(cut.dataUrl) : canvas, kind: "ai" };
}

async function fromPhoto(blob: Blob, point: Point): Promise<LandmarkModel> {
  const photo = await shrinkPhoto(blob, 1024);
  try {
    const cut = await makeCutout(photo, point, 900);
    // 主角碰到照片邊緣（只拍到半身）就改用照片卡，免得從地圖長出半個人
    if (cut && !cut.clipped && cut.coverage > 0.006 && cut.coverage < 0.85) return { image: await canvasFrom(cut.dataUrl), kind: "cutout" };
  } catch {
    // 去背模型載不到就用照片卡
  }
  return { image: photo, kind: "card" };
}

async function canvasFrom(url: string) {
  const bitmap = await bitmapFrom(url);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

function hasTransparency(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  return [
    [1, 1],
    [w - 2, 1],
    [1, h - 2],
    [w - 2, h - 2],
  ].every(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] < 20);
}

// 裁掉四周透明的部分
function trim(canvas: HTMLCanvasElement) {
  const { width: w, height: h } = canvas;
  const data = canvas.getContext("2d")!.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y += 2)
    for (let x = 0; x < w; x += 2)
      if (data[(y * w + x) * 4 + 3] > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (maxX < 0) return canvas;
  const out = document.createElement("canvas");
  out.width = maxX - minX + 2;
  out.height = maxY - minY + 2;
  out.getContext("2d")!.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}
