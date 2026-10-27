import { errorResponse, keyFrom, NO_STORE, openai } from "../openai";

// 驗證使用者的金鑰，順便列出這把金鑰能用的模型，讓設定頁自動挑好預設值
// OpenAI 的模型名稱常常更新，所以不寫死，以帳戶實際能用的為準

// 由新到舊的偏好順序：清單裡有哪個就先用哪個
const IMAGE_PREFERRED = ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst", "gpt-image-2", "gpt-image-1.5", "gpt-image-1", "gpt-image-1-mini"];
const TEXT_PREFERRED = ["gpt-6-luna", "gpt-6.1-terra", "gpt-6.1-sol", "gpt-6-astra", "gpt-5-mini", "gpt-5", "gpt-4.1-mini", "gpt-4o-mini"];

function pick(available: string[], preferred: string[]) {
  return preferred.find((m) => available.includes(m)) ?? available[0] ?? null;
}

export async function POST(request: Request) {
  try {
    const key = keyFrom(request);
    const { data } = await openai<{ data: { id: string }[] }>(key, "/models");
    const ids = data.map((m) => m.id).sort().reverse();
    const imageModels = ids.filter((id) => id.startsWith("gpt-image"));
    // 一般對話模型：排除語音、即時、搜尋、嵌入等特殊用途的
    const textModels = ids.filter(
      (id) => /^(gpt-\d|o\d)/.test(id) && !/image|audio|realtime|tts|transcribe|search|embedding|codex|instruct|\d{4}-\d{2}-\d{2}/.test(id),
    );
    return Response.json(
      {
        imageModels,
        textModels,
        imageModel: pick(imageModels, IMAGE_PREFERRED),
        textModel: pick(textModels, TEXT_PREFERRED),
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
