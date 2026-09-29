"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Briefcase, ScanSearch, UserRound } from "lucide-react";
import { useI18n } from "@/i18n";

export function BottomNav() {
  const pathname = usePathname();
  const { dict } = useI18n();
  const tabs = [
    { href: "/jobs", label: dict.nav.jobs, Icon: Briefcase },
    { href: "/check", label: dict.nav.check, Icon: ScanSearch, primary: true },
    { href: "/saved", label: dict.nav.saved, Icon: Bookmark },
    { href: "/profile", label: dict.nav.profile, Icon: UserRound },
  ];
  return (
    <nav className="bottom-nav" aria-label={dict.nav.main}>
      <ul>
        {tabs.map(({ href, label, Icon, primary }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href}>
              <Link
                href={href}
                className={`bottom-nav__item ${active ? "is-active" : ""} ${primary ? "bottom-nav__item--primary" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <span className="bottom-nav__icon">
                  <Icon size={primary ? 22 : 22} strokeWidth={active || primary ? 2.25 : 1.75} aria-hidden />
                </span>
                <span className="bottom-nav__label">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
