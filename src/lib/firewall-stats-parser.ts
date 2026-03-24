// ============================================================
// VyOS firewall statistics parser
// Parses output of `show firewall` (live counters)
// ============================================================

export interface RuleStats {
  number: string; // "10", "20", "default"
  action: string;
  protocol: string;
  packets: number;
  bytes: number;
  conditions?: string;
}

export interface RulesetStats {
  name: string;
  rules: RuleStats[];
  totalPackets: number;
  totalBytes: number;
  droppedPackets: number;
  droppedBytes: number;
}

export interface FirewallStats {
  rulesets: RulesetStats[];
  totalDroppedPackets: number;
  totalDroppedBytes: number;
}

export function parseFirewallStats(raw: string): FirewallStats {
  const rulesets: RulesetStats[] = [];

  // Split by ruleset sections
  const sections = raw.split(/^-{10,}$/m).filter((s) => s.trim());

  for (const section of sections) {
    const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);

    // Find ruleset name: ipv4 Firewall "name XXX"
    const nameMatch = lines[0]?.match(/Firewall "name (\S+)"/);
    if (!nameMatch) continue;

    const rsName = nameMatch[1];
    const rules: RuleStats[] = [];

    // Find the data lines (after the header and separator lines)
    const headerIdx = lines.findIndex((l) => l.startsWith("Rule"));
    if (headerIdx === -1) continue;

    // Skip the separator line (------  --------  ...)
    for (let i = headerIdx + 2; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.startsWith("-")) continue;

      // Parse columns by splitting on 2+ spaces
      const cols = line.split(/\s{2,}/);
      if (cols.length < 5) continue;

      const rule: RuleStats = {
        number: cols[0],
        action: cols[1],
        protocol: cols[2],
        packets: parseInt(cols[3], 10) || 0,
        bytes: parseInt(cols[4], 10) || 0,
      };

      // Conditions may be in column 5+
      if (cols.length > 5) {
        rule.conditions = cols.slice(5).join("  ");
      }

      rules.push(rule);
    }

    const totalPackets = rules.reduce((sum, r) => sum + r.packets, 0);
    const totalBytes = rules.reduce((sum, r) => sum + r.bytes, 0);
    const dropRules = rules.filter(
      (r) => r.action === "drop" || r.action === "reject"
    );
    const droppedPackets = dropRules.reduce((sum, r) => sum + r.packets, 0);
    const droppedBytes = dropRules.reduce((sum, r) => sum + r.bytes, 0);

    rulesets.push({
      name: rsName,
      rules,
      totalPackets,
      totalBytes,
      droppedPackets,
      droppedBytes,
    });
  }

  const totalDroppedPackets = rulesets.reduce(
    (sum, rs) => sum + rs.droppedPackets,
    0
  );
  const totalDroppedBytes = rulesets.reduce(
    (sum, rs) => sum + rs.droppedBytes,
    0
  );

  return { rulesets, totalDroppedPackets, totalDroppedBytes };
}

export function formatBytesHuman(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
