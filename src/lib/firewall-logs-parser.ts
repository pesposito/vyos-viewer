// ============================================================
// VyOS firewall drop logs parser
// Parses kernel logs from `show log kernel`
// ============================================================

export interface DropLogEntry {
  timestamp: string;
  ruleset: string;
  inInterface: string;
  outInterface: string;
  srcIp: string;
  dstIp: string;
  protocol: string;
  srcPort?: string;
  dstPort?: string;
  length: number;
  ttl: number;
  flags?: string; // SYN, RST, ACK, etc.
  icmpType?: string;
  icmpCode?: string;
}

export interface AggregatedSource {
  srcIp: string;
  count: number;
  protocols: Record<string, number>;
  dstPorts: Record<string, number>;
  rulesets: Record<string, number>;
  lastSeen: string;
}

export interface AggregatedPort {
  port: string;
  count: number;
  sources: number; // unique source IPs
  protocol: string;
}

export interface DropLogStats {
  entries: DropLogEntry[];
  bySource: AggregatedSource[];
  byDstPort: AggregatedPort[];
  byRuleset: Record<string, number>;
  totalDrops: number;
}

export function parseFirewallLogs(raw: string): DropLogStats {
  const entries: DropLogEntry[] = [];

  // Split by \n (literal or actual newlines)
  const lines = raw.split(/\\n|\n/).filter((l) => l.includes("IN="));

  for (const line of lines) {
    const entry = parseLogLine(line);
    if (entry) entries.push(entry);
  }

  return aggregateStats(entries);
}

/**
 * Filter entries by time window (in minutes from now).
 * Returns a new DropLogStats with only entries within the window.
 */
export function filterByTimeWindow(
  stats: DropLogStats,
  windowMinutes: number | null
): DropLogStats {
  if (windowMinutes === null) return stats;

  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMinutes * 60 * 1000);

  const filtered = stats.entries.filter((e) => {
    const d = parseLogTimestamp(e.timestamp);
    return d !== null && d >= cutoff;
  });

  return aggregateStats(filtered);
}

/**
 * Parse log timestamp "Mar 24 18:33:36" into a Date (current year assumed).
 */
function parseLogTimestamp(ts: string): Date | null {
  if (!ts) return null;
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  const parts = ts.match(/^(\w+)\s+(\d+)\s+(\d+):(\d+):(\d+)/);
  if (!parts) return null;

  const month = months[parts[1]];
  if (month === undefined) return null;

  const now = new Date();
  return new Date(
    now.getFullYear(),
    month,
    parseInt(parts[2], 10),
    parseInt(parts[3], 10),
    parseInt(parts[4], 10),
    parseInt(parts[5], 10)
  );
}

function parseLogLine(line: string): DropLogEntry | null {
  // Extract ruleset name: [ipv4-RULESET_NAME-default-D] or [ipv4-RULESET_NAME-RULENUM-D/A/R]
  const rulesetMatch = line.match(/\[ipv4-(\S+?)-default-[DAR]\]/);
  if (!rulesetMatch) return null;

  // Extract timestamp
  const tsMatch = line.match(/^(\w+ \d+ \d+:\d+:\d+)/);

  const extract = (key: string): string => {
    const m = line.match(new RegExp(`${key}=(\\S+)`));
    return m ? m[1] : "";
  };

  const protocol = extract("PROTO");
  const entry: DropLogEntry = {
    timestamp: tsMatch ? tsMatch[1] : "",
    ruleset: rulesetMatch[1],
    inInterface: extract("IN"),
    outInterface: extract("OUT"),
    srcIp: extract("SRC"),
    dstIp: extract("DST"),
    protocol,
    length: parseInt(extract("LEN"), 10) || 0,
    ttl: parseInt(extract("TTL"), 10) || 0,
  };

  if (protocol === "TCP" || protocol === "UDP") {
    entry.srcPort = extract("SPT");
    entry.dstPort = extract("DPT");
  }

  if (protocol === "ICMP") {
    entry.icmpType = extract("TYPE");
    entry.icmpCode = extract("CODE");
  }

  // TCP flags
  const flags: string[] = [];
  if (line.includes(" SYN ")) flags.push("SYN");
  if (line.includes(" ACK ")) flags.push("ACK");
  if (line.includes(" RST ")) flags.push("RST");
  if (line.includes(" FIN ")) flags.push("FIN");
  if (line.includes(" PSH ")) flags.push("PSH");
  if (flags.length > 0) entry.flags = flags.join(",");

  return entry;
}

function aggregateStats(entries: DropLogEntry[]): DropLogStats {
  // By source IP
  const srcMap = new Map<string, AggregatedSource>();
  for (const e of entries) {
    let agg = srcMap.get(e.srcIp);
    if (!agg) {
      agg = {
        srcIp: e.srcIp,
        count: 0,
        protocols: {},
        dstPorts: {},
        rulesets: {},
        lastSeen: e.timestamp,
      };
      srcMap.set(e.srcIp, agg);
    }
    agg.count++;
    agg.protocols[e.protocol] = (agg.protocols[e.protocol] || 0) + 1;
    if (e.dstPort) {
      agg.dstPorts[e.dstPort] = (agg.dstPorts[e.dstPort] || 0) + 1;
    }
    agg.rulesets[e.ruleset] = (agg.rulesets[e.ruleset] || 0) + 1;
    agg.lastSeen = e.timestamp;
  }

  // By destination port
  const portMap = new Map<string, { count: number; sources: Set<string>; protocol: string }>();
  for (const e of entries) {
    if (!e.dstPort) continue;
    const key = `${e.protocol}/${e.dstPort}`;
    let agg = portMap.get(key);
    if (!agg) {
      agg = { count: 0, sources: new Set(), protocol: e.protocol };
      portMap.set(key, agg);
    }
    agg.count++;
    agg.sources.add(e.srcIp);
  }

  // By ruleset
  const byRuleset: Record<string, number> = {};
  for (const e of entries) {
    byRuleset[e.ruleset] = (byRuleset[e.ruleset] || 0) + 1;
  }

  const bySource = Array.from(srcMap.values()).sort((a, b) => b.count - a.count);
  const byDstPort = Array.from(portMap.entries())
    .map(([key, val]) => ({
      port: key,
      count: val.count,
      sources: val.sources.size,
      protocol: val.protocol,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    entries,
    bySource,
    byDstPort,
    byRuleset,
    totalDrops: entries.length,
  };
}
