// BYOK（自備金鑰）：使用者把自己的 OpenAI API 金鑰存在瀏覽器，呼叫我們的 API 時放在 x-openai-key 標頭
// 伺服器只負責轉送給 OpenAI，不會儲存、快取或記錄金鑰，費用也是算在使用者自己的 OpenAI 帳戶

const API = "https://api.openai.com/v1";
export const KEY_HEADER = "x-openai-key";
export const NO_STORE = { "Cache-Control": "no-store" };

export class AiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function keyFrom(request: Request) {
  const key = request.headers.get(KEY_HEADER)?.trim();
  if (!key) throw new AiError(401, "請先到「設定」輸入你的 OpenAI API 金鑰");
  if (!/^sk-[\w-]{20,300}$/.test(key)) throw new AiError(400, "金鑰格式不對，OpenAI 的金鑰是 sk- 開頭的一長串文字");
  return key;
}

// 模型名稱只允許英數字和 .-_，避免被塞進奇怪的內容
export function modelFrom(value: unknown, fallback: string) {
  return typeof value === "string" && /^[\w.-]{1,80}$/.test(value) ? value : fallback;
}

export async function openai<T>(key: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
  } catch {
    throw new AiError(502, "連不上 OpenAI，請稍後再試");
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).error?.message ?? "";
    } catch {
      // 沒有錯誤說明就算了
    }
    throw new AiError(res.status === 401 ? 401 : res.status >= 500 ? 502 : res.status, explain(res.status, detail));
  }
  return res.json() as Promise<T>;
}

function explain(status: number, detail: string) {
  if (status === 401) return "OpenAI 說這把金鑰無效或已經被撤銷，請到「設定」重新輸入";
  if (status === 429)
    return /quota|billing|credit/i.test(detail)
      ? "你的 OpenAI 帳戶額度用完了，請到 OpenAI 後台儲值後再試"
      : "請求太頻繁了，請稍等一分鐘再試";
  if (status === 403) return "這把金鑰沒有使用這個模型的權限（圖片模型可能要先在 OpenAI 完成組織驗證）";
  if (status === 404) return "找不到這個模型，請到「設定」重新偵測可用的模型";
  if (status === 400) return `OpenAI 拒絕了這次請求：${detail.slice(0, 200) || "內容不符合規定"}`;
  return `OpenAI 暫時無法回應（${status}），請稍後再試`;
}

export function errorResponse(error: unknown) {
  if (error instanceof AiError) return Response.json({ error: error.message }, { status: error.status, headers: NO_STORE });
  return Response.json({ error: "伺服器發生錯誤，請稍後再試" }, { status: 500, headers: NO_STORE });
}

// Responses API 回傳的文字在 output[].content[] 裡 type 為 output_text 的項目
type ResponsesResult = { output?: { type: string; content?: { type: string; text?: string; refusal?: string }[] }[] };

export function outputText(result: ResponsesResult) {
  for (const item of result.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) return part.text;
      if (part.type === "refusal") throw new AiError(400, "AI 婉拒了這次請求，換張照片或改一下內容再試試");
    }
  }
  throw new AiError(502, "AI 沒有回傳內容，請再試一次");
}
