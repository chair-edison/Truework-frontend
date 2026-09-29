import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Truework — 신뢰할 수 있는 일자리",
    short_name: "Truework",
    description: "신뢰할 수 있는 출처의 채용 공고를 찾고, 의심스러운 채용 제안을 확인하세요.",
    id: "/",
    start_url: "/jobs",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFFFF",
    theme_color: "#FFFFFF",
    lang: "ko",
    categories: ["business", "productivity"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "채용 제안 검사", short_name: "검사", url: "/check" },
      { name: "저장한 공고", short_name: "저장", url: "/saved" },
    ],
  };
}
