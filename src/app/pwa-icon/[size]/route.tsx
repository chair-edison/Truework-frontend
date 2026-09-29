import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// PNG 아이콘은 public/icons/icon.svg 하나를 원본으로 렌더링한다(아이콘 교체 시 SVG 만 바꾸면 됨).
const SIZES = new Set([32, 180, 192, 512]);
let svgDataUri: Promise<string> | null = null;

function loadSvg() {
  svgDataUri ??= readFile(path.join(process.cwd(), "public/icons/icon.svg")).then(
    (buf) => `data:image/svg+xml;base64,${buf.toString("base64")}`,
  );
  return svgDataUri;
}

export async function GET(req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: raw } = await ctx.params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192;
  // maskable: 런처가 원형·물방울 등으로 잘라도 로고가 남도록 안전 영역(80%) 안에 배치
  const maskable = new URL(req.url).searchParams.has("maskable");
  const inner = Math.round(size * (maskable ? 0.72 : 1));
  const src = await loadSvg();

  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={inner} height={inner} alt="" />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
