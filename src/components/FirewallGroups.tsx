"use client";

import { FirewallGroups as FirewallGroupsType } from "@/lib/vyos-parser";

export default function FirewallGroups({ groups }: { groups: FirewallGroupsType }) {
  const hasGroups =
    groups.addressGroups.length > 0 || groups.portGroups.length > 0;

  if (!hasGroups) return null;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
        Groupes
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {groups.addressGroups.map((g) => (
          <div
            key={g.name}
            className="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border)]"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded-full">
                address
              </span>
              <span className="font-medium text-sm">{g.name}</span>
            </div>
            <div className="space-y-1">
              {g.addresses.map((addr) => (
                <div
                  key={addr}
                  className="text-xs text-[var(--text-secondary)] font-mono bg-[var(--bg-secondary)] px-2 py-1 rounded"
                >
                  {addr}
                </div>
              ))}
            </div>
          </div>
        ))}
        {groups.portGroups.map((g) => (
          <div
            key={g.name}
            className="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border)]"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded-full">
                port
              </span>
              <span className="font-medium text-sm">{g.name}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {g.ports.map((port) => (
                <span
                  key={port}
                  className="text-xs font-mono bg-[var(--bg-secondary)] px-2 py-1 rounded"
                >
                  {port}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
