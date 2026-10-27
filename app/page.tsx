import Image from "next/image";
import Link from "next/link";
import DiaryHome, { DiaryStats } from "./home/diary-home";

const features = [
  { href: "/share", emoji: "📮", title: "一鍵分享", desc: "把路線、照片和收服的夥伴合成路線短片、打卡長圖和 3D 地標打卡短片。" },
  { href: "/next-trip", emoji: "🧭", title: "下一站去哪", desc: "射飛鏢決定出國地點，或依偏好推薦台灣景點與最新展覽。" },
  { href: "/tarot", emoji: "🔮", title: "旅遊塔羅", desc: "出發前抽一組牌，預測旅途運勢、避開突發狀況。" },
  { href: "/my-farm", emoji: "🐾", title: "我的神奇寶貝世界", desc: "拍下旅途中遇到的動植物收服，讓牠們搬進你的農場一起生活。" },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* 主視覺 */}
      <section className="relative isolate overflow-hidden">
        <Image
          src="/images/hero-trail.jpg"
          alt="多洛米蒂山間延伸的健行步道"
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-[50%_45%]"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-b from-black/45 via-black/25 to-sand" />
        <div className="mx-auto flex min-h-[72vh] max-w-6xl flex-col justify-center gap-6 px-4 pb-32 pt-16 sm:px-6">
          <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-sm font-medium text-white backdrop-blur-sm">
            🥾 Travel Journal
          </p>
          <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight text-white drop-shadow-md sm:text-6xl">
            我的旅遊遊記
          </h1>
          <p className="max-w-xl text-lg text-white/90 drop-shadow">
            把每一段旅程釘在世界地圖上，讓照片帶你回到那些山、那片海、那條走過的步道。
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/new-trip"
              className="flex h-12 items-center rounded-full bg-forest px-7 font-semibold text-on-accent shadow-lg transition-colors hover:bg-forest-deep"
            >
              📝 記錄新的旅程
            </Link>
            <a
              href="#map"
              className="flex h-12 items-center rounded-full border border-white/60 bg-white/15 px-7 font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
            >
              🗺️ 看我的足跡
            </a>
          </div>
          <div className="max-w-3xl">
            <DiaryStats />
          </div>
        </div>
      </section>

      <main className="relative mx-auto -mt-24 flex w-full max-w-6xl flex-col gap-8 px-4 pb-24 sm:px-6">
        <DiaryHome />

        {/* 其他功能 */}
        <section>
          <div className="mb-4 px-1">
            <p className="text-sm font-medium text-wood">✨ 更多玩法</p>
            <h2 className="text-2xl font-bold text-ink sm:text-3xl">準備下一趟冒險</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="trail-card group flex flex-col gap-2 p-6 transition-transform hover:-translate-y-1"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-moss text-2xl">{f.emoji}</span>
                <span className="text-lg font-bold text-ink">{f.title}</span>
                <span className="text-sm text-muted">{f.desc}</span>
                <span className="mt-auto pt-2 text-sm font-semibold text-forest group-hover:underline">前往 →</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
