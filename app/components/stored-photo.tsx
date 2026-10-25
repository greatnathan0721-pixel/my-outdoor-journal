"use client";

// 同一個 Blob 只建立一次網址。照片本來就都留在記憶體裡（日記資料），
// 不在元件卸載時 revoke，避免開發模式重複執行 effect 時把還在用的網址釋放掉
const urls = new WeakMap<Blob, string>();

function urlFor(blob: Blob) {
  let url = urls.get(blob);
  if (!url) {
    url = URL.createObjectURL(blob);
    urls.set(blob, url);
  }
  return url;
}

// 顯示存在 IndexedDB 裡的照片（Blob）
export default function StoredPhoto({ blob, alt, className = "" }: { blob: Blob; alt: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- 本機 Blob 網址，不需要 next/image 最佳化
  return <img src={urlFor(blob)} alt={alt} className={className} />;
}
