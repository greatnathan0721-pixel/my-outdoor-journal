import type { Metadata } from "next";
import Image from "next/image";
import Guide from "./guide";
import TarotReading from "./tarot-reading";

export const metadata: Metadata = {
  title: "旅遊塔羅牌陣｜我的旅遊遊記",
};

export default function TarotPage() {
  return (
    <div className="flex flex-1 flex-col bg-sand text-ink">
      <header className="relative isolate h-[46vh] max-h-[520px] min-h-[320px] overflow-hidden">
        <Image
          src="/images/hero-trail.jpg"
          alt="多洛米蒂山間延伸的健行步道"
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-[50%_35%]"
        />
        {/* 比較深的漸層，帶一點黃昏占卜的氣氛 */}
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-[#1c1430]/70 via-black/25 to-sand" />
        <div className="mx-auto flex h-full max-w-5xl flex-col justify-center px-4 pb-16 sm:px-6">
          <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
            🔮 Travel Tarot
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-md sm:text-5xl">旅遊塔羅牌陣</h1>
          <p className="mt-3 max-w-xl text-lg text-white/90 drop-shadow">
            預測旅途運勢、提前避開突發狀況，也幫猶豫不決的你選出下一個目的地。
          </p>
        </div>
      </header>

      <main className="relative mx-auto -mt-20 flex w-full max-w-5xl flex-col gap-6 px-4 pb-20 sm:px-6">
        <TarotReading />
        <Guide />
      </main>
    </div>
  );
}
