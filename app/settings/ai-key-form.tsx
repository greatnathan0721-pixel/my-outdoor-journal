"use client";

import { useState } from "react";
import { inputClass, primaryButton, secondaryButton, StepLabel, Tag } from "../components/trail-ui";
import { aiFetch, maskKey, saveAiSettings, useAiSettings, type AiSettings } from "../lib/ai-settings";

type CheckResult = Pick<AiSettings, "imageModels" | "textModels"> & { imageModel: string | null; textModel: string | null };

export default function AiKeyForm() {
  const settings = useAiSettings();
  const [draft, setDraft] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "good" | "warn"; text: string } | null>(null);

  async function check(key: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await aiFetch("/api/ai/check", key, { method: "POST" });
      const r: CheckResult = await res.json();
      saveAiSettings({
        key,
        imageModel: r.imageModel ?? "",
        textModel: r.textModel ?? "",
        imageModels: r.imageModels,
        textModels: r.textModels,
        checkedAt: new Date().toISOString(),
      });
      setDraft("");
      setMessage(
        r.imageModel
          ? { tone: "good", text: "金鑰可以使用，已經存在這個瀏覽器裡！" }
          : { tone: "warn", text: "金鑰可以使用，但這個帳戶目前沒有圖片模型，3D 地標短片會用免費版（AI 文案可以用）。" },
      );
    } catch (error) {
      setMessage({ tone: "warn", text: error instanceof Error ? error.message : "驗證失敗" });
    }
    setBusy(false);
  }

  function update(patch: Partial<AiSettings>) {
    if (settings) saveAiSettings({ ...settings, ...patch });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="trail-card p-5 sm:p-7">
        <StepLabel step={1}>OpenAI API 金鑰</StepLabel>

        {settings ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-moss/60 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone="good">✓ 已設定</Tag>
              <code className="rounded bg-card px-2 py-0.5 text-sm text-ink">{maskKey(settings.key)}</code>
              <span className="text-xs text-muted">驗證於 {new Date(settings.checkedAt).toLocaleString("zh-TW")}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => check(settings.key)} disabled={busy} className={secondaryButton}>
                {busy ? "檢查中⋯" : "重新偵測模型"}
              </button>
              <button
                type="button"
                onClick={() => confirm("確定要從這個瀏覽器移除金鑰嗎？") && saveAiSettings(null)}
                className={`${secondaryButton} text-wood`}
              >
                移除金鑰
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) check(draft.trim());
            }}
            className="flex flex-col gap-3"
          >
            <label className="text-sm text-muted" htmlFor="openai-key">
              貼上你的金鑰（sk- 開頭）。還沒有的話，到{" "}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="font-medium text-forest underline">
                OpenAI 後台
              </a>{" "}
              建立一把。
            </label>
            <div className="flex gap-2">
              <input
                id="openai-key"
                type={show ? "text" : "password"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="sk-proj-⋯"
                autoComplete="off"
                spellCheck={false}
                className={`${inputClass} font-mono`}
              />
              <button type="button" onClick={() => setShow((v) => !v)} className="shrink-0 rounded-xl border border-line bg-sand px-3 text-sm">
                {show ? "隱藏" : "顯示"}
              </button>
            </div>
            <button type="submit" disabled={busy || !draft.trim()} className={`${primaryButton} self-start`}>
              {busy ? "驗證中⋯" : "驗證並儲存"}
            </button>
          </form>
        )}

        {message && (
          <p className={`mt-3 rounded-xl p-3 text-sm ${message.tone === "good" ? "bg-moss text-forest" : "bg-wood-soft text-wood-deep"}`}>
            {message.text}
          </p>
        )}
      </section>

      {settings && (
        <section className="trail-card p-5 sm:p-7">
          <StepLabel step={2}>使用的模型</StepLabel>
          <p className="mb-4 text-sm text-muted">已經依你的帳戶自動選好，通常不用改。</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ModelSelect
              label="📌 做 3D 地標模型（圖片模型）"
              value={settings.imageModel}
              options={settings.imageModels}
              onChange={(imageModel) => update({ imageModel })}
            />
            <ModelSelect
              label="✍️ 寫文案（文字模型）"
              value={settings.textModel}
              options={settings.textModels}
              onChange={(textModel) => update({ textModel })}
            />
          </div>
        </section>
      )}

      <section className="trail-card p-5 text-sm leading-relaxed text-muted sm:p-7">
        <h2 className="mb-2 text-base font-semibold text-ink">🔒 金鑰怎麼被使用？</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>金鑰只存在<strong className="text-ink">這台裝置的這個瀏覽器</strong>裡，不會出現在備份檔，換裝置要重新輸入。</li>
          <li>使用 AI 功能時，金鑰會隨請求送到我們的伺服器，再直接轉給 OpenAI；伺服器不會儲存或記錄它。</li>
          <li>
            費用由你的 OpenAI 帳戶支付：做 3D 模型是每一站畫一張圖，比寫一次文案貴得多，實際價格請看{" "}
            <a href="https://openai.com/api/pricing/" target="_blank" rel="noreferrer" className="text-forest underline">
              OpenAI 價目表
            </a>
            。
          </li>
          <li>建議在 OpenAI 後台幫這把金鑰設定每月用量上限；共用電腦用完記得按「移除金鑰」。</li>
          <li>路線短片、打卡長圖和 3D 地標短片的免費版（有浮水印）都在你的瀏覽器裡合成，不用金鑰也能用。</li>
        </ul>
      </section>
    </div>
  );
}

function ModelSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
      {label}
      {options.length > 0 ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          {options.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      ) : (
        <span className="rounded-xl bg-sand px-3 py-2.5 font-normal text-muted">這個帳戶沒有可用的模型</span>
      )}
    </label>
  );
}
