import Link from "next/link";
import { navLinks } from "./site-nav";

export default function SiteFooter() {
  return (
    <footer className="relative mt-auto bg-[#1f3b2b] text-[#e9e3d4]">
      {/* 頂部的山稜線 */}
      <svg className="absolute -top-10 left-0 h-10 w-full text-[#1f3b2b]" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden>
        <path d="M0 10 L0 6 L12 2 L22 6 L34 1 L46 6 L58 3 L70 7 L82 2 L92 5 L100 3 L100 10 Z" fill="currentColor" />
      </svg>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2 text-lg font-bold text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2e6b45]">🧭</span>
            我的旅遊遊記
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#c9c2b0]">
            把每一段旅程釘在地圖上，讓照片帶你回到那些風、那些山、那片海。
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#e2864f]">探索</p>
          <ul className="flex flex-col gap-2 text-sm">
            {navLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="hover:text-white hover:underline">
                  {l.emoji} {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-[#e2864f]">你的資料</p>
          <p className="text-sm leading-relaxed text-[#c9c2b0]">
            遊記和照片只存在你這台裝置的瀏覽器裡，不會上傳到伺服器。記得到首頁定期下載備份，換手機時才能救回所有回憶。
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-[#a59f8f]">
        地圖 © OpenFreeMap・OpenMapTiles・Natural Earth・地圖資料與地名搜尋 © OpenStreetMap contributors
        <br />
        主視覺照片「Passo Pordoi」by{" "}
        <a href="https://commons.wikimedia.org/wiki/File:Passo_Pordoi-bops_01.jpg" className="underline hover:text-white" target="_blank" rel="noopener noreferrer">
          Bops92
        </a>
        ，授權{" "}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.zh_TW" className="underline hover:text-white" target="_blank" rel="noopener noreferrer">
          CC BY-SA 4.0
        </a>
      </div>
    </footer>
  );
}
