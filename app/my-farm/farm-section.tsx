"use client";

import { StepLabel, Tag } from "../components/trail-ui";
import Catcher from "./catcher";
import { removeCreature, useCollection } from "./collection";
import FarmScene from "./farm-scene";
import { categories } from "./species";

export default function FarmSection() {
  const creatures = useCollection();
  const counts = categories.map((c) => ({ ...c, count: creatures.filter((x) => x.category === c.id).length }));

  return (
    <div className="flex flex-col gap-6">
      <section id="farm" className="trail-card scroll-mt-6 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-wood">🌻 我的農場</p>
            <h2 className="text-2xl font-bold text-ink">夥伴們的快樂生活</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {counts.map((c) => (
              <Tag key={c.id} tone={c.count > 0 ? "good" : "neutral"}>
                {c.emoji} {c.count}
              </Tag>
            ))}
          </div>
        </div>
        <FarmScene creatures={creatures} />
        {creatures.length === 0 && (
          <p className="mt-3 text-center text-sm text-muted">農場還空空的，在下面上傳照片收服你的第一位夥伴吧！</p>
        )}
      </section>

      <Catcher />

      <section className="trail-card p-5 sm:p-7">
        <StepLabel step={3}>我的圖鑑（{creatures.length}）</StepLabel>
        {creatures.length === 0 ? (
          <p className="rounded-2xl bg-sand p-4 text-muted">還沒有收服任何動植物。</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[...creatures].reverse().map((c) => (
              <li key={c.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-sand">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 縮圖是 data URL */}
                  <img src={c.photo} alt={c.name} className="aspect-square w-full object-cover" />
                  {c.emoji && (
                    <span className="absolute bottom-1.5 right-1.5 rounded-full bg-card/90 px-1.5 text-xl">{c.emoji}</span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <p className="font-semibold text-ink">{c.name}</p>
                  <p className="text-xs text-muted">{categories.find((x) => x.id === c.category)?.label}</p>
                  {c.aiGuess && c.aiGuess !== c.name && (
                    <p className="text-xs text-muted">AI 原本猜：{c.aiGuess}</p>
                  )}
                  <p className="text-xs text-muted">{new Date(c.caughtAt).toLocaleDateString("zh-TW")} 收服</p>
                  <button
                    type="button"
                    onClick={() => confirm(`確定要讓「${c.name}」離開農場嗎？`) && removeCreature(c.id)}
                    className="mt-auto self-start pt-1 text-xs text-wood hover:underline"
                  >
                    放生
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">
          ※ 圖鑑存在這台裝置的瀏覽器裡，清除瀏覽器資料或換裝置就看不到了。照片只在你的瀏覽器裡辨識，不會上傳到任何伺服器。
        </p>
      </section>
    </div>
  );
}
