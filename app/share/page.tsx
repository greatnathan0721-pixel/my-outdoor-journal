import type { Metadata } from "next";
import { LXGW_WenKai_TC } from "next/font/google";
import ShareStudio from "./share-studio";

export const metadata: Metadata = {
  title: "一鍵分享｜我的旅遊遊記",
};

// 霞鶩文楷：有手寫感的開源中文字型，用在短片和長圖的標題
const handFont = LXGW_WenKai_TC({ weight: "700", preload: false, display: "swap" });

export default function SharePage() {
  return (
    <div className="flex flex-1 flex-col bg-sand text-ink">
      <header className="bg-linear-to-b from-wood-soft to-sand">
        <div className="mx-auto max-w-5xl px-4 pb-6 pt-12 sm:px-6">
          <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-card px-3 py-1 text-sm font-medium text-wood shadow-sm">
            📮 Share Your Trip
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">一鍵分享</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            把一趟旅程的紅釘路線、精選照片和這趟收服的夥伴，合成 15 秒路線短片、IG 打卡長圖，或做成「圖釘插進地圖、地標從地圖長出來」的 3D 地標打卡短片。
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">
        <ShareStudio handFont={handFont.style.fontFamily} />
      </main>
    </div>
  );
}
