// ============================================================
// VyOS OpenVPN parser
// Parses config from interfaces.openvpn and live status from /show
// ============================================================

export interface OpenVPNClient {
  commonName: string;
  remoteHost: string;
  tunnelIp: string;
  localHost: string;
  txBytes: string;
  rxBytes: string;
  connectedSince: string;
}

export interface OpenVPNServerConfig {
  name: string;
  mode: string;
  protocol: string;
  localPort: string;
  subnet: string;
  clientPool?: { start: string; stop: string; subnetMask: string };
  domainName?: string;
  maxConnections?: string;
  nameServer?: string;
  pushRoutes: string[];
  topology?: string;
  tls: {
    caCertificate?: string;
    certificate?: string;
    dhParams?: string;
  };
}

export interface OpenVPNStatus {
  serverConfig: OpenVPNServerConfig | null;
  clients: OpenVPNClient[];
  interfaceStats?: {
    ip: string;
    mtu: number;
    state: string;
    rxBytes: string;
    rxPackets: string;
    txBytes: string;
    txPackets: string;
  };
}

/**
 * Parse OpenVPN config from the interfaces API response (the openvpn section).
 */
export function parseOpenVPNConfig(
  ifData: Record<string, unknown>
): OpenVPNServerConfig | null {
  const openvpn = ifData.openvpn as Record<string, Record<string, unknown>> | undefined;
  if (!openvpn) return null;

  // Take the first (usually only) OpenVPN interface
  const [name, data] = Object.entries(openvpn)[0];
  if (!data) return null;

  const server = data.server as Record<string, unknown> | undefined;
  const tls = data.tls as Record<string, unknown> | undefined;

  const config: OpenVPNServerConfig = {
    name,
    mode: (data.mode as string) || "unknown",
    protocol: (data.protocol as string) || "udp",
    localPort: (data["local-port"] as string) || "1194",
    subnet: "",
    pushRoutes: [],
    tls: {},
  };

  if (server) {
    config.subnet = (server.subnet as string) || "";
    config.domainName = server["domain-name"] as string | undefined;
    config.maxConnections = server["max-connections"] as string | undefined;
    config.nameServer = server["name-server"] as string | undefined;
    config.topology = server.topology as string | undefined;

    const pool = server["client-ip-pool"] as Record<string, unknown> | undefined;
    if (pool) {
      config.clientPool = {
        start: (pool.start as string) || "",
        stop: (pool.stop as string) || "",
        subnetMask: (pool["subnet-mask"] as string) || "",
      };
    }

    const routes = server["push-route"] as Record<string, unknown> | undefined;
    if (routes) {
      config.pushRoutes = Object.keys(routes);
    }
  }

  if (tls) {
    config.tls = {
      caCertificate: tls["ca-certificate"] as string | undefined,
      certificate: tls.certificate as string | undefined,
      dhParams: tls["dh-params"] as string | undefined,
    };
  }

  return config;
}

/**
 * Parse the live client table from `show openvpn server`.
 */
export function parseOpenVPNClients(raw: string): OpenVPNClient[] {
  const clients: OpenVPNClient[] = [];
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  // Find the header line
  const headerIdx = lines.findIndex((l) => l.startsWith("Client CN"));
  if (headerIdx === -1) return clients;

  // Skip header and separator
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.startsWith("-")) continue;

    // Split by 2+ spaces (columns are space-separated)
    const cols = line.split(/\s{2,}/);
    if (cols.length < 7) continue;

    clients.push({
      commonName: cols[0],
      remoteHost: cols[1],
      tunnelIp: cols[2],
      localHost: cols[3],
      txBytes: cols[4],
      rxBytes: cols[5],
      connectedSince: cols[6],
    });
  }

  return clients;
}

/**
 * Parse interface detail stats from `show interfaces openvpn detail`.
 */
export function parseOpenVPNInterfaceStats(raw: string): OpenVPNStatus["interfaceStats"] | undefined {
  // Parse IP
  const ipMatch = raw.match(/inet (\S+)/);
  const mtuMatch = raw.match(/mtu (\d+)/);
  const stateMatch = raw.match(/state (\S+)/);

  // Parse RX/TX lines
  const rxMatch = raw.match(/RX:\s+bytes\s+packets[\s\S]*?\n\s+([\d]+)\s+([\d]+)/);
  const txMatch = raw.match(/TX:\s+bytes\s+packets[\s\S]*?\n\s+([\d]+)\s+([\d]+)/);

  if (!ipMatch) return undefined;

  return {
    ip: ipMatch[1],
    mtu: mtuMatch ? parseInt(mtuMatch[1], 10) : 1500,
    state: stateMatch ? stateMatch[1] : "UNKNOWN",
    rxBytes: rxMatch ? formatBytes(parseInt(rxMatch[1], 10)) : "0",
    rxPackets: rxMatch ? rxMatch[2] : "0",
    txBytes: txMatch ? formatBytes(parseInt(txMatch[1], 10)) : "0",
    txPackets: txMatch ? txMatch[2] : "0",
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
