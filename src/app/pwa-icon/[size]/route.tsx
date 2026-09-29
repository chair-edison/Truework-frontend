import { ImageResponse } from "next/og";

const SIZES = new Set([180, 192, 512]);

export async function GET(req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size: raw } = await ctx.params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192;
  const maskable = new URL(req.url).searchParams.has("maskable");
  const inner = Math.round(size * (maskable ? 0.56 : 0.72));
  const radius = maskable ? 0 : Math.round(size * 0.22);

  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#243244", borderRadius: radius, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={inner} height={inner} viewBox="96 88 320 344">
          <path d="M256 104l128 48v92c0 86-54 146-128 172-74-26-128-86-128-172v-92z" fill="none" stroke="#FFFFFF" strokeWidth="28" strokeLinejoin="round" />
          <path d="M196 262l42 42 82-86" fill="none" stroke="#FFA73D" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
