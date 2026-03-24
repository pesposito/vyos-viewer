"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { DropLogStats, AggregatedSource, filterByTimeWindow } from "@/lib/firewall-logs-parser";
import { ZoneEntry } from "@/lib/vyos-parser";
import TimeWindowSelector, { TimeWindow, timeWindowToMinutes } from "@/components/TimeWindowSelector";

interface Props {
  stats: DropLogStats;
  zones: ZoneEntry[];
  onRefresh: () => Promise<void>;
}

export default function DropLogsView({ stats, zones, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedIp, setSelectedIp] = useState<string | null>(null);
  const [rulesetFilter, setRulesetFilter] = useState<string>("all");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("30m");

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(handleRefresh, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, handleRefresh]);

  // Apply time window filter
  const timeFiltered = useMemo(
    () => filterByTimeWindow(stats, timeWindowToMinutes(timeWindow)),
    [stats, timeWindow]
  );

  // Build all rulesets from zones (from -> to pairs)
  const allRulesets: string[] = [];
  for (const zone of zones) {
    for (const rsName of Object.values(zone.from)) {
      if (!allRulesets.includes(rsName)) allRulesets.push(rsName);
    }
  }
  allRulesets.sort();

  const rulesets = Object.keys(timeFiltered.byRuleset).sort();

  // Filter entries by ruleset
  const filteredBySource =
    rulesetFilter === "all"
      ? timeFiltered.bySource
      : timeFiltered.bySource
          .map((s) => ({
            ...s,
            count: s.rulesets[rulesetFilter] || 0,
          }))
          .filter((s) => s.count > 0)
          .sort((a, b) => b.count - a.count);

  const filteredByPort =
    rulesetFilter === "all"
      ? timeFiltered.byDstPort
      : timeFiltered.byDstPort;

  const filteredEntries =
    rulesetFilter === "all"
      ? timeFiltered.entries
      : timeFiltered.entries.filter((e) => e.ruleset === rulesetFilter);

  const selectedSource = selectedIp
    ? timeFiltered.bySource.find((s) => s.srcIp === selectedIp)
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Logs des paquets droppés
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {timeFiltered.totalDrops} drops dans la fenêtre sélectionnée
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TimeWindowSelector value={timeWindow} onChange={setTimeWindow} />
            <select
              value={rulesetFilter}
              onChange={(e) => setRulesetFilter(e.target.value)}
              className="text-xs bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-[var(--text-primary)]"
            >
              <option value="all">Toutes les zones</option>
              {allRulesets.map((rs) => (
                <option key={rs} value={rs}>
                  {rs}
                  {timeFiltered.byRuleset[rs] ? ` (${timeFiltered.byRuleset[rs]} drops)` : " (0 drops)"}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto (15s)
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

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total drops loggés"
            value={
              rulesetFilter === "all"
                ? timeFiltered.totalDrops.toLocaleString()
                : filteredEntries.length.toLocaleString()
            }
          />
          <StatCard
            label="IP sources uniques"
            value={filteredBySource.length.toLocaleString()}
          />
          <StatCard
            label="Ports ciblés"
            value={filteredByPort.length.toLocaleString()}
          />
          <StatCard
            label="Rulesets actifs"
            value={rulesets.length.toLocaleString()}
          />
        </div>
      </div>

      {/* By ruleset breakdown */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Drops par zone
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {rulesets.map((rs) => (
            <button
              key={rs}
              onClick={() =>
                setRulesetFilter(rs === rulesetFilter ? "all" : rs)
              }
              className={`text-left p-3 rounded-lg border transition-colors ${
                rulesetFilter === rs
                  ? "border-[var(--accent)] bg-[var(--bg-card-hover)]"
                  : "border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{rs}</span>
                <span className="text-[var(--danger)] font-mono font-medium">
                  {timeFiltered.byRuleset[rs] || 0}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top source IPs */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Top IP sources bloquées
          </h3>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {filteredBySource.slice(0, 50).map((src) => (
              <button
                key={src.srcIp}
                onClick={() =>
                  setSelectedIp(
                    src.srcIp === selectedIp ? null : src.srcIp
                  )
                }
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedIp === src.srcIp
                    ? "bg-[var(--accent)]/20 border border-[var(--accent)]"
                    : "hover:bg-[var(--bg-card-hover)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono">{src.srcIp}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-[var(--danger)] font-mono font-medium">
                      {src.count}x
                    </span>
                    <DropBar count={src.count} max={filteredBySource[0]?.count || 1} />
                  </div>
                </div>
                <div className="flex gap-2 mt-0.5">
                  {Object.entries(src.protocols).map(([proto, count]) => (
                    <span
                      key={proto}
                      className="text-[10px] text-[var(--text-secondary)]"
                    >
                      {proto}:{count}
                    </span>
                  ))}
                </div>
              </button>
            ))}
            {filteredBySource.length === 0 && (
              <p className="text-sm text-[var(--text-secondary)] text-center py-4">
                Aucun drop loggé
              </p>
            )}
          </div>
        </div>

        {/* Top destination ports */}
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
            Top ports ciblés
          </h3>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {filteredByPort.slice(0, 50).map((port) => (
              <div
                key={port.port}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-[var(--bg-card-hover)]"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-medium">{port.port}</span>
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    {port.sources} source{port.sources > 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--warning)] font-mono">
                    {port.count}x
                  </span>
                  <DropBar count={port.count} max={filteredByPort[0]?.count || 1} />
                </div>
              </div>
            ))}
            {filteredByPort.length === 0 && (
              <p className="text-sm text-[var(--text-secondary)] text-center py-4">
                Aucun port TCP/UDP ciblé
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Selected IP detail */}
      {selectedSource && (
        <SourceDetail
          source={selectedSource}
          entries={filteredEntries.filter(
            (e) => e.srcIp === selectedSource.srcIp
          )}
        />
      )}

      {/* Recent drops log */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
          Derniers drops ({Math.min(filteredEntries.length, 100)} /{" "}
          {filteredEntries.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[var(--text-secondary)] uppercase">
                <th className="p-1.5">Heure</th>
                <th className="p-1.5">Ruleset</th>
                <th className="p-1.5">Proto</th>
                <th className="p-1.5">Source</th>
                <th className="p-1.5">Destination</th>
                <th className="p-1.5">Flags</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries
                .slice(-100)
                .reverse()
                .map((e, i) => (
                  <tr
                    key={i}
                    className="border-t border-[var(--border)] hover:bg-[var(--bg-card-hover)]"
                  >
                    <td className="p-1.5 font-mono text-[var(--text-secondary)]">
                      {e.timestamp}
                    </td>
                    <td className="p-1.5 font-mono">{e.ruleset}</td>
                    <td className="p-1.5 font-mono">{e.protocol}</td>
                    <td className="p-1.5 font-mono">
                      {e.srcIp}
                      {e.srcPort && `:${e.srcPort}`}
                    </td>
                    <td className="p-1.5 font-mono">
                      {e.dstIp}
                      {e.dstPort && `:${e.dstPort}`}
                      {e.icmpType && ` (type ${e.icmpType})`}
                    </td>
                    <td className="p-1.5">
                      {e.flags && (
                        <span className="px-1.5 py-0.5 bg-red-900/30 text-red-300 rounded text-[10px]">
                          {e.flags}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SourceDetail({
  source,
  entries,
}: {
  source: AggregatedSource;
  entries: ReturnType<typeof Array<import("@/lib/firewall-logs-parser").DropLogEntry>>;
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--accent)] rounded-xl p-4">
      <h3 className="text-lg font-semibold mb-3">
        Détail : {source.srcIp}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border)]">
          <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-1">
            Tentatives
          </div>
          <div className="text-xl font-mono font-bold text-[var(--danger)]">
            {source.count}
          </div>
        </div>

        <div className="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border)]">
          <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-1">
            Protocoles
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(source.protocols).map(([proto, count]) => (
              <span
                key={proto}
                className="text-xs font-mono bg-[var(--bg-secondary)] px-2 py-0.5 rounded"
              >
                {proto}: {count}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border)]">
          <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-1">
            Ports ciblés
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(source.dstPorts)
              .sort(([, a], [, b]) => b - a)
              .map(([port, count]) => (
                <span
                  key={port}
                  className="text-xs font-mono bg-[var(--bg-secondary)] px-2 py-0.5 rounded"
                >
                  :{port} ({count})
                </span>
              ))}
            {Object.keys(source.dstPorts).length === 0 && (
              <span className="text-xs text-[var(--text-secondary)]">
                Pas de ports (ICMP ?)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border)]">
        <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-1">
          Zones ciblées
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(source.rulesets)
            .sort(([, a], [, b]) => b - a)
            .map(([rs, count]) => (
              <span
                key={rs}
                className="text-xs font-mono bg-[var(--bg-secondary)] px-2 py-0.5 rounded"
              >
                {rs}: {count}
              </span>
            ))}
        </div>
      </div>

      <p className="text-xs text-[var(--text-secondary)] mt-2">
        Dernière tentative : {source.lastSeen}
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border)]">
      <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-xl font-mono font-bold">{value}</div>
    </div>
  );
}

function DropBar({ count, max }: { count: number; max: number }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="w-16 h-2 bg-[var(--bg-primary)] rounded-full overflow-hidden">
      <div
        className="h-full bg-[var(--danger)] rounded-full"
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}
