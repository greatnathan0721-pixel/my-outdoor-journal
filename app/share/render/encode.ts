import { ArrayBufferTarget, Muxer } from "mp4-muxer";

// 用 WebCodecs 一格一格編碼成 MP4（不是即時錄影），所以每一格可以慢慢畫（例如等地圖圖磚載完），畫面不會破
// 所有影片都用 1080×1920 的座標來畫，裝置不支援 1080p 時會自動縮成 720p

export const W = 1080;
export const H = 1920;
export const FPS = 30;

export function videoSupported() {
  return typeof window !== "undefined" && "VideoEncoder" in window && "VideoFrame" in window;
}

async function pickConfig() {
  const tries = [
    { codec: "avc1.640028", width: 1080, height: 1920, bitrate: 8_000_000 },
    { codec: "avc1.4d0028", width: 1080, height: 1920, bitrate: 8_000_000 },
    { codec: "avc1.42001f", width: 720, height: 1280, bitrate: 4_000_000 },
  ];
  for (const t of tries) {
    const config: VideoEncoderConfig = { ...t, framerate: FPS };
    try {
      if ((await VideoEncoder.isConfigSupported(config)).supported) return config;
    } catch {
      // 換下一個試試
    }
  }
  throw new Error("這個瀏覽器不支援影片編碼，請改用最新版的 Chrome、Edge 或 Safari");
}

export type Stage = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

// draw(t, f)：畫出第 f 格（t 秒）；畫之前已經把座標縮放成 1080×1920
export async function encodeVideo(
  seconds: number,
  draw: (t: number, f: number, stage: Stage) => void | Promise<void>,
  onProgress: (p: number) => void,
): Promise<Blob> {
  if (!videoSupported()) throw new Error("這個瀏覽器不支援影片編碼，請改用最新版的 Chrome、Edge 或 Safari");
  const config = await pickConfig();
  const k = config.width / W;
  const canvas = document.createElement("canvas");
  canvas.width = config.width;
  canvas.height = config.height;
  const ctx = canvas.getContext("2d")!;
  const stage = { canvas, ctx };

  let encodeError: unknown = null;
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: config.width, height: config.height, frameRate: FPS },
    fastStart: "in-memory",
  });
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (encodeError = e),
  });
  encoder.configure(config);

  const frames = Math.round(seconds * FPS);
  try {
    for (let f = 0; f < frames; f++) {
      if (encodeError) throw encodeError;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      await draw(f / FPS, f, stage);
      const frame = new VideoFrame(canvas, { timestamp: Math.round((f * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      encoder.encode(frame, { keyFrame: f % (FPS * 2) === 0 });
      frame.close();
      // 編碼器忙不過來時等一下，免得記憶體爆掉
      while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 5));
      if (f % 3 === 0) {
        onProgress(f / frames);
        await new Promise((r) => setTimeout(r, 0)); // 讓畫面有機會更新進度條
      }
    }
    await encoder.flush();
    if (encodeError) throw encodeError;
    muxer.finalize();
  } finally {
    if (encoder.state !== "closed") encoder.close();
  }
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}
