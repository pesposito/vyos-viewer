// ============================================================
// VyOS configuration parser
// Supports both JSON API response and "show configuration commands" text
// ============================================================

// -- Firewall types --

export interface FirewallRule {
  number: number;
  action: "accept" | "drop" | "reject";
  description?: string;
  protocol?: string;
  state?: string[];
  source?: {
    address?: string;
    port?: string;
    group?: { addressGroup?: string; portGroup?: string };
  };
  destination?: {
    address?: string;
    port?: string;
    group?: { addressGroup?: string; portGroup?: string };
  };
  tcp?: { flags?: string };
  log?: boolean;
}

export interface FirewallRuleset {
  name: string;
  defaultAction: "accept" | "drop" | "reject";
  description?: string;
  rules: FirewallRule[];
}

export interface AddressGroup {
  name: string;
  addresses: string[];
  description?: string;
}

export interface PortGroup {
  name: string;
  ports: string[];
  description?: string;
}

export interface FirewallGroups {
  addressGroups: AddressGroup[];
  portGroups: PortGroup[];
}

export interface GlobalOptions {
  allPing?: string;
  broadcastPing?: string;
  [key: string]: string | undefined;
}

export interface ZoneEntry {
  name: string;
  interface?: string;
  localZone?: boolean;
  from: Record<string, string>; // fromZone -> rulesetName
}

export interface FirewallConfig {
  globalOptions: GlobalOptions;
  groups: FirewallGroups;
  rulesets: FirewallRuleset[];
  zones: ZoneEntry[];
}

export interface VyosConfig {
  firewall: FirewallConfig;
}

// -- Main entry point --

/**
 * Parse VyOS firewall config from the JSON API response.
 * `data` is the `data` field from the API response (the firewall object).
 */
export function parseFirewallFromJSON(data: Record<string, unknown>): FirewallConfig {
  return {
    globalOptions: parseGlobalOptionsJSON(data["global-options"] as Record<string, string> | undefined),
    groups: parseGroupsJSON(data["group"] as Record<string, unknown> | undefined),
    rulesets: parseRulesetsJSON(data["ipv4"] as Record<string, unknown> | undefined),
    zones: parseZonesJSON(data["zone"] as Record<string, unknown> | undefined),
  };
}

// -- Global options --

function parseGlobalOptionsJSON(opts: Record<string, string> | undefined): GlobalOptions {
  if (!opts) return {};
  const result: GlobalOptions = {};
  for (const [key, value] of Object.entries(opts)) {
    const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

// -- Groups --

function parseGroupsJSON(group: Record<string, unknown> | undefined): FirewallGroups {
  const addressGroups: AddressGroup[] = [];
  const portGroups: PortGroup[] = [];

  if (!group) return { addressGroups, portGroups };

  // Address groups
  const ag = group["address-group"] as Record<string, Record<string, unknown>> | undefined;
  if (ag) {
    for (const [name, data] of Object.entries(ag)) {
      const addresses = toArray(data.address);
      addressGroups.push({
        name,
        addresses,
        description: data.description as string | undefined,
      });
    }
  }

  // Port groups
  const pg = group["port-group"] as Record<string, Record<string, unknown>> | undefined;
  if (pg) {
    for (const [name, data] of Object.entries(pg)) {
      const ports = toArray(data.port);
      portGroups.push({
        name,
        ports,
        description: data.description as string | undefined,
      });
    }
  }

  return { addressGroups, portGroups };
}

// -- Rulesets --

function parseRulesetsJSON(ipv4: Record<string, unknown> | undefined): FirewallRuleset[] {
  if (!ipv4) return [];

  const nameObj = ipv4["name"] as Record<string, Record<string, unknown>> | undefined;
  if (!nameObj) return [];

  const rulesets: FirewallRuleset[] = [];

  for (const [rsName, rsData] of Object.entries(nameObj)) {
    const ruleset: FirewallRuleset = {
      name: rsName,
      defaultAction: (rsData["default-action"] as string as FirewallRuleset["defaultAction"]) || "drop",
      description: rsData.description as string | undefined,
      rules: [],
    };

    const rulesObj = rsData.rule as Record<string, Record<string, unknown>> | undefined;
    if (rulesObj) {
      for (const [numStr, ruleData] of Object.entries(rulesObj)) {
        ruleset.rules.push(parseRuleJSON(parseInt(numStr, 10), ruleData));
      }
      ruleset.rules.sort((a, b) => a.number - b.number);
    }

    rulesets.push(ruleset);
  }

  return rulesets;
}

function parseRuleJSON(number: number, data: Record<string, unknown>): FirewallRule {
  const rule: FirewallRule = {
    number,
    action: (data.action as FirewallRule["action"]) || "drop",
  };

  if (data.description) rule.description = data.description as string;
  if (data.protocol) rule.protocol = data.protocol as string;
  if (data.state) rule.state = toArray(data.state);
  if (data.log) rule.log = data.log === "enable";

  // Source
  const src = data.source as Record<string, unknown> | undefined;
  if (src) {
    rule.source = parseEndpointJSON(src);
  }

  // Destination
  const dst = data.destination as Record<string, unknown> | undefined;
  if (dst) {
    rule.destination = parseEndpointJSON(dst);
  }

  // TCP flags
  const tcp = data.tcp as Record<string, unknown> | undefined;
  if (tcp?.flags) {
    const flags = tcp.flags as Record<string, unknown>;
    rule.tcp = { flags: Object.keys(flags).join(", ") };
  }

  return rule;
}

function parseEndpointJSON(ep: Record<string, unknown>): FirewallRule["source"] {
  const result: NonNullable<FirewallRule["source"]> = {};

  if (ep.address) result.address = ep.address as string;
  if (ep.port) result.port = ep.port as string;

  const group = ep.group as Record<string, unknown> | undefined;
  if (group) {
    result.group = {};
    if (group["address-group"]) result.group.addressGroup = group["address-group"] as string;
    if (group["port-group"]) result.group.portGroup = group["port-group"] as string;
  }

  return result;
}

// -- Zones --

function parseZonesJSON(zones: Record<string, unknown> | undefined): ZoneEntry[] {
  if (!zones) return [];

  const result: ZoneEntry[] = [];

  for (const [zoneName, zoneData] of Object.entries(zones)) {
    const data = zoneData as Record<string, unknown>;
    const entry: ZoneEntry = {
      name: zoneName,
      from: {},
    };

    if (data.interface) entry.interface = data.interface as string;
    if (data["local-zone"] !== undefined) entry.localZone = true;

    const from = data.from as Record<string, Record<string, Record<string, unknown>>> | undefined;
    if (from) {
      for (const [fromZone, fwObj] of Object.entries(from)) {
        const fwName = fwObj?.firewall?.name as string | undefined;
        if (fwName) {
          entry.from[fromZone] = fwName;
        }
      }
    }

    result.push(entry);
  }

  return result;
}

// -- Text parser (fallback for SSH / older versions) --

export function parseFirewallFromText(raw: string): FirewallConfig {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("set firewall "));

  return {
    globalOptions: parseGlobalOptionsText(lines),
    groups: parseGroupsText(lines),
    rulesets: parseRulesetsText(lines),
    zones: parseZonesText(lines),
  };
}

function parseGlobalOptionsText(lines: string[]): GlobalOptions {
  const opts: GlobalOptions = {};
  const prefix = "set firewall global-options ";
  for (const line of lines) {
    if (!line.startsWith(prefix)) continue;
    const parts = line.slice(prefix.length).split(/\s+/);
    if (parts.length >= 2) {
      const key = parts[0].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      opts[key] = stripQuotes(parts.slice(1).join(" "));
    }
  }
  return opts;
}

function parseGroupsText(lines: string[]): FirewallGroups {
  const addressGroups: Map<string, AddressGroup> = new Map();
  const portGroups: Map<string, PortGroup> = new Map();

  for (const line of lines) {
    const addrMatch = line.match(/^set firewall group address-group (\S+) (.+)$/);
    if (addrMatch) {
      const [, name, rest] = addrMatch;
      if (!addressGroups.has(name)) addressGroups.set(name, { name, addresses: [] });
      const group = addressGroups.get(name)!;
      if (rest.startsWith("address ")) group.addresses.push(stripQuotes(rest.slice(8)));
      else if (rest.startsWith("description ")) group.description = stripQuotes(rest.slice(12));
    }

    const portMatch = line.match(/^set firewall group port-group (\S+) (.+)$/);
    if (portMatch) {
      const [, name, rest] = portMatch;
      if (!portGroups.has(name)) portGroups.set(name, { name, ports: [] });
      const group = portGroups.get(name)!;
      if (rest.startsWith("port ")) group.ports.push(stripQuotes(rest.slice(5)));
      else if (rest.startsWith("description ")) group.description = stripQuotes(rest.slice(12));
    }
  }

  return {
    addressGroups: Array.from(addressGroups.values()),
    portGroups: Array.from(portGroups.values()),
  };
}

function parseRulesetsText(lines: string[]): FirewallRuleset[] {
  const rulesets: Map<string, FirewallRuleset> = new Map();

  for (const line of lines) {
    const match = line.match(/^set firewall ipv4 name (\S+) (.+)$/);
    if (!match) continue;
    const [, rsName, rest] = match;

    if (!rulesets.has(rsName)) {
      rulesets.set(rsName, { name: rsName, defaultAction: "drop", rules: [] });
    }
    const rs = rulesets.get(rsName)!;

    if (rest.startsWith("default-action ")) {
      rs.defaultAction = stripQuotes(rest.slice(15)) as FirewallRuleset["defaultAction"];
    } else if (rest.startsWith("description ")) {
      rs.description = stripQuotes(rest.slice(12));
    } else {
      const ruleMatch = rest.match(/^rule (\d+) (.+)$/);
      if (ruleMatch) {
        const num = parseInt(ruleMatch[1], 10);
        let rule = rs.rules.find((r) => r.number === num);
        if (!rule) { rule = { number: num, action: "drop" }; rs.rules.push(rule); }
        parseRulePropertyText(rule, ruleMatch[2]);
      }
    }
  }

  for (const rs of rulesets.values()) rs.rules.sort((a, b) => a.number - b.number);
  return Array.from(rulesets.values());
}

function parseRulePropertyText(rule: FirewallRule, prop: string) {
  if (prop.startsWith("action ")) rule.action = stripQuotes(prop.slice(7)) as FirewallRule["action"];
  else if (prop.startsWith("description ")) rule.description = stripQuotes(prop.slice(12));
  else if (prop.startsWith("protocol ")) rule.protocol = stripQuotes(prop.slice(9));
  else if (prop.startsWith("state ")) { if (!rule.state) rule.state = []; rule.state.push(stripQuotes(prop.slice(6))); }
  else if (prop.startsWith("source ")) { if (!rule.source) rule.source = {}; parseEndpointText(rule.source, prop.slice(7)); }
  else if (prop.startsWith("destination ")) { if (!rule.destination) rule.destination = {}; parseEndpointText(rule.destination, prop.slice(12)); }
  else if (prop.startsWith("tcp flags")) { if (!rule.tcp) rule.tcp = {}; rule.tcp.flags = stripQuotes(prop.slice(10)); }
}

function parseEndpointText(ep: NonNullable<FirewallRule["source"]>, prop: string) {
  if (prop.startsWith("address ")) ep.address = stripQuotes(prop.slice(8));
  else if (prop.startsWith("port ")) ep.port = stripQuotes(prop.slice(5));
  else if (prop.startsWith("group address-group ")) { if (!ep.group) ep.group = {}; ep.group.addressGroup = stripQuotes(prop.slice(20)); }
  else if (prop.startsWith("group port-group ")) { if (!ep.group) ep.group = {}; ep.group.portGroup = stripQuotes(prop.slice(17)); }
}

function parseZonesText(lines: string[]): ZoneEntry[] {
  const zones: Map<string, ZoneEntry> = new Map();
  for (const line of lines) {
    const match = line.match(/^set firewall zone (\S+) (.+)$/);
    if (!match) continue;
    const [, zoneName, rest] = match;
    if (!zones.has(zoneName)) zones.set(zoneName, { name: zoneName, from: {} });
    const zone = zones.get(zoneName)!;
    if (rest === "local-zone") zone.localZone = true;
    else if (rest.startsWith("interface ")) zone.interface = stripQuotes(rest.slice(10));
    else {
      const fromMatch = rest.match(/^from (\S+) firewall name '?(\S+?)'?$/);
      if (fromMatch) zone.from[fromMatch[1]] = fromMatch[2];
    }
  }
  return Array.from(zones.values());
}

// -- Helpers --

function stripQuotes(s: string): string {
  return s.replace(/^'|'$/g, "").trim();
}

function toArray(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") return [val];
  if (typeof val === "number") return [String(val)];
  return [];
}
