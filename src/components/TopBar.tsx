"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n";
import { canGoBack } from "@/lib/nav";

type Props = {
  title: string;
  /** 뒤로가기 버튼 표시. 히스토리가 없으면(딥링크 진입) fallback 경로로 이동한다. */
  backFallback?: string;
  actions?: ReactNode;
  large?: boolean;
};

export function TopBar({ title, backFallback, actions, large }: Props) {
  const router = useRouter();
  const { dict } = useI18n();
  const goBack = () => {
    if (canGoBack()) router.back();
    else router.push(backFallback ?? "/jobs");
  };
  return (
    <header className={`topbar ${large ? "topbar--large" : ""}`}>
      {backFallback && (
        <button className="icon-btn" onClick={goBack} aria-label={dict.common.back}>
          <ChevronLeft size={24} aria-hidden />
        </button>
      )}
      <h1 className="topbar__title">{title}</h1>
      <div className="topbar__actions">{actions}</div>
    </header>
  );
}
