import type { Metadata } from "next";
import AiKeyForm from "./ai-key-form";

export const metadata: Metadata = {
  title: "設定｜我的旅遊遊記",
};

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <p className="text-sm font-medium text-wood">⚙️ Settings</p>
        <h1 className="text-3xl font-bold text-ink">設定</h1>
        <p className="mt-2 text-muted">AI 功能（3D 地標模型、AI 文案）使用你自己的 OpenAI 帳戶，在這裡設定一次就好。</p>
      </div>
      <AiKeyForm />
    </main>
  );
}
