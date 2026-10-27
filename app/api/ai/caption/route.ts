import { AiError, errorResponse, keyFrom, modelFrom, NO_STORE, openai, outputText } from "../openai";

// AI 幫這趟旅程寫標題和 IG 貼文文案（可以附上幾張小照片，讓文案更貼近當下的風景）

const TONES: Record<string, string> = {
  warm: "溫暖、真誠，像寫給朋友的旅行日記",
  funny: "輕鬆幽默，帶一點自嘲和可愛的梗",
  poetic: "文青、有畫面感，句子簡短有留白",
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export async function POST(request: Request) {
  try {
    const key = keyFrom(request);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") throw new AiError(400, "資料格式不對");

    const stops = (Array.isArray(body.stops) ? body.stops : []).slice(0, 20).map((s: unknown) => str(s, 40));
    const creatures = (Array.isArray(body.creatures) ? body.creatures : []).slice(0, 12).map((s: unknown) => str(s, 20));
    const photos = (Array.isArray(body.photos) ? body.photos : [])
      .filter((p: unknown) => typeof p === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(p) && p.length < 600_000)
      .slice(0, 3) as string[];
    const tone = TONES[str(body.tone, 10)] ?? TONES.warm;

    const facts = [
      `旅程：${str(body.place, 60)}`,
      `日期：${str(body.dates, 40)}`,
      stops.length > 0 && `依序走過：${stops.join(" → ")}`,
      creatures.length > 0 && `這趟遇到並「收服」的動植物夥伴（玩家把拍到的動植物收集成寶可夢般的夥伴）：${creatures.join("、")}`,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await openai<Parameters<typeof outputText>[0]>(key, "/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelFrom(body.model, "gpt-6-luna"),
        input: [
          {
            role: "system",
            content:
              "你是台灣的旅遊社群小編，用繁體中文（台灣用語）幫使用者寫 Instagram 打卡內容。" +
              `語氣：${tone}。只根據提供的資訊和照片寫，不要捏造沒提到的景點、餐廳或事件。` +
              "title 不超過 14 個字；subtitle 不超過 24 個字；caption 80～160 字，可以分 2～4 段、適度使用 emoji；" +
              "hashtags 5～8 個，不含 # 符號，中英文混合，第一個固定是「我的旅遊遊記」。",
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: facts },
              ...photos.map((url) => ({ type: "input_image", image_url: url, detail: "low" })),
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "travel_post",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                subtitle: { type: "string" },
                caption: { type: "string" },
                hashtags: { type: "array", items: { type: "string" } },
              },
              required: ["title", "subtitle", "caption", "hashtags"],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    const post = JSON.parse(outputText(result));
    return Response.json(
      {
        title: str(post.title, 30),
        subtitle: str(post.subtitle, 50),
        caption: str(post.caption, 600),
        hashtags: (Array.isArray(post.hashtags) ? post.hashtags : [])
          .slice(0, 10)
          .map((h: unknown) => str(h, 30).replace(/^#/, "").replace(/\s+/g, "")),
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
