import type { MobileNet } from "@tensorflow-models/mobilenet";
import { speciesOf, type Species } from "./species";

// 模型很大（約 16MB），第一次要辨識時才下載，之後重複使用
let modelPromise: Promise<MobileNet> | null = null;

function loadModel() {
  modelPromise ??= (async () => {
    const tf = await import("@tensorflow/tfjs");
    const mobilenet = await import("@tensorflow-models/mobilenet");
    await tf.ready();
    return mobilenet.load({ version: 1, alpha: 1.0 });
  })();
  // 下載失敗時允許重試
  modelPromise.catch(() => (modelPromise = null));
  return modelPromise;
}

export type Guess = Species & { probability: number };

// 回傳機率最高、而且是動植物的前三名
export async function identify(image: HTMLImageElement): Promise<Guess[]> {
  const [model, tf, { IMAGENET_CLASSES }] = await Promise.all([
    loadModel(),
    import("@tensorflow/tfjs"),
    import("@tensorflow-models/mobilenet/dist/imagenet_classes"),
  ]);

  const probabilities = tf.tidy(() => tf.softmax(model.infer(image) as import("@tensorflow/tfjs").Tensor2D));
  const values = await probabilities.data();
  probabilities.dispose();

  const guesses: Guess[] = [];
  const seen = new Set<string>();
  [...values.keys()]
    .sort((a, b) => values[b] - values[a])
    .slice(0, 30)
    .forEach((index) => {
      const species = speciesOf(index, IMAGENET_CLASSES[index]);
      if (!species || seen.has(species.name) || guesses.length >= 3) return;
      seen.add(species.name);
      guesses.push({ ...species, probability: values[index] });
    });

  return guesses.filter((g) => g.probability >= 0.03);
}

// 把照片縮成小縮圖，存起來比較省空間
export function makeThumbnail(image: HTMLImageElement, size = 160): string {
  const canvas = document.createElement("canvas");
  const scale = size / Math.min(image.naturalWidth, image.naturalHeight);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  ctx.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
  return canvas.toDataURL("image/jpeg", 0.8);
}
