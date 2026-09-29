"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleAlert, WifiOff } from "lucide-react";
import { I18nProvider, useI18n } from "@/i18n";
import { markNavigation } from "@/lib/nav";
import { AuthProvider, useAuth } from "./providers/AuthProvider";
import { SavedProvider } from "./providers/SavedProvider";
import { ToastProvider } from "./providers/ToastProvider";
import { BottomNav } from "./BottomNav";

const NO_NAV = ["/login", "/onboarding"];

function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { dict } = useI18n();
  const { expired, session } = useAuth();
  const [online, setOnline] = useState(true);
  const showNav = !NO_NAV.some((p) => pathname.startsWith(p));

  useEffect(() => {
    markNavigation();
  }, [pathname]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <div className={`app ${showNav ? "app--with-nav" : ""}`}>
      <a href="#main" className="skip-link">본문으로 건너뛰기</a>
      {!online && (
        <div className="global-banner" role="status">
          <WifiOff size={16} aria-hidden /> {dict.errors.offline}
        </div>
      )}
      {expired && !session && pathname !== "/login" && (
        <div className="global-banner global-banner--warn" role="alert">
          <CircleAlert size={16} aria-hidden />
          <span>{dict.auth.reason.expired}</span>
          <Link href={`/login?reason=expired&next=${encodeURIComponent(pathname)}`} className="global-banner__link">
            {dict.auth.login}
          </Link>
        </div>
      )}
      <main id="main" className="app__main">{children}</main>
      {showNav && <BottomNav />}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <ToastProvider>
        <Suspense fallback={null}>
          <AuthProvider>
            <SavedProvider>
              <Chrome>{children}</Chrome>
            </SavedProvider>
          </AuthProvider>
        </Suspense>
      </ToastProvider>
    </I18nProvider>
  );
}
