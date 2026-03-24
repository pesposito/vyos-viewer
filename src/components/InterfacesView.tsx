"use client";

import { InterfacesConfig, InterfaceConfig } from "@/lib/interfaces-parser";

interface Props {
  config: InterfacesConfig;
  zoneMap?: Record<string, string>; // interface name -> zone name
}

export default function InterfacesView({ config, zoneMap }: Props) {
  if (config.interfaces.length === 0) {
    return (
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-8 text-center">
        <p className="text-[var(--text-secondary)]">Aucune interface trouvée</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {config.interfaces.map((iface) => (
        <InterfaceCard
          key={iface.name}
          iface={iface}
          zone={zoneMap?.[iface.name]}
        />
      ))}
    </div>
  );
}

function InterfaceCard({
  iface,
  zone,
}: {
  iface: InterfaceConfig;
  zone?: string;
}) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            iface.enabled ? "bg-[var(--success)]" : "bg-[var(--danger)]"
          }`}
          title={iface.enabled ? "Activée" : "Désactivée"}
        />
        <span className="font-mono font-bold text-lg">{iface.name}</span>
        <span className="text-xs px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded-full">
          {iface.type}
        </span>
        {zone && (
          <span className="text-xs px-2 py-0.5 bg-purple-900/50 text-purple-300 rounded-full">
            zone: {zone}
          </span>
        )}
        {iface.description && (
          <span className="text-sm text-[var(--text-secondary)]">
            — {iface.description}
          </span>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Addresses */}
        {iface.addresses.length > 0 && (
          <InfoBlock label="Adresses">
            {iface.addresses.map((a) => (
              <div key={a.address} className="flex items-center gap-2">
                <span className="font-mono text-sm">{a.address}</span>
                <span className="text-[10px] text-[var(--text-secondary)]">
                  {a.type}
                </span>
              </div>
            ))}
          </InfoBlock>
        )}

        {/* MAC */}
        {iface.hwId && (
          <InfoBlock label="MAC">
            <span className="font-mono text-sm">{iface.hwId}</span>
          </InfoBlock>
        )}

        {/* MTU */}
        {iface.mtu && (
          <InfoBlock label="MTU">
            <span className="font-mono text-sm">{iface.mtu}</span>
          </InfoBlock>
        )}

        {/* Speed / Duplex */}
        {(iface.speed || iface.duplex) && (
          <InfoBlock label="Lien">
            <span className="font-mono text-sm">
              {[iface.speed, iface.duplex].filter(Boolean).join(" / ")}
            </span>
          </InfoBlock>
        )}

        {/* Offload */}
        {iface.offload && Object.keys(iface.offload).length > 0 && (
          <InfoBlock label="Offload">
            {Object.entries(iface.offload).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-sm">
                <span className="text-[var(--text-secondary)]">{k}:</span>
                <span className="text-[var(--success)]">{v}</span>
              </div>
            ))}
          </InfoBlock>
        )}

        {/* OpenVPN specifics */}
        {iface.mode && (
          <InfoBlock label="OpenVPN">
            <div className="space-y-1 text-sm">
              <Row label="mode" value={iface.mode} />
              {iface.protocol && <Row label="proto" value={iface.protocol} />}
              {iface.localPort && (
                <Row label="port local" value={iface.localPort} />
              )}
              {iface.localAddress && (
                <Row label="addr locale" value={iface.localAddress} />
              )}
              {iface.remoteHost && (
                <Row label="remote" value={iface.remoteHost} />
              )}
              {iface.remoteAddress && (
                <Row label="addr remote" value={iface.remoteAddress} />
              )}
            </div>
          </InfoBlock>
        )}
      </div>

      {/* VLANs */}
      {iface.vlans.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
            VLANs ({iface.vlans.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {iface.vlans.map((vlan) => (
              <div
                key={vlan.id}
                className="bg-[var(--bg-primary)] rounded-lg p-2.5 border border-[var(--border)]"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-medium text-sm">
                    {iface.name}.{vlan.id}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 bg-yellow-900/50 text-yellow-300 rounded">
                    vlan {vlan.id}
                  </span>
                </div>
                {vlan.description && (
                  <p className="text-xs text-[var(--text-secondary)] mb-1">
                    {vlan.description}
                  </p>
                )}
                {vlan.addresses.map((a) => (
                  <div
                    key={a.address}
                    className="font-mono text-xs text-[var(--text-secondary)]"
                  >
                    {a.address}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
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
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[var(--text-secondary)]">{label}:</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
