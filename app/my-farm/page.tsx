import type { Metadata } from "next";
import FarmSection from "./farm-section";

export const metadata: Metadata = {
  title: "我的神奇寶貝世界｜我的旅遊遊記",
};

export default function MyFarmPage() {
  return (
    <div className="flex flex-1 flex-col bg-sand text-ink">
      <header className="bg-linear-to-b from-moss to-sand">
        <div className="mx-auto max-w-5xl px-4 pb-6 pt-12 sm:px-6">
          <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-card px-3 py-1 text-sm font-medium text-forest shadow-sm">
            🐾 Wild Buddies
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">我的神奇寶貝世界</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            把旅途中遇到的動植物拍下來收服，牠們會搬進你的農場一起生活。走進水池，還能潛水跟水裡的夥伴玩！
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pb-20 sm:px-6">
        <FarmSection />
      </main>
    </div>
  );
}
