// 兩個版本共用的戶外風樣式

export const chip = (active: boolean) =>
  `rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
    active
      ? "border-forest bg-forest text-on-accent shadow-sm"
      : "border-line bg-sand text-ink hover:border-forest hover:text-forest"
  }`;

export const primaryButton =
  "h-12 rounded-full bg-forest px-8 font-semibold text-on-accent shadow-sm transition-colors hover:bg-forest-deep disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButton =
  "h-11 rounded-full border border-line bg-sand px-6 font-medium text-ink transition-colors hover:border-forest hover:text-forest";

export const inputClass =
  "w-full rounded-xl border border-line bg-sand px-3 py-2.5 text-ink outline-none focus:border-forest focus:ring-2 focus:ring-forest/20";

// 像步道指標木牌的步驟標籤
export function StepLabel({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="rounded-md bg-wood px-2 py-0.5 text-xs font-bold tracking-wide text-on-accent">
        STEP {step}
      </span>
      <span className="font-semibold text-ink">{children}</span>
    </div>
  );
}

export function Tag({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "info"; children: React.ReactNode }) {
  const tones = {
    neutral: "bg-sand text-muted border-line",
    good: "bg-moss text-forest border-transparent",
    warn: "bg-wood-soft text-wood-deep border-transparent",
    info: "bg-ocean-soft text-ocean-deep border-transparent",
  };
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs ${tones[tone]}`}>{children}</span>;
}
