"use client";

import { useState } from "react";
import type { Place } from "../api/geocode/route";
import { inputClass, secondaryButton } from "./trail-ui";

// 輸入地名搜尋地點，從結果中挑一個
export default function PlaceSearch({
  initial = "",
  onPick,
  autoFocus = false,
}: {
  initial?: string;
  onPick: (place: Place) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState(initial);
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
      const data: { places?: Place[] } = await res.json();
      setResults(data.places ?? []);
    } catch {
      setResults([]);
    }
    setSearching(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
          placeholder="輸入地名，例如：合歡山、京都"
          className={inputClass}
        />
        <button type="button" onClick={search} disabled={searching || !query.trim()} className={`${secondaryButton} shrink-0`}>
          {searching ? "搜尋中⋯" : "🔍 搜尋"}
        </button>
      </div>
      {results &&
        (results.length === 0 ? (
          <p className="text-sm text-muted">找不到這個地點，換個寫法試試（例如加上縣市或國家）。</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {results.map((r) => (
              <li key={`${r.lat},${r.lon}`}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(r);
                    setResults(null);
                  }}
                  className="w-full rounded-xl border border-line bg-card px-3 py-2 text-left text-sm text-ink hover:border-forest"
                >
                  <b>{r.name}</b>
                  <span className="block text-xs text-muted">{r.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
