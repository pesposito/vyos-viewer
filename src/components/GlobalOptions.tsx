"use client";

import { GlobalOptions as GlobalOptionsType } from "@/lib/vyos-parser";

export default function GlobalOptions({ options }: { options: GlobalOptionsType }) {
  const entries = Object.entries(options).filter(([, v]) => v !== undefined);

  if (entries.length === 0) return null;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
        Options globales
      </h3>
      <div className="flex flex-wrap gap-3">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className="flex items-center gap-2 bg-[var(--bg-primary)] px-3 py-1.5 rounded-lg text-sm"
          >
            <span className="text-[var(--text-secondary)]">
              {camelToLabel(key)}
            </span>
            <span
              className={
                value === "enable"
                  ? "text-[var(--success)] font-medium"
                  : "text-[var(--danger)] font-medium"
              }
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function camelToLabel(s: string): string {
  return s.replace(/([A-Z])/g, " $1").toLowerCase();
}
