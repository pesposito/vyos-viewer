"use client";

import { useState, useCallback, useEffect } from "react";
import {
  OpenVPNServerConfig,
  OpenVPNClient,
  OpenVPNStatus,
} from "@/lib/openvpn-parser";

interface Props {
  serverConfig: OpenVPNServerConfig | null;
  clients: OpenVPNClient[];
  interfaceStats?: OpenVPNStatus["interfaceStats"];
  onRefreshClients: () => Promise<void>;
}

export default function OpenVPNView({
  serverConfig,
  clients,
  interfaceStats,
  onRefreshClients,
}: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefreshClients();
    setRefreshing(false);
  }, [onRefreshClients]);

  // Auto-refresh every 10s
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(handleRefresh, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, handleRefresh]);

  return (
    <div className="space-y-4">
      {/* Server config */}
      {serverConfig && <ServerConfigCard config={serverConfig} />}

      {/* Interface stats */}
      {interfaceStats && <InterfaceStatsCard stats={interfaceStats} />}

      {/* Connected clients */}
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
              Clients connectés ({clients.length})
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Données temps réel depuis le serveur OpenVPN
            </p>
          </div>
          <div className="flex items-center gap-2">
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

        {clients.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-sm text-center py-4">
            Aucun client connecté.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-secondary)] text-xs uppercase">
                  <th className="p-2">Client</th>
                  <th className="p-2">IP réelle</th>
                  <th className="p-2">IP tunnel</th>
                  <th className="p-2">TX</th>
                  <th className="p-2">RX</th>
                  <th className="p-2">Connecté depuis</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr
                    key={client.commonName}
                    className="border-t border-[var(--border)]"
                  >
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                        <span className="font-medium">{client.commonName}</span>
                      </div>
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {client.remoteHost}
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {client.tunnelIp}
                    </td>
                    <td className="p-2 font-mono text-xs">{client.txBytes}</td>
                    <td className="p-2 font-mono text-xs">{client.rxBytes}</td>
                    <td className="p-2 text-xs text-[var(--text-secondary)]">
                      {client.connectedSince}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ServerConfigCard({ config }: { config: OpenVPNServerConfig }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
        Serveur OpenVPN — {config.name}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <InfoBlock label="Connexion">
          <Row label="Mode" value={config.mode} />
          <Row label="Protocole" value={config.protocol.toUpperCase()} />
          <Row label="Port" value={config.localPort} />
          {config.topology && <Row label="Topologie" value={config.topology} />}
          {config.maxConnections && (
            <Row label="Max clients" value={config.maxConnections} />
          )}
        </InfoBlock>

        <InfoBlock label="Réseau">
          <Row label="Subnet" value={config.subnet} />
          {config.clientPool && (
            <>
              <Row
                label="Pool"
                value={`${config.clientPool.start} → ${config.clientPool.stop}`}
              />
              <Row label="Masque" value={config.clientPool.subnetMask} />
            </>
          )}
          {config.nameServer && (
            <Row label="DNS" value={config.nameServer} />
          )}
          {config.domainName && (
            <Row label="Domaine" value={config.domainName} />
          )}
        </InfoBlock>

        <InfoBlock label="Routes poussées">
          {config.pushRoutes.length > 0 ? (
            config.pushRoutes.map((r) => (
              <div key={r} className="font-mono text-sm">
                {r}
              </div>
            ))
          ) : (
            <span className="text-[var(--text-secondary)] text-sm">
              Aucune
            </span>
          )}
        </InfoBlock>

        <InfoBlock label="TLS / Certificats">
          {config.tls.caCertificate && (
            <Row label="CA" value={config.tls.caCertificate} />
          )}
          {config.tls.certificate && (
            <Row label="Certificat" value={config.tls.certificate} />
          )}
          {config.tls.dhParams && (
            <Row label="DH" value={config.tls.dhParams} />
          )}
        </InfoBlock>
      </div>
    </div>
  );
}

function InterfaceStatsCard({
  stats,
}: {
  stats: NonNullable<OpenVPNStatus["interfaceStats"]>;
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
        Interface vtun
      </h3>
      <div className="flex flex-wrap gap-4 text-sm">
        <Tag label="IP" value={stats.ip} />
        <Tag label="MTU" value={String(stats.mtu)} />
        <Tag
          label="État"
          value={stats.state}
          className={
            stats.state === "UNKNOWN" || stats.state === "UP"
              ? "text-[var(--success)]"
              : "text-[var(--danger)]"
          }
        />
        <Tag label="RX" value={`${stats.rxBytes} (${stats.rxPackets} pkt)`} />
        <Tag label="TX" value={`${stats.txBytes} (${stats.txPackets} pkt)`} />
      </div>
    </div>
  );
}

function InfoBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--bg-primary)] rounded-lg p-2.5 border border-[var(--border)]">
      <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-[var(--text-secondary)]">{label}:</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Tag({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <span className="text-[var(--text-secondary)]">
      <span className="opacity-60">{label}:</span>{" "}
      <span className={`font-mono text-[var(--text-primary)] ${className || ""}`}>
        {value}
      </span>
    </span>
  );
}
