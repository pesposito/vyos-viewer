// ============================================================
// VyOS interfaces JSON parser
// Parses the API response from path: ["interfaces"]
// ============================================================

export interface InterfaceAddress {
  address: string;
  type: "static" | "dhcp" | "other";
}

export interface VlanConfig {
  id: number;
  description?: string;
  addresses: InterfaceAddress[];
}

export interface InterfaceConfig {
  name: string;
  type: string; // ethernet, loopback, openvpn, wireguard, etc.
  description?: string;
  addresses: InterfaceAddress[];
  hwId?: string;
  enabled: boolean;
  mtu?: number;
  vlans: VlanConfig[];
  offload?: Record<string, string>;
  duplex?: string;
  speed?: string;
  // OpenVPN specific
  mode?: string;
  protocol?: string;
  localPort?: string;
  remoteHost?: string;
  localAddress?: string;
  remoteAddress?: string;
  // Raw data for anything not explicitly parsed
  extra: Record<string, unknown>;
}

export interface InterfacesConfig {
  interfaces: InterfaceConfig[];
}

export function parseInterfacesFromJSON(
  data: Record<string, unknown>
): InterfacesConfig {
  const interfaces: InterfaceConfig[] = [];

  // Each top-level key is an interface type: ethernet, loopback, openvpn, etc.
  for (const [ifType, ifGroup] of Object.entries(data)) {
    if (typeof ifGroup !== "object" || ifGroup === null) continue;

    const group = ifGroup as Record<string, unknown>;

    // Each key under the type is an interface name (eth0, lo, vtun10, etc.)
    for (const [ifName, ifData] of Object.entries(group)) {
      if (typeof ifData !== "object" || ifData === null) continue;

      const raw = ifData as Record<string, unknown>;
      const iface = parseInterface(ifName, ifType, raw);
      interfaces.push(iface);
    }
  }

  // Sort: ethernet first, then by name
  interfaces.sort((a, b) => {
    const typeOrder = ["ethernet", "loopback", "openvpn", "wireguard"];
    const ai = typeOrder.indexOf(a.type);
    const bi = typeOrder.indexOf(b.type);
    const aOrder = ai === -1 ? 99 : ai;
    const bOrder = bi === -1 ? 99 : bi;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  return { interfaces };
}

function parseInterface(
  name: string,
  type: string,
  raw: Record<string, unknown>
): InterfaceConfig {
  const addresses = parseAddresses(raw.address);
  const extra = { ...raw };

  // Clean up known fields from extra
  const knownKeys = [
    "address", "description", "hw-id", "disable", "mtu",
    "vif", "offload", "duplex", "speed", "mode", "protocol",
    "local-port", "remote-host", "local-address", "remote-address",
  ];
  for (const k of knownKeys) delete extra[k];

  const iface: InterfaceConfig = {
    name,
    type,
    description: raw.description as string | undefined,
    addresses,
    hwId: raw["hw-id"] as string | undefined,
    enabled: raw.disable === undefined,
    mtu: raw.mtu ? Number(raw.mtu) : undefined,
    vlans: [],
    extra,
  };

  // Offload
  if (raw.offload && typeof raw.offload === "object") {
    iface.offload = {};
    for (const [k, v] of Object.entries(raw.offload as Record<string, unknown>)) {
      iface.offload[k] = typeof v === "object" ? "enabled" : String(v);
    }
  }

  // Duplex / speed
  if (raw.duplex) iface.duplex = raw.duplex as string;
  if (raw.speed) iface.speed = raw.speed as string;

  // VLANs (vif)
  if (raw.vif && typeof raw.vif === "object") {
    for (const [vid, vData] of Object.entries(raw.vif as Record<string, unknown>)) {
      if (typeof vData !== "object" || vData === null) continue;
      const vlan = vData as Record<string, unknown>;
      iface.vlans.push({
        id: parseInt(vid, 10),
        description: vlan.description as string | undefined,
        addresses: parseAddresses(vlan.address),
      });
    }
    iface.vlans.sort((a, b) => a.id - b.id);
  }

  // OpenVPN / tunnel
  if (raw.mode) iface.mode = raw.mode as string;
  if (raw.protocol) iface.protocol = raw.protocol as string;
  if (raw["local-port"]) iface.localPort = raw["local-port"] as string;
  if (raw["remote-host"]) iface.remoteHost = raw["remote-host"] as string;
  if (raw["local-address"]) iface.localAddress = raw["local-address"] as string;
  if (raw["remote-address"]) iface.remoteAddress = raw["remote-address"] as string;

  return iface;
}

function parseAddresses(addr: unknown): InterfaceAddress[] {
  if (!addr) return [];

  const items = Array.isArray(addr) ? addr : [addr];
  return items.map((a) => {
    const s = String(a);
    return {
      address: s,
      type: s === "dhcp" ? "dhcp" : s.includes("/") ? "static" : "other",
    };
  });
}
