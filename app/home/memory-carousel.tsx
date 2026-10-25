"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StoredPhoto from "../components/stored-photo";
import type { DiaryState } from "../lib/trips-db";

function ago(date: string) {
  const days = Math.floor((Date.now() - new Date(`${date}T00:00:00`).getTime()) / 86400000);
  if (days < 1) return "今天";
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 個月前`;
  return `${Math.floor(days / 365)} 年前`;
}

export default function MemoryCarousel({ diary }: { diary: DiaryState }) {
  // 所有照片依拍攝（或出發）日期，新的在前
  const slides = useMemo(
    () =>
      diary.trips
        .flatMap((trip) =>
          trip.photoIds
            .map((id) => diary.photos.get(id))
            .filter((p) => p !== undefined)
            .map((photo) => ({ photo, trip, date: photo.takenAt ?? trip.startDate })),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [diary],
  );
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const current = count > 0 ? index % count : 0;

  useEffect(() => {
    if (paused || count < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => clearInterval(id);
  }, [paused, count]);

  if (count === 0) {
    return (
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl">
        <Image src="/images/hero-trail.jpg" alt="多洛米蒂山間的健行步道" fill sizes="(max-width: 1152px) 100vw, 1152px" className="object-cover opacity-80" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/35 p-6 text-center text-white">
          <p className="text-2xl font-bold">你的旅行照片會在這裡輪播</p>
          <p className="text-white/85">在「新增遊記」上傳照片後，每次打開首頁都能回味。</p>
          <Link href="/new-trip" className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-forest">
            上傳旅行照片
          </Link>
        </div>
      </div>
    );
  }

  // 只渲染目前和前後一張，照片多的時候也不會吃太多記憶體
  const visible = new Set([current, (current + 1) % count, (current - 1 + count) % count]);

  return (
    <div
      className="group relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink sm:aspect-[16/9]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((s, i) =>
        visible.has(i) ? (
          <div
            key={s.photo.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${i === current ? "opacity-100" : "opacity-0"}`}
            aria-hidden={i !== current}
          >
            <StoredPhoto
              blob={s.photo.blob}
              alt={s.trip.place}
              className={`h-full w-full object-cover ${i === current ? "animate-[ken-burns_9s_ease-out_both]" : ""}`}
            />
          </div>
        ) : null,
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/75 via-black/30 to-transparent p-5 pt-16 sm:p-7 sm:pt-24">
        <p className="text-sm font-medium text-[#f3c58f]">{ago(slides[current].date)}・{slides[current].date}</p>
        <p className="mt-1 text-2xl font-bold text-white drop-shadow sm:text-3xl">{slides[current].trip.place}</p>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((current - 1 + count) % count)}
            aria-label="上一張"
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink opacity-80 shadow transition-opacity hover:opacity-100"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setIndex((current + 1) % count)}
            aria-label="下一張"
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ink opacity-80 shadow transition-opacity hover:opacity-100"
          >
            ›
          </button>
          <div className="absolute bottom-4 right-5 flex items-center gap-2 text-xs text-white/90 sm:bottom-6 sm:right-7">
            <button type="button" onClick={() => setPaused((p) => !p)} className="rounded-full bg-black/40 px-2 py-1">
              {paused ? "▶ 播放" : "❚❚ 暫停"}
            </button>
            <span className="rounded-full bg-black/40 px-2 py-1">
              {current + 1} / {count}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
