// 合成短片和長圖共用的小工具

export const C = {
  sand: "#f3ede1",
  card: "#fffcf6",
  ink: "#1f2a24",
  muted: "#6b6a5e",
  line: "#e3d9c6",
  forest: "#2e6b45",
  moss: "#e1ebd5",
  wood: "#b8562b",
  pin: "#d63a2b",
  pinDeep: "#a61e14",
};

export const SANS = '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif';

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
// 彈一下的出場效果
export const easeBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;

export async function bitmapFrom(src: Blob | string) {
  const blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
  return createImageBitmap(blob);
}

type Drawable = CanvasImageSource & { width: number; height: number };

// 像 CSS object-cover：填滿框框、多的裁掉；zoom 和焦點 (fx, fy) 用來做慢慢推近的效果
export function drawCover(ctx: CanvasRenderingContext2D, img: Drawable, x: number, y: number, w: number, h: number, zoom = 1, fx = 0.5, fy = 0.5) {
  const s = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
}

export function drawContain(ctx: CanvasRenderingContext2D, img: Drawable, x: number, y: number, w: number, h: number) {
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh), dw, dh); // 靠下對齊，像站在地上
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// 中文一個字一個字換行；英文單字盡量不拆開
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const tokens = para.match(/[A-Za-z0-9#@'’.,!?-]+|\s|./gu) ?? [];
    let line = "";
    for (const tok of tokens) {
      if (ctx.measureText(line + tok).width > maxWidth && line) {
        lines.push(line.trimEnd());
        line = tok.trimStart();
      } else line += tok;
    }
    lines.push(line);
  }
  return lines;
}

export function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, weight: number, max: number, maxWidth: number) {
  let size = max;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > 20 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

// 等手寫字型下載好（Google Fonts 的中文字型是分片下載，要告訴瀏覽器會用到哪些字）
export async function loadFont(family: string, text: string) {
  try {
    await Promise.race([document.fonts.load(`700 40px ${family}`, text), new Promise((r) => setTimeout(r, 5000))]);
  } catch {
    // 載不到就用系統字型
  }
}

// 紅色地圖圖釘，尖端在 (x, y)
export function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, label?: string, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const r = size / 2;
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = size * 0.25;
  ctx.shadowOffsetY = size * 0.08;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-r * 0.3, -r * 0.9, -r, -r * 1.35, -r, -r * 2.1);
  ctx.arc(0, -r * 2.1, r, Math.PI, 0);
  ctx.bezierCurveTo(r, -r * 1.35, r * 0.3, -r * 0.9, 0, 0);
  ctx.fillStyle = C.pin;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = size * 0.09;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  if (label) {
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${size * 0.62}px ${SANS}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, -r * 2.1 + size * 0.03);
  } else {
    ctx.beginPath();
    ctx.arc(0, -r * 2.1, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }
  ctx.restore();
}

// 網站標誌（跟 app/components/logo.tsx 同一張圖），畫在 (x, y) 大小 size
export function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);
  roundRect(ctx, 0, 0, 64, 64, 16);
  ctx.fillStyle = "#2e6b45";
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = "#9fd08a";
  ctx.fill(new Path2D("M4 52 L20 30 L30 42 L40 26 L60 52 Z"));
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill(new Path2D("M36 32 L40 26 L44 32 Z"));
  ctx.fillStyle = "#7fbf6a";
  ctx.fillRect(4, 50, 56, 10);
  const pin = new Path2D("M32 40 C29 34 22 30 22 22 A10 10 0 1 1 42 22 C42 30 35 34 32 40 Z");
  ctx.fillStyle = "#d63a2b";
  ctx.fill(pin);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "#fff";
  ctx.stroke(pin);
  ctx.beginPath();
  ctx.arc(32, 22, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.restore();
}

// 地名標籤：白底圓角小卡
export function drawLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `700 ${size}px ${SANS}`;
  const w = ctx.measureText(text).width + size * 1.1;
  const h = size * 1.7;
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = size * 0.5;
  roundRect(ctx, x - w / 2, y - h, w, h, h / 2);
  ctx.fillStyle = "rgba(255,252,246,0.96)";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.fillStyle = C.ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y - h / 2 + size * 0.05);
  ctx.restore();
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.92) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("圖片輸出失敗"))), type, quality),
  );
}

export const fmtDates = (start: string, end: string) => (end && end !== start ? `${start.replaceAll("-", ".")} – ${end.slice(5).replaceAll("-", ".")}` : start.replaceAll("-", "."));
