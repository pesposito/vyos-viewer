"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  FirewallStats,
  RulesetStats,
  formatBytesHuman,
} from "@/lib/firewall-stats-parser";
import { ZoneEntry } from "@/lib/vyos-parser";
import TimeWindowSelector, { TimeWindow, timeWindowToMinutes } from "@/components/TimeWindowSelector";

interface Snapshot {
  timestamp: number;
  stats: FirewallStats;
}

interface Props {
  stats: FirewallStats;
  zones: ZoneEntry[];
  onRefresh: () => Promise<void>;
}

export default function FirewallStatsView({ stats, zones, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedRuleset, setSelectedRuleset] = useState<string | null>(null);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");
  const snapshots = useRef<Snapshot[]>([]);

  // Store a snapshot each time stats change
  useEffect(() => {
    snapshots.current.push({ timestamp: Date.now(), stats });
    // Keep max 1h of snapshots (cleanup old ones)
    const cutoff = Date.now() - 3600 * 1000;
    snapshots.current = snapshots.current.filter((s) => s.timestamp >= cutoff);
  }, [stats]);

  // Compute delta stats based on time window
  const displayStats = useMemo((): FirewallStats => {
    const minutes = timeWindowToMinutes(timeWindow);
    if (minutes === null) return stats; // "Tout" = cumulative since boot

    const cutoff = Date.now() - minutes * 60 * 1000;
    // Find the oldest snapshot within the window
    const baseline = snapshots.current.find((s) => s.timestamp >= cutoff);
    if (!baseline) return stats; // Not enough history yet

    // Compute delta
    return computeDelta(baseline.stats, stats);
  }, [stats, timeWindow]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(handleRefresh, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, handleRefresh]);

  // Build zone pair mapping: rulesetName -> { from, to }
  const zonePairMap: Record<string, { from: string; to: string }> = {};
  for (const zone of zones) {
    for (const [fromZone, rsName] of Object.entries(zone.from)) {
      zonePairMap[rsName] = { from: fromZone, to: zone.name };
    }
  }

  // Only rulesets with drops
  const withDrops = displayStats.rulesets
    .filter((rs) => rs.droppedPackets > 0)
    .sort((a, b) => b.droppedPackets - a.droppedPackets);

  // All rulesets sorted by total traffic
  const byTraffic = [...displayStats.rulesets].sort(
    (a, b) => b.totalPackets - a.totalPackets
  );

  const selected = selectedRuleset
    ? displayStats.rulesets.find((rs) => rs.name === selectedRuleset)
    : null;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Statistiques firewall
          </h3>
          <div className="flex items-center gap-2">
            <TimeWindowSelector value={timeWindow} onChange={setTimeWindow} />
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto (10s)
            </label>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-1.5 text-xs bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors disabled:opacity-50"
            >
              {refreshing ? "..." : "Rafraîchir"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total paquets droppés"
            value={displayStats.totalDroppedPackets.toLocaleString()}
            accent="danger"
          />
          <StatCard
            label="Volume droppé"
            value={formatBytesHuman(displayStats.totalDroppedBytes)}
            accent="danger"
          />
          <StatCard
            label="Rulesets avec drops"
            value={`${withDrops.length} / ${displayStats.rulesets.length}`}
            accent="warning"
          />
          <StatCard
            label="Total rulesets"
            value={String(displayStats.rulesets.length)}
            accent="default"
          />
        </div>
      </div>

      {/* Drop zone matrix */}
      {withDrops.length > 0 && (
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Paquets droppés par zone
          </h3>
          <div className="space-y-2">
            {withDrops.map((rs) => {
              const pair = zonePairMap[rs.name];
              return (
                <button
                  key={rs.name}
                  onClick={() => setSelectedRuleset(rs.name)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedRuleset === rs.name
                      ? "border-[var(--accent)] bg-[var(--bg-card-hover)]"
                      : "border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {pair && (
                        <span className="text-sm">
                          <span className="font-medium">{pair.from}</span>
                          <span className="text-[var(--text-secondary)] mx-1">
                            →
                          </span>
                          <span className="font-medium">{pair.to}</span>
                        </span>
                      )}
                      <span className="font-mono text-xs text-[var(--text-secondary)]">
                        {rs.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-[var(--danger)] font-mono font-medium">
                        {rs.droppedPackets.toLocaleString()} pkt
                      </span>
                      <span className="text-[var(--text-secondary)] font-mono">
                        {formatBytesHuman(rs.droppedBytes)}
                      </span>
                      <DropBar
                        dropped={rs.droppedPackets}
                        total={rs.totalPackets}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected ruleset detail */}
      {selected && (
        <RulesetStatsDetail
          rs={selected}
          pair={zonePairMap[selected.name]}
        />
      )}

      {/* All rulesets traffic overview */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Trafic par ruleset
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--text-secondary)] text-xs uppercase">
                <th className="p-2">Zone</th>
                <th className="p-2">Ruleset</th>
                <th className="p-2 text-right">Paquets</th>
                <th className="p-2 text-right">Volume</th>
                <th className="p-2 text-right">Droppés</th>
                <th className="p-2 text-right">% drop</th>
              </tr>
            </thead>
            <tbody>
              {byTraffic.map((rs) => {
                const pair = zonePairMap[rs.name];
                const dropPct =
                  rs.totalPackets > 0
                    ? ((rs.droppedPackets / rs.totalPackets) * 100).toFixed(1)
                    : "0.0";
                return (
                  <tr
                    key={rs.name}
                    className="border-t border-[var(--border)] cursor-pointer hover:bg-[var(--bg-card-hover)]"
                    onClick={() => setSelectedRuleset(rs.name)}
                  >
                    <td className="p-2">
                      {pair ? (
                        <span>
                          {pair.from} → {pair.to}
                        </span>
                      ) : (
                        <span className="text-[var(--text-secondary)]">—</span>
                      )}
                    </td>
                    <td className="p-2 font-mono text-xs">{rs.name}</td>
                    <td className="p-2 text-right font-mono">
                      {rs.totalPackets.toLocaleString()}
                    </td>
                    <td className="p-2 text-right font-mono text-[var(--text-secondary)]">
                      {formatBytesHuman(rs.totalBytes)}
                    </td>
                    <td
                      className={`p-2 text-right font-mono ${
                        rs.droppedPackets > 0
                          ? "text-[var(--danger)]"
                          : "text-[var(--text-secondary)]"
                      }`}
                    >
                      {rs.droppedPackets.toLocaleString()}
                    </td>
                    <td
                      className={`p-2 text-right font-mono ${
                        parseFloat(dropPct) > 10
                          ? "text-[var(--danger)]"
                          : parseFloat(dropPct) > 0
                            ? "text-[var(--warning)]"
                            : "text-[var(--text-secondary)]"
                      }`}
                    >
                      {dropPct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RulesetStatsDetail({
  rs,
  pair,
}: {
  rs: RulesetStats;
  pair?: { from: string; to: string };
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-lg font-semibold">{rs.name}</h3>
        {pair && (
          <span className="text-sm text-[var(--text-secondary)]">
            {pair.from} → {pair.to}
          </span>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--text-secondary)] text-xs uppercase">
              <th className="p-2 w-16">Rule</th>
              <th className="p-2 w-20">Action</th>
              <th className="p-2 w-20">Proto</th>
              <th className="p-2 text-right w-24">Paquets</th>
              <th className="p-2 text-right w-24">Volume</th>
              <th className="p-2">Conditions</th>
            </tr>
          </thead>
          <tbody>
            {rs.rules.map((rule) => (
              <tr
                key={rule.number}
                className={`border-t border-[var(--border)] ${
                  rule.action === "drop" && rule.packets > 0
                    ? "bg-red-900/10"
                    : ""
                }`}
              >
                <td className="p-2 font-mono text-[var(--text-secondary)]">
                  {rule.number}
                </td>
                <td className="p-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold uppercase action-${rule.action}`}
                  >
                    {rule.action}
                  </span>
                </td>
                <td className="p-2 font-mono text-xs">{rule.protocol}</td>
                <td
                  className={`p-2 text-right font-mono ${
                    rule.action === "drop" && rule.packets > 0
                      ? "text-[var(--danger)] font-medium"
                      : ""
                  }`}
                >
                  {rule.packets.toLocaleString()}
                </td>
                <td className="p-2 text-right font-mono text-[var(--text-secondary)]">
                  {formatBytesHuman(rule.bytes)}
                </td>
                <td className="p-2 text-xs text-[var(--text-secondary)] font-mono truncate max-w-xs">
                  {rule.conditions || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "danger" | "warning" | "default";
}) {
  const colors = {
    danger: "text-[var(--danger)]",
    warning: "text-[var(--warning)]",
    default: "text-[var(--text-primary)]",
  };

  return (
    <div className="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border)]">
      <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-xl font-mono font-bold ${colors[accent]}`}>
        {value}
      </div>
    </div>
  );
}

function DropBar({ dropped, total }: { dropped: number; total: number }) {
  const pct = total > 0 ? (dropped / total) * 100 : 0;
  return (
    <div className="w-16 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
      <div
        className="h-full bg-[var(--danger)] rounded-full"
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

/**
 * Compute delta between a baseline snapshot and the current stats.
 * Returns stats where all counters = current - baseline.
 */
function computeDelta(baseline: FirewallStats, current: FirewallStats): FirewallStats {
  const baseMap = new Map(baseline.rulesets.map((rs) => [rs.name, rs]));

  const rulesets: RulesetStats[] = current.rulesets.map((rs) => {
    const base = baseMap.get(rs.name);
    if (!base) return rs;

    const rules = rs.rules.map((rule) => {
      const baseRule = base.rules.find((r) => r.number === rule.number);
      if (!baseRule) return rule;
      return {
        ...rule,
        packets: Math.max(0, rule.packets - baseRule.packets),
        bytes: Math.max(0, rule.bytes - baseRule.bytes),
      };
    });

    const totalPackets = rules.reduce((s, r) => s + r.packets, 0);
    const totalBytes = rules.reduce((s, r) => s + r.bytes, 0);
    const dropRules = rules.filter((r) => r.action === "drop" || r.action === "reject");
    const droppedPackets = dropRules.reduce((s, r) => s + r.packets, 0);
    const droppedBytes = dropRules.reduce((s, r) => s + r.bytes, 0);

    return { ...rs, rules, totalPackets, totalBytes, droppedPackets, droppedBytes };
  });

  return {
    rulesets,
    totalDroppedPackets: rulesets.reduce((s, r) => s + r.droppedPackets, 0),
    totalDroppedBytes: rulesets.reduce((s, r) => s + r.droppedBytes, 0),
  };
}
