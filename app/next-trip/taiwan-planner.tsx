"use client";

import { useRef, useState } from "react";
import type { CultureEvent } from "../api/events/route";
import { formatMinutes, recommend, type Preferences, type Recommendation } from "./recommend";
import { origins, stays, transports, travelTimes, tripTypes, type Transport, type TripType } from "./taiwan-data";
import { chip, inputClass, primaryButton, StepLabel, Tag } from "../components/trail-ui";

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TaiwanPlanner() {
  const [types, setTypes] = useState<TripType[]>([]);
  const [origin, setOrigin] = useState("台北市");
  const [transport, setTransport] = useState<Transport>("car");
  const [maxMinutes, setMaxMinutes] = useState(120);
  const [stayHours, setStayHours] = useState(10);
  // 這個元件只在點了「台灣版」之後才會在瀏覽器端出現，所以可以直接用使用者當地的今天
  const [minDate] = useState(today);
  const [date, setDate] = useState(minDate);
  const [allowIslands, setAllowIslands] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Map<TripType, Recommendation[]> | null>(null);
  const [usedLive, setUsedLive] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  function toggleType(id: TripType) {
    setTypes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (types.length === 0) {
      setError("請至少選一種旅遊性質");
      return;
    }
    setError("");
    setLoading(true);

    const prefs: Preferences = { types, origin, transport, maxMinutes, stayHours, date, allowIslands };
    const categories = tripTypes.filter((t) => types.includes(t.id)).flatMap((t) => t.live ?? []);

    let events: CultureEvent[] = [];
    if (categories.length > 0) {
      try {
        const res = await fetch(`/api/events?categories=${categories.join(",")}`);
        if (!res.ok) throw new Error();
        events = (await res.json()).events;
      } catch {
        setError("目前抓不到文化部的最新活動資料，展覽／表演類的推薦可能不完整，請稍後再試。");
      }
    }

    setUsedLive(categories.length > 0);
    setResults(recommend(prefs, events));
    setLoading(false);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="trail-card flex flex-col gap-8 p-5 sm:p-7">
        <fieldset>
          <legend className="contents">
            <StepLabel step={1}>想要什麼樣的旅遊？（可複選）</StepLabel>
          </legend>
          <div className="flex flex-wrap gap-2">
            {tripTypes.map((t) => (
              <button key={t.id} type="button" onClick={() => toggleType(t.id)} className={chip(types.includes(t.id))}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <StepLabel step={2}>從哪裡、什麼時候出發？</StepLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm text-muted">
              出發地
              <select value={origin} onChange={(e) => setOrigin(e.target.value)} className={inputClass}>
                {origins.map((o) => (
                  <option key={o.name}>{o.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-muted">
              預計出發日期
              <input
                type="date"
                required
                min={minDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
        </div>

        <fieldset>
          <legend className="contents">
            <StepLabel step={3}>怎麼去？願意花多少時間在路上？</StepLabel>
          </legend>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {transports.map((t) => (
                <button key={t.id} type="button" onClick={() => setTransport(t.id)} className={chip(transport === t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={allowIslands}
                onChange={(e) => setAllowIslands(e.target.checked)}
                className="h-4 w-4 accent-forest"
              />
              可以搭飛機或船去離島（澎湖、金門、馬祖、小琉球、綠島、蘭嶼）
            </label>
            <div>
              <p className="mb-2 text-sm text-muted">單程交通時間</p>
              <div className="flex flex-wrap gap-2">
                {travelTimes.map((t) => (
                  <button key={t.label} type="button" onClick={() => setMaxMinutes(t.minutes)} className={chip(maxMinutes === t.minutes)}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="contents">
            <StepLabel step={4}>想停留多久？</StepLabel>
          </legend>
          <div className="flex flex-wrap gap-2">
            {stays.map((s) => (
              <button key={s.label} type="button" onClick={() => setStayHours(s.hours)} className={chip(stayHours === s.hours)}>
                {s.label}
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="text-sm font-medium text-wood">{error}</p>}

        <button type="submit" disabled={loading} className={primaryButton}>
          {loading ? "正在找最新資料⋯⋯" : "🧭 幫我推薦"}
        </button>
      </form>

      {results && (
        <div ref={resultsRef} className="flex scroll-mt-6 flex-col gap-6">
          {[...results].map(([type, list]) => {
            const info = tripTypes.find((t) => t.id === type)!;
            const matched = list.filter((r) => r.misses.length === 0).length;
            return (
              <section key={type} className="trail-card p-5 sm:p-7">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-2xl font-bold text-ink">
                    {info.emoji} {info.label}
                  </h2>
                  <p className="text-sm text-muted">
                    完全符合 {matched} 個{list.length > matched && `，另外補上 ${list.length - matched} 個差一點符合的`}
                  </p>
                </div>
                {list.length === 0 ? (
                  <p className="rounded-2xl bg-sand p-4 text-muted">目前沒有可以推薦的地方，換個日期或旅遊性質試試。</p>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((r) => (
                      <RecommendationCard key={r.key} rec={r} transport={transport} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}

          <p className="px-2 text-sm text-muted">
            ※ 交通時間是依直線距離粗估，實際請以導航或時刻表為準。
            {usedLive && " 展覽、表演、親子活動來自文化部文化資料開放服務網，每小時更新一次，只列出你出遊期間有場次的活動。"}
          </p>
        </div>
      )}
    </div>
  );
}

function RecommendationCard({ rec, transport }: { rec: Recommendation; transport: Transport }) {
  const mode = transports.find((t) => t.id === transport)!.label;
  const nearMiss = rec.misses.length > 0;
  return (
    <li
      className={`flex flex-col gap-2 rounded-2xl border p-4 ${
        nearMiss ? "border-dashed border-line bg-card" : "border-line bg-sand"
      }`}
    >
      {nearMiss && <p className="text-xs font-semibold text-wood">差一點符合</p>}
      <h3 className="font-semibold leading-snug text-ink">{rec.title}</h3>
      <p className="text-sm text-muted">📍 {rec.place}</p>
      {rec.desc && <p className="text-sm text-ink/90">{rec.desc}</p>}
      <div className="flex flex-wrap gap-1.5">
        <Tag tone="info">
          {mode}
          {rec.via && `＋${rec.via}`} 約 {formatMinutes(rec.minutes)}
        </Tag>
        {rec.misses.map((m) => (
          <Tag key={m} tone="warn">
            {m}
          </Tag>
        ))}
        {rec.badges.map((b) => (
          <Tag
            key={b}
            tone={b === "即將結束" || b.startsWith("最佳季節") ? "warn" : b === "正值最佳季節" ? "good" : "neutral"}
          >
            {b}
          </Tag>
        ))}
      </div>
      <a
        href={rec.link}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto pt-1 text-sm font-medium text-forest hover:underline"
      >
        {rec.linkLabel} ↗
      </a>
    </li>
  );
}
