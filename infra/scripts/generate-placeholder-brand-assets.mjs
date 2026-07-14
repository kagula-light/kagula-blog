import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import sharp from "sharp";

const outputDirectory = resolve("apps/web/public/brand");

function randomSource(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function blend(buffer, width, x, y, color, opacity = 1) {
  if (x < 0 || y < 0 || x >= width) return;
  const offset = (y * width + x) * 4;
  if (offset < 0 || offset + 3 >= buffer.length) return;
  const alpha = Math.max(0, Math.min(1, opacity));
  buffer[offset] = Math.round(buffer[offset] * (1 - alpha) + color[0] * alpha);
  buffer[offset + 1] = Math.round(buffer[offset + 1] * (1 - alpha) + color[1] * alpha);
  buffer[offset + 2] = Math.round(buffer[offset + 2] * (1 - alpha) + color[2] * alpha);
  buffer[offset + 3] = 255;
}

async function createScene({ width, height, seed, filename }) {
  const random = randomSource(seed);
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const noise = Math.floor(random() * 4);
      pixels[offset] = 10 + noise;
      pixels[offset + 1] = 10 + noise;
      pixels[offset + 2] = 13 + noise;
      pixels[offset + 3] = 255;
    }
  }

  const lights = [
    [116, 235, 170],
    [141, 132, 245],
    [230, 104, 188],
    [235, 235, 240],
  ];
  const starCount = Math.floor((width * height) / 2_700);
  for (let index = 0; index < starCount; index += 1) {
    const x = Math.floor(random() * width);
    const y = Math.floor(random() * height);
    const radius = random() > 0.94 ? 3 : random() > 0.68 ? 2 : 1;
    const color = lights[Math.floor(random() * lights.length)];
    const strength = 0.38 + random() * 0.55;
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= radius)
          blend(pixels, width, x + dx, y + dy, color, strength / (distance + 1));
      }
    }
  }

  const pageCount = width > height ? 10 : 7;
  const composites = [];
  for (let index = 0; index < pageCount; index += 1) {
    const pageWidth = Math.round(width * (0.055 + random() * 0.045));
    const pageHeight = Math.round(pageWidth * 1.35);
    const pagePixels = Buffer.alloc(pageWidth * pageHeight * 4);
    for (let y = 0; y < pageHeight; y += 1) {
      for (let x = 0; x < pageWidth; x += 1) {
        const offset = (y * pageWidth + x) * 4;
        const border = x < 2 || y < 2 || x >= pageWidth - 2 || y >= pageHeight - 2;
        const line = y > pageHeight * 0.25 && y % Math.max(8, Math.floor(pageHeight / 9)) < 2;
        pagePixels[offset] = border ? 116 : line ? 92 : 34;
        pagePixels[offset + 1] = border ? 235 : line ? 116 : 35;
        pagePixels[offset + 2] = border ? 170 : line ? 138 : 41;
        pagePixels[offset + 3] = border ? 115 : line ? 62 : 92;
      }
    }
    const rotated = await sharp(pagePixels, {
      raw: { width: pageWidth, height: pageHeight, channels: 4 },
    })
      .rotate(-22 + random() * 44, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    composites.push({
      input: rotated,
      left: Math.floor(random() * (width - pageWidth * 2)),
      top: Math.floor(height * 0.08 + random() * height * 0.76),
      blend: "screen",
    });
  }

  await sharp(pixels, { raw: { width, height, channels: 4 } })
    .composite(composites)
    .webp({ quality: 86, effort: 5 })
    .toFile(resolve(outputDirectory, filename));
}

await mkdir(outputDirectory, { recursive: true });
await createScene({ width: 2048, height: 1152, seed: 20260714, filename: "kagura-hero.webp" });
await createScene({
  width: 1024,
  height: 1536,
  seed: 20260715,
  filename: "kagura-hero-mobile.webp",
});
await createScene({ width: 1600, height: 900, seed: 20260716, filename: "default-cover.webp" });
await createScene({ width: 800, height: 800, seed: 20260717, filename: "kagura-avatar.webp" });
