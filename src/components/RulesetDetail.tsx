"use client";

import { FirewallRuleset, FirewallGroups as FwGroups } from "@/lib/vyos-parser";

interface Props {
  ruleset: FirewallRuleset;
  groups: FwGroups;
}

export default function RulesetDetail({ ruleset, groups }: Props) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{ruleset.name}</h3>
          {ruleset.description && (
            <p className="text-sm text-[var(--text-secondary)]">
              {ruleset.description}
            </p>
          )}
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium action-${ruleset.defaultAction}`}
        >
          default: {ruleset.defaultAction}
        </span>
      </div>

      {ruleset.rules.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-sm">
          Aucune rule définie — seule la default-action s&apos;applique.
        </p>
      ) : (
        <div className="space-y-2">
          {ruleset.rules.map((rule) => (
            <div
              key={rule.number}
              className={`flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]`}
            >
              {/* Rule number */}
              <div className="text-sm font-mono text-[var(--text-secondary)] w-10 shrink-0 text-right">
                {rule.number}
              </div>

              {/* Action badge */}
              <div
                className={`px-2 py-0.5 rounded text-xs font-bold uppercase shrink-0 action-${rule.action}`}
              >
                {rule.action}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                {rule.description && (
                  <p className="text-sm mb-1">{rule.description}</p>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {rule.protocol && (
                    <Tag label="proto" value={rule.protocol} />
                  )}

                  {rule.state && rule.state.length > 0 && (
                    <Tag label="state" value={rule.state.join(", ")} />
                  )}

                  {rule.source && (
                    <EndpointTag
                      direction="src"
                      ep={rule.source}
                      groups={groups}
                    />
                  )}

                  {rule.destination && (
                    <EndpointTag
                      direction="dst"
                      ep={rule.destination}
                      groups={groups}
                    />
                  )}

                  {rule.tcp?.flags && (
                    <Tag label="tcp flags" value={rule.tcp.flags} />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Tag({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-[var(--text-secondary)]">
      <span className="opacity-60">{label}:</span>{" "}
      <span className="font-mono text-[var(--text-primary)]">{value}</span>
    </span>
  );
}

function EndpointTag({
  direction,
  ep,
  groups,
}: {
  direction: "src" | "dst";
  ep: NonNullable<import("@/lib/vyos-parser").FirewallRule["source"]>;
  groups: FwGroups;
}) {
  const parts: string[] = [];

  if (ep.address) parts.push(ep.address);
  if (ep.group?.addressGroup) {
    const g = groups.addressGroups.find(
      (ag) => ag.name === ep.group!.addressGroup
    );
    parts.push(
      `@${ep.group.addressGroup}` +
        (g ? ` [${g.addresses.join(", ")}]` : "")
    );
  }
  if (ep.port) parts.push(`:${ep.port}`);
  if (ep.group?.portGroup) {
    const g = groups.portGroups.find(
      (pg) => pg.name === ep.group!.portGroup
    );
    parts.push(
      `@${ep.group.portGroup}` + (g ? ` [${g.ports.join(", ")}]` : "")
    );
  }

  if (parts.length === 0) return null;

  return <Tag label={direction} value={parts.join(" ")} />;
}
