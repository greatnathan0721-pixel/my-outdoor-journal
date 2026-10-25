import type { Metadata } from "next";
import Image from "next/image";
import DartGame from "./dart-game";

export const metadata: Metadata = {
  title: "下一站去哪裡｜我的旅遊遊記",
};

export default function NextTripPage() {
  return (
    <div className="flex flex-1 flex-col bg-sand text-ink">
      <header className="relative isolate h-[50vh] max-h-[560px] min-h-[340px] overflow-hidden">
        <Image
          src="/images/hero-trail.jpg"
          alt="多洛米蒂山間延伸的健行步道"
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-[50%_45%]"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-black/40 via-black/10 to-sand" />
        <div className="mx-auto flex h-full max-w-5xl flex-col justify-center px-4 pb-20 sm:px-6">
          <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
            🧭 Trail Finder
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-md sm:text-5xl">下一站去哪裡？</h1>
          <p className="mt-3 max-w-xl text-lg text-white/90 drop-shadow">
            出國就射飛鏢決定，國內就讓系統依你的偏好推薦。
          </p>
        </div>
      </header>

      <main className="relative mx-auto -mt-24 w-full max-w-5xl px-4 pb-20 sm:px-6">
        <DartGame />
      </main>
    </div>
  );
}
