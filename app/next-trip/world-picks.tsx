"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { WikiSpot } from "../api/world-spots/route";
import { Tag } from "../components/trail-ui";
import { guides, purposes, type Purpose } from "./world-data";

const purposeLabel = (id: string) => {
  const p = purposes.find((p) => p.id === id);
  return p ? `${p.emoji} ${p.label}` : null;
};

type Props = { code?: string; countryName: string; selected: Purpose[] };

export default function WorldPicks({ code, countryName, selected }: Props) {
  const guide = code ? guides[code] : undefined;

  return (
    <section className="trail-card p-5 sm:p-7">
      <p className="text-sm font-medium text-wood">🎯 你的下一站</p>
      <h2 className="mt-1 text-3xl font-bold text-ink">{countryName}</h2>
      {guide && <p className="mt-2 text-muted">🗓️ {guide.season}</p>}

      <div className="mt-6">
        {guide ? (
          <CuratedList code={code!} countryName={countryName} selected={selected} />
        ) : code ? (
          <WikidataList code={code} countryName={countryName} selected={selected} />
        ) : (
          <Fallback countryName={countryName} />
        )}
      </div>
    </section>
  );
}

function CuratedList({ code, countryName, selected }: { code: string; countryName: string; selected: Purpose[] }) {
  const items = guides[code].items
    .map(([name, region, tags, desc]) => ({
      name,
      region,
      desc,
      tags: tags.split("") as Purpose[],
      matches: tags.split("").filter((t) => selected.includes(t as Purpose)).length,
    }))
    .sort((a, b) => b.matches - a.matches);
  const matched = items.filter((i) => i.matches > 0);
  const others = items.filter((i) => i.matches === 0);

  const card = (i: (typeof items)[number]) => (
    <li key={i.name} className="flex flex-col gap-2 rounded-2xl border border-line bg-sand p-4">
      <div>
        <h4 className="font-semibold text-ink">{i.name}</h4>
        <p className="text-sm text-muted">📍 {i.region}</p>
      </div>
      <p className="text-sm text-ink/90">{i.desc}</p>
      <div className="flex flex-wrap gap-1.5">
        {i.tags.map((t) => (
          <Tag key={t} tone={selected.includes(t) ? "good" : "neutral"}>
            {purposeLabel(t)}
          </Tag>
        ))}
      </div>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${i.name} ${countryName}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-auto pt-1 text-sm font-medium text-forest hover:underline"
      >
        在 Google 地圖查看 ↗
      </a>
    </li>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="mb-3 font-semibold text-ink">符合你旅行目的的行程</h3>
        {matched.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{matched.map(card)}</ul>
        ) : (
          <p className="rounded-2xl bg-sand p-4 text-muted">這個國家沒有特別符合你目的的行程，看看下面其他推薦吧！</p>
        )}
      </div>
      {others.length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold text-ink">其他也很值得去</h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{others.map(card)}</ul>
        </div>
      )}
    </div>
  );
}

type Loaded = { key: string; spots: WikiSpot[] | null; error?: boolean };

function WikidataList({ code, countryName, selected }: { code: string; countryName: string; selected: Purpose[] }) {
  const key = `${code}|${[...selected].sort().join(",")}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    const [country, list] = key.split("|");
    fetch(`/api/world-spots?country=${country}&purposes=${list}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { spots: WikiSpot[] }) => !cancelled && setLoaded({ key, spots: data.spots }))
      .catch(() => !cancelled && setLoaded({ key, spots: null, error: true }));
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!loaded || loaded.key !== key) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted">🔎 這個國家不在精選清單裡，正在從 Wikidata 查詢景點⋯⋯（大約需要幾秒）</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-56 animate-pulse rounded-2xl bg-sand" />
          ))}
        </ul>
      </div>
    );
  }

  if (loaded.error || !loaded.spots || loaded.spots.length === 0) {
    return <Fallback countryName={countryName} failed={loaded.error} />;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">這個國家不在精選清單裡，以下是 Wikidata 上的知名景點（部分名稱可能是簡體或英文）。</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {loaded.spots.map((s) => (
          <li key={s.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-sand">
            <div className="relative aspect-[4/3] bg-moss">
              {s.image ? (
                <Image src={s.image} alt={s.name} fill unoptimized className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl">🏞️</div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <h4 className="font-semibold text-ink">{s.name}</h4>
              {s.desc && <p className="text-sm text-muted">{s.desc}</p>}
              <div className="flex flex-wrap gap-1.5">
                {s.purpose ? <Tag tone="good">{purposeLabel(s.purpose)}</Tag> : <Tag>知名景點</Tag>}
              </div>
              <a
                href={s.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto pt-1 text-sm font-medium text-forest hover:underline"
              >
                看介紹 ↗
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Fallback({ countryName, failed }: { countryName: string; failed?: boolean }) {
  return (
    <p className="rounded-2xl bg-sand p-4 text-muted">
      {failed ? "Wikidata 暫時查不到資料，請稍後再試。" : "目前找不到這裡的景點資料。"}
      可以先到{" "}
      <a
        href={`https://zh.wikipedia.org/wiki/${encodeURIComponent(countryName)}?variant=zh-tw`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-forest hover:underline"
      >
        維基百科認識{countryName} ↗
      </a>
    </p>
  );
}
