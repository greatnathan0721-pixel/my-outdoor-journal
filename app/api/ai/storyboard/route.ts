import { AiError, errorResponse, keyFrom, modelFrom, NO_STORE, openai, outputText } from "../openai";

// AI 幫 3D 地標打卡短片排分鏡：看每一站的照片，決定從地圖長出什麼（地標模型／人或主角／直接進照片）、
// 主角在照片的哪裡；再看最後一張照片，用積木組出結尾特效（主角 × 動作 × 粒子 × 跟標題的互動）

const POPS = ["landmark", "subject", "photo"];
const ACTIONS = ["dash", "jump", "spin", "zoom", "freeze"];
const IMPACTS = ["smash", "splash", "push", "stamp"];

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const unit = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.min(0.98, Math.max(0.02, v)) : 0.5);
const point = { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"], additionalProperties: false };

export async function POST(request: Request) {
  try {
    const key = keyFrom(request);
    const body = await request.json().catch(() => null);
    const photos = (Array.isArray(body?.photos) ? body.photos : [])
      .filter((p: unknown) => typeof p === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(p) && p.length < 400_000)
      .slice(0, 6) as string[];
    if (photos.length === 0) throw new AiError(400, "至少要有一張照片");
    const labels = (Array.isArray(body?.labels) ? body.labels : []).map((l: unknown) => str(l, 40));

    const result = await openai<Parameters<typeof outputText>[0]>(key, "/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelFrom(body?.model, "gpt-6-luna"),
        input: [
          {
            role: "system",
            content: [
              "你是短影音剪輯師，幫使用者把旅遊照片排成 IG Reels 的分鏡。照片依序是第 1 站到最後一站。",
              "每一站：圖釘插進地圖後，會有東西從地圖上長出來，再鑽進照片。請替每張照片選 pop：",
              "landmark＝照片主角是建築、地標、山、海岸等風景（AI 會做成 3D 迷你模型）；",
              "subject＝照片主角是人、動物、物品（會把它去背後讓它從地圖跳出來）；",
              "photo＝美食、室內、看不出主體的照片（直接進照片）。",
              "x、y 是主角在照片中的位置（0～1，左上角是 0,0），要點在主角身上，subject 用繁體中文描述主角（例如「投球的人」）。",
              "name：幫這一站取一個 4～10 字的繁體中文站名，要看得出這一站在做什麼或看到什麼（例如「月光沙灘音樂祭」「夕陽竹編藝術」），可以參考提供的地名，但不要每站都一樣。",
              "finale 是最後一張照片的結尾特效：把照片裡最有動感的東西切出來當主角（球、滑雪的人、跳水的人、飛盤、狗⋯），",
              "action：dash 衝出去、jump 跳起來、spin 旋轉飛走、zoom 衝向鏡頭、freeze 定格拍立得；",
              "重要：只有當主角「完整入鏡」（頭到腳或整個物體都在照片裡、沒有被照片邊緣切到、沒有被前景的人或東西擋住）而且只有一個主角時，才用 dash/jump/spin/zoom；",
              "主角是一群人、被擋住、只拍到半身、或照片是風景時，一律用 freeze。",
              "particle：一個最符合情境的 emoji（滑雪 ❄️、海邊 💧、櫻花 🌸、秋天 🍂、慶祝 🎉）；",
              "impact：主角最後怎麼跟片尾標題互動：smash 撞碎、splash 噴滿畫面、push 把標題推進來、stamp 蓋章（freeze 時用 stamp）。",
            ].join(""),
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: labels.map((l: string, i: number) => `第 ${i + 1} 站：${l || "未命名"}`).join("\n") },
              ...photos.map((url) => ({ type: "input_image", image_url: url, detail: "low" })),
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "storyboard",
            strict: true,
            schema: {
              type: "object",
              properties: {
                scenes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { pop: { type: "string", enum: POPS }, point, subject: { type: "string" }, name: { type: "string" } },
                    required: ["pop", "point", "subject", "name"],
                    additionalProperties: false,
                  },
                },
                finale: {
                  type: "object",
                  properties: {
                    point,
                    subject: { type: "string" },
                    action: { type: "string", enum: ACTIONS },
                    particle: { type: "string" },
                    impact: { type: "string", enum: IMPACTS },
                  },
                  required: ["point", "subject", "action", "particle", "impact"],
                  additionalProperties: false,
                },
              },
              required: ["scenes", "finale"],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    const board = JSON.parse(outputText(result));
    const scenes = photos.map((_, i) => {
      const s = board.scenes?.[i] ?? {};
      return {
        pop: POPS.includes(s.pop) ? s.pop : "subject",
        point: { x: unit(s.point?.x), y: unit(s.point?.y) },
        subject: str(s.subject, 20),
        name: str(s.name, 12).trim(),
      };
    });
    const f = board.finale ?? {};
    const particle = str(f.particle, 8).trim();
    return Response.json(
      {
        scenes,
        finale: {
          point: { x: unit(f.point?.x), y: unit(f.point?.y) },
          subject: str(f.subject, 20) || null,
          action: ACTIONS.includes(f.action) ? f.action : "freeze",
          // 只接受一個 emoji
          particle: /^\p{Extended_Pictographic}/u.test(particle) ? [...particle].slice(0, 2).join("") : "✨",
          impact: IMPACTS.includes(f.impact) ? f.impact : "stamp",
        },
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
