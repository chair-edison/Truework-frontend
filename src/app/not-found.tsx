"use client";

import { ErrorState } from "@/components/States";
import { ApiError } from "@/lib/api";

export default function NotFound() {
  return (
    <div className="page">
      <div className="page__body">
        <ErrorState error={new ApiError(404, {})} backHref="/jobs" />
      </div>
    </div>
  );
}
