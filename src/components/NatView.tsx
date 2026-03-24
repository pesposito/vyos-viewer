"use client";

import { NatConfig, NatRule } from "@/lib/nat-parser";

interface Props {
  config: NatConfig;
}

export default function NatView({ config }: Props) {
  return (
    <div className="space-y-4">
      <NatSection
        title="Destination NAT (DNAT)"
        subtitle="Trafic entrant — redirige vers une IP interne"
        rules={config.destinationRules}
        type="destination"
      />
      <NatSection
        title="Source NAT (SNAT)"
        subtitle="Trafic sortant — masquerade et hairpin"
        rules={config.sourceRules}
        type="source"
      />
    </div>
  );
}

function NatSection({
  title,
  subtitle,
  rules,
  type,
}: {
  title: string;
  subtitle: string;
  rules: NatRule[];
  type: "source" | "destination";
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
          {title}
        </h3>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          {subtitle}
        </p>
      </div>

      {rules.length === 0 ? (
        <p className="text-[var(--text-secondary)] text-sm">
          Aucune règle définie.
        </p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <NatRuleCard key={rule.number} rule={rule} type={type} />
          ))}
        </div>
      )}
    </div>
  );
}

function NatRuleCard({
  rule,
  type,
}: {
  rule: NatRule;
  type: "source" | "destination";
}) {
  const isMasquerade = rule.translation.address === "masquerade";

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)]">
      {/* Rule number */}
      <div className="text-sm font-mono text-[var(--text-secondary)] w-12 shrink-0 text-right">
        {rule.number}
      </div>

      {/* Type badge */}
      <div
        className={`px-2 py-0.5 rounded text-xs font-bold uppercase shrink-0 ${
          type === "destination"
            ? "bg-blue-900/50 text-blue-300"
            : isMasquerade
              ? "bg-orange-900/50 text-orange-300"
              : "bg-teal-900/50 text-teal-300"
        }`}
      >
        {type === "destination" ? "DNAT" : isMasquerade ? "MASQ" : "SNAT"}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {rule.description && (
          <p className="text-sm mb-1.5">{rule.description}</p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {/* Interface */}
          {rule.inboundInterface && (
            <Tag label="in" value={rule.inboundInterface} />
          )}
          {rule.outboundInterface && (
            <Tag label="out" value={rule.outboundInterface} />
          )}

          {rule.protocol && <Tag label="proto" value={rule.protocol} />}

          {/* Source */}
          {rule.source && (rule.source.address || rule.source.port) && (
            <Tag
              label="src"
              value={formatEndpoint(rule.source.address, rule.source.port)}
            />
          )}

          {/* Destination */}
          {rule.destination &&
            (rule.destination.address || rule.destination.port) && (
              <Tag
                label="dst"
                value={formatEndpoint(
                  rule.destination.address,
                  rule.destination.port
                )}
              />
            )}
        </div>

        {/* Translation arrow */}
        <div className="mt-2 flex items-center gap-2 text-xs">
          <span className="text-[var(--text-secondary)]">translate vers</span>
          <span className="font-mono text-[var(--accent)] font-medium">
            {formatEndpoint(
              rule.translation.address,
              rule.translation.port
            ) || "—"}
          </span>
        </div>
      </div>
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

function formatEndpoint(address?: string, port?: string): string {
  if (!address && !port) return "";
  if (address && port) return `${address}:${port}`;
  return address || `:${port}`;
}
