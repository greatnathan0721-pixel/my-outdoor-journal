"use client";

import type { InteractiveSegmenter } from "@mediapipe/tasks-vision";

// Google MediaPipe「點選去背」：在照片上點一下要的東西，就把它從背景切出來（Apache-2.0）
// WebAssembly 檔放在 public/mediapipe（由 scripts/copy-runtime-assets.mjs 複製），模型約 6MB，第一次使用時下載
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite";

let segmenterPromise: Promise<InteractiveSegmenter> | null = null;

function loadSegmenter() {
  segmenterPromise ??= (async () => {
    const { FilesetResolver, InteractiveSegmenter } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe");
    return InteractiveSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL },
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
  })();
  segmenterPromise.catch(() => (segmenterPromise = null));
  return segmenterPromise;
}

export type Cutout = { dataUrl: string; coverage: number };

// point：照片上被點的位置（0～1）；回傳去背後的透明 PNG，以及主體佔畫面的比例
export async function makeCutout(image: HTMLImageElement | HTMLCanvasElement, point = { x: 0.5, y: 0.5 }, maxSize = 360): Promise<Cutout | null> {
  const segmenter = await loadSegmenter();
  // 手機照片動輒上千萬像素，先縮到 768px 再去背，速度快也省記憶體
  const work = document.createElement("canvas");
  const iw = "naturalWidth" in image ? image.naturalWidth : image.width;
  const ih = "naturalHeight" in image ? image.naturalHeight : image.height;
  const s = Math.min(1, 768 / Math.max(iw, ih));
  work.width = Math.round(iw * s);
  work.height = Math.round(ih * s);
  work.getContext("2d")!.drawImage(image, 0, 0, work.width, work.height);
  const result = segmenter.segment(work, { keypoint: point });
  const mask = result.confidenceMasks?.[0];
  if (!mask) {
    result.close();
    return null;
  }
  const w = mask.width;
  const h = mask.height;
  const conf = mask.getAsFloat32Array();
  // 有些版本 0 號遮罩是背景：被點的那個位置信心比較低的話，就反過來用
  const at = conf[Math.min(h - 1, Math.floor(point.y * h)) * w + Math.min(w - 1, Math.floor(point.x * w))];
  const flip = at < 0.5;
  const alpha = new Float32Array(w * h);
  let minX = w, minY = h, maxX = -1, maxY = -1, count = 0;
  for (let i = 0; i < conf.length; i++) {
    const a = flip ? 1 - conf[i] : conf[i];
    alpha[i] = a;
    if (a > 0.5) {
      const x = i % w;
      const y = (i / w) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      count++;
    }
  }
  result.close();
  if (count < w * h * 0.005) return null; // 幾乎沒切到東西

  // 把照片畫到跟遮罩一樣大的畫布上，套用透明度（邊緣用信心值做柔邊）
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(work, 0, 0, w, h);
  const pixels = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < alpha.length; i++) {
    const a = Math.min(1, Math.max(0, (alpha[i] - 0.3) / 0.4));
    pixels.data[i * 4 + 3] = Math.round(a * 255);
  }
  ctx.putImageData(pixels, 0, 0);

  // 裁到主體的範圍，留一點邊，再縮成小圖
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const sw = Math.min(w, maxX + pad) - sx;
  const sh = Math.min(h, maxY + pad) - sy;
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(sw * scale));
  out.height = Math.max(1, Math.round(sh * scale));
  out.getContext("2d")!.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return { dataUrl: out.toDataURL("image/png"), coverage: count / (w * h) };
}
