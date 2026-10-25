import type { Metadata } from "next";
import TripForm from "./trip-form";

export const metadata: Metadata = {
  title: "新增遊記｜我的旅遊遊記",
};

export default function NewTripPage() {
  return (
    <div className="flex flex-1 flex-col bg-sand text-ink">
      <header className="bg-linear-to-b from-moss to-sand">
        <div className="mx-auto max-w-3xl px-4 pb-6 pt-12 sm:px-6">
          <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-card px-3 py-1 text-sm font-medium text-forest shadow-sm">
            📝 New Journey
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">新增遊記</h1>
          <p className="mt-3 text-lg text-muted">放上照片、記下地點和日期，這段旅程就會出現在首頁的地圖與回憶輪播裡。</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 pb-24 sm:px-6">
        <TripForm />
      </main>
    </div>
  );
}
