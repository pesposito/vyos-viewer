"use client";

import { ZoneEntry, FirewallRuleset } from "@/lib/vyos-parser";

interface Props {
  zones: ZoneEntry[];
  rulesets: FirewallRuleset[];
  onSelectRuleset: (name: string) => void;
  selectedRuleset: string | null;
}

export default function ZoneMatrix({
  zones,
  rulesets,
  onSelectRuleset,
  selectedRuleset,
}: Props) {
  if (zones.length === 0) return null;

  const zoneNames = zones.map((z) => z.name);
  const rulesetMap = new Map(rulesets.map((rs) => [rs.name, rs]));

  // Build matrix: matrix[toZone][fromZone] = rulesetName
  const matrix: Record<string, Record<string, string | null>> = {};
  for (const zone of zones) {
    matrix[zone.name] = {};
    for (const zn of zoneNames) {
      matrix[zone.name][zn] = zone.from[zn] || null;
    }
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
        Matrice des zones
      </h3>
      <p className="text-xs text-[var(--text-secondary)] mb-4">
        Lignes = source, Colonnes = destination. Cliquez sur une cellule pour
        voir le détail du ruleset.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="p-2 text-left text-[var(--text-secondary)] font-medium">
                de \ vers
              </th>
              {zoneNames.map((zn) => (
                <th
                  key={zn}
                  className="p-2 text-center text-[var(--text-secondary)] font-medium min-w-[120px]"
                >
                  <div>{zn}</div>
                  <div className="text-xs font-normal opacity-60">
                    {zones.find((z) => z.name === zn)?.interface ||
                      (zones.find((z) => z.name === zn)?.localZone
                        ? "local"
                        : "")}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zoneNames.map((fromZone) => (
              <tr key={fromZone}>
                <td className="p-2 font-medium">
                  <div>{fromZone}</div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {zones.find((z) => z.name === fromZone)?.interface ||
                      (zones.find((z) => z.name === fromZone)?.localZone
                        ? "local"
                        : "")}
                  </div>
                </td>
                {zoneNames.map((toZone) => {
                  if (fromZone === toZone) {
                    return (
                      <td
                        key={toZone}
                        className="p-2 text-center action-none rounded"
                      >
                        —
                      </td>
                    );
                  }

                  const rsName = matrix[toZone]?.[fromZone];
                  const rs = rsName ? rulesetMap.get(rsName) : null;
                  const hasRules = rs && rs.rules.length > 0;
                  const isSelected = rsName === selectedRuleset;

                  let cellClass: string;
                  if (!rs) {
                    cellClass = "action-none";
                  } else if (!hasRules) {
                    cellClass = `action-${rs.defaultAction}-light`;
                  } else {
                    cellClass = `action-${rs.defaultAction}`;
                  }

                  return (
                    <td
                      key={toZone}
                      className={`p-2 text-center rounded cursor-pointer transition-all ${cellClass} ${
                        isSelected
                          ? "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--bg-card)]"
                          : "hover:opacity-80"
                      }`}
                      onClick={() => rsName && onSelectRuleset(rsName)}
                      title={rs?.description || rsName || "Non défini"}
                    >
                      <div className="font-mono text-xs font-medium">
                        {rsName || "—"}
                      </div>
                      {rs && (
                        <div className="text-[10px] opacity-75 mt-0.5">
                          {rs.rules.length} rule{rs.rules.length > 1 ? "s" : ""}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
