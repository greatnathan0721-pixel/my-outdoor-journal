"use client";

export type PhotoInfo = {
  blob: Blob; // 縮小過的照片
  takenAt: string | null; // 拍攝日期 YYYY-MM-DD
  lat: number | null;
  lon: number | null;
};

// 讀出照片裡記錄的拍攝時間與 GPS 位置（EXIF），再把照片縮小以節省空間
export async function preparePhoto(file: File, maxSize = 1600): Promise<PhotoInfo> {
  let takenAt: string | null = null;
  let lat: number | null = null;
  let lon: number | null = null;
  try {
    const exifr = (await import("exifr")).default;
    // GPS 要用 exifr.gps() 另外讀，parse 搭配 pick 會把換算座標需要的原始欄位濾掉
    const [data, gps] = await Promise.all([
      exifr.parse(file, ["DateTimeOriginal", "CreateDate"]).catch(() => null),
      exifr.gps(file).catch(() => null),
    ]);
    const date: Date | undefined = data?.DateTimeOriginal ?? data?.CreateDate;
    if (date instanceof Date && !Number.isNaN(date.getTime())) {
      takenAt = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }
    if (typeof gps?.latitude === "number" && typeof gps?.longitude === "number") {
      lat = gps.latitude;
      lon = gps.longitude;
    }
  } catch {
    // 沒有 EXIF 也沒關係
  }

  return { blob: await shrink(file, maxSize), takenAt, lat, lon };
}

async function shrink(file: File, maxSize: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // 瀏覽器無法解碼（例如部分 HEIC），就存原檔
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85));
}
