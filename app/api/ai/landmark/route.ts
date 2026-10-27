import { AiError, errorResponse, keyFrom, modelFrom, NO_STORE, openai } from "../openai";

// 3D 地標打卡短片用：把一張旅程照片裡的地標，請 OpenAI 的圖片模型做成「3D 迷你模型」
// 影片裡模型從地圖上長出來、鏡頭鑽進去變回真實照片，這些動畫都由瀏覽器合成

// 圖片生成通常要 30～90 秒
export const maxDuration = 180;

const MAX_BYTES = 1_500_000;

const str = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function prompt(place: string, transparent: boolean) {
  return [
    `Turn the main landmark in this travel photo (taken at ${place || "a travel destination"}) into a highly detailed 3D miniature model,`,
    "like a collectible tilt-shift diorama figurine with realistic materials, soft studio lighting and accurate architecture and colors.",
    "If there is no building, use the most iconic element of the scenery instead (a mountain, a waterfall, a tree, a boat, an animal).",
    "Viewed from a three-quarter high angle, the whole model fully visible and centered, sitting on a small piece of ground.",
    "Leave out people. No text, no labels, no watermark.",
    transparent ? "Transparent background." : "Isolated on a plain pure white background with no shadow on the background.",
  ].join(" ");
}

export async function POST(request: Request) {
  try {
    const key = keyFrom(request);
    const form = await request.formData().catch(() => null);
    const photo = form?.get("photo");
    if (!form || !(photo instanceof File)) throw new AiError(400, "缺少照片");
    if (photo.size > MAX_BYTES || !/^image\/(jpeg|png|webp)$/.test(photo.type)) throw new AiError(400, "照片太大或格式不支援");
    const model = modelFrom(form.get("model"), "gpt-image-2.5-flare");
    const place = str(form.get("place"), 80);

    const call = (transparent: boolean) => {
      const body = new FormData();
      body.set("model", model);
      body.set("prompt", prompt(place, transparent));
      body.set("size", "1024x1024");
      body.set("quality", "medium");
      body.set("output_format", "png");
      if (transparent) body.set("background", "transparent");
      body.append("image[]", photo, `photo.${photo.type.split("/")[1]}`);
      return openai<{ data?: { b64_json?: string }[] }>(key, "/images/edits", { method: "POST", body });
    };

    // 先要透明背景；有些模型不支援透明背景，就改成白底，瀏覽器再自己去背
    let result;
    let transparent = true;
    try {
      result = await call(true);
    } catch (error) {
      if (!(error instanceof AiError) || error.status !== 400 || !/background|transparen/i.test(error.message)) throw error;
      transparent = false;
      result = await call(false);
    }
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new AiError(502, "AI 沒有做出模型，請再試一次");
    return new Response(Buffer.from(b64, "base64"), {
      headers: { ...NO_STORE, "Content-Type": "image/png", "X-Transparent": transparent ? "1" : "0" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
