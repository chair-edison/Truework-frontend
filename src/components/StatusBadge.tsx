"use client";

import { BadgeCheck, CircleDashed, CircleHelp, ShieldCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n";
import { toStatusKey, type StatusKey } from "@/lib/status";

export const STATUS_ICON: Record<StatusKey, LucideIcon> = {
  OFFICIAL: ShieldCheck,
  VERIFIED_EMPLOYER: BadgeCheck,
  UNVERIFIED: CircleHelp,
  WARNING: TriangleAlert,
  UNAVAILABLE: CircleDashed,
};

export function StatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" | "lg" }) {
  const { dict } = useI18n();
  const key = toStatusKey(status);
  const Icon = STATUS_ICON[key];
  return (
    <span className={`badge badge--${key.toLowerCase()} badge--${size}`}>
      <Icon size={size === "lg" ? 18 : 14} strokeWidth={2.25} aria-hidden />
      {dict.status[key].label}
    </span>
  );
}
