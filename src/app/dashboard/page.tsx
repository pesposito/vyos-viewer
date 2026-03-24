"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseFirewallFromJSON, FirewallConfig } from "@/lib/vyos-parser";
import { parseInterfacesFromJSON, InterfacesConfig } from "@/lib/interfaces-parser";
import { parseNatFromJSON, NatConfig } from "@/lib/nat-parser";
import {
  parseOpenVPNConfig,
  parseOpenVPNClients,
  parseOpenVPNInterfaceStats,
  OpenVPNServerConfig,
  OpenVPNClient,
  OpenVPNStatus,
} from "@/lib/openvpn-parser";
import GlobalOptions from "@/components/GlobalOptions";
import FirewallGroups from "@/components/FirewallGroups";
import ZoneMatrix from "@/components/ZoneMatrix";
import RulesetDetail from "@/components/RulesetDetail";
import InterfacesView from "@/components/InterfacesView";
import NatView from "@/components/NatView";
import OpenVPNView from "@/components/OpenVPNView";
import FirewallStatsView from "@/components/FirewallStatsView";
import DropLogsView from "@/components/DropLogsView";
import { parseFirewallStats, FirewallStats } from "@/lib/firewall-stats-parser";
import { parseFirewallLogs, DropLogStats } from "@/lib/firewall-logs-parser";

type Tab = "firewall" | "interfaces" | "nat" | "openvpn" | "stats" | "drops";

async function fetchVyos(host: string, apiKey: string, path: string[]) {
  const res = await fetch("/api/vyos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host, apiKey, op: "showConfig", path }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Erreur API");
  }
  const json = await res.json();
  return json.data || json;
}

async function fetchVyosShow(host: string, apiKey: string, path: string[]) {
  const res = await fetch("/api/vyos/show", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host, apiKey, path }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Erreur API");
  }
  const json = await res.json();
  return json.data || "";
}

export default function DashboardPage() {
  const router = useRouter();
  const [firewall, setFirewall] = useState<FirewallConfig | null>(null);
  const [interfaces, setInterfaces] = useState<InterfacesConfig | null>(null);
  const [nat, setNat] = useState<NatConfig | null>(null);
  const [vpnConfig, setVpnConfig] = useState<OpenVPNServerConfig | null>(null);
  const [vpnClients, setVpnClients] = useState<OpenVPNClient[]>([]);
  const [vpnIfStats, setVpnIfStats] = useState<OpenVPNStatus["interfaceStats"]>();
  const [fwStats, setFwStats] = useState<FirewallStats | null>(null);
  const [dropLogs, setDropLogs] = useState<DropLogStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("interfaces");
  const [selectedRuleset, setSelectedRuleset] = useState<string | null>(null);
  const [host, setHost] = useState("");

  const getCredentials = useCallback(() => {
    const h = sessionStorage.getItem("vyos_host");
    const apiKey = sessionStorage.getItem("vyos_key");
    return { h, apiKey };
  }, []);

  const refreshVpnClients = useCallback(async () => {
    const { h, apiKey } = getCredentials();
    if (!h || !apiKey) return;

    const [clientsRaw, ifRaw] = await Promise.all([
      fetchVyosShow(h, apiKey, ["openvpn", "server"]),
      fetchVyosShow(h, apiKey, ["interfaces", "openvpn", "detail"]),
    ]);

    setVpnClients(parseOpenVPNClients(clientsRaw));
    setVpnIfStats(parseOpenVPNInterfaceStats(ifRaw));
  }, [getCredentials]);

  const refreshFwStats = useCallback(async () => {
    const { h, apiKey } = getCredentials();
    if (!h || !apiKey) return;

    const raw = await fetchVyosShow(h, apiKey, ["firewall"]);
    setFwStats(parseFirewallStats(raw));
  }, [getCredentials]);

  const refreshDropLogs = useCallback(async () => {
    const { h, apiKey } = getCredentials();
    if (!h || !apiKey) return;

    const raw = await fetchVyosShow(h, apiKey, ["log", "kernel"]);
    setDropLogs(parseFirewallLogs(raw));
  }, [getCredentials]);

  const fetchConfig = useCallback(async () => {
    const { h, apiKey } = getCredentials();

    if (!h || !apiKey) {
      router.push("/");
      return;
    }

    setHost(h);
    setLoading(true);
    setError("");

    try {
      const [fwData, ifData, natData, clientsRaw, ifStatsRaw, fwStatsRaw, kernelLogsRaw] = await Promise.all([
        fetchVyos(h, apiKey, ["firewall"]),
        fetchVyos(h, apiKey, ["interfaces"]),
        fetchVyos(h, apiKey, ["nat"]),
        fetchVyosShow(h, apiKey, ["openvpn", "server"]),
        fetchVyosShow(h, apiKey, ["interfaces", "openvpn", "detail"]),
        fetchVyosShow(h, apiKey, ["firewall"]),
        fetchVyosShow(h, apiKey, ["log", "kernel"]),
      ]);

      setFirewall(parseFirewallFromJSON(fwData));
      setInterfaces(parseInterfacesFromJSON(ifData));
      setNat(parseNatFromJSON(natData));
      setVpnConfig(parseOpenVPNConfig(ifData));
      setVpnClients(parseOpenVPNClients(clientsRaw));
      setVpnIfStats(parseOpenVPNInterfaceStats(ifStatsRaw));
      setFwStats(parseFirewallStats(fwStatsRaw));
      setDropLogs(parseFirewallLogs(kernelLogsRaw));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, [router, getCredentials]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  function handleDisconnect() {
    sessionStorage.removeItem("vyos_host");
    sessionStorage.removeItem("vyos_key");
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]">
            Chargement de la configuration...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-red-900/20 border border-red-700 rounded-xl p-6 max-w-lg text-center">
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-[var(--accent)] rounded-lg hover:bg-[var(--accent-hover)] transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  // Build zone map: interface name -> zone name
  const zoneMap: Record<string, string> = {};
  if (firewall) {
    for (const zone of firewall.zones) {
      if (zone.interface) {
        zoneMap[zone.interface] = zone.name;
      }
    }
  }

  const selectedRs =
    firewall && selectedRuleset
      ? firewall.rulesets.find((rs) => rs.name === selectedRuleset)
      : null;

  const tabs: { id: Tab; label: string }[] = [
    { id: "interfaces", label: "Interfaces" },
    { id: "nat", label: "NAT" },
    { id: "openvpn", label: "OpenVPN" },
    { id: "firewall", label: "Firewall" },
    { id: "stats", label: "Stats Firewall" },
    { id: "drops", label: "Drops" },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-[var(--bg-secondary)] border-b border-[var(--border)] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold">VyOS Viewer</h1>
          <span className="text-sm text-[var(--text-secondary)] font-mono">
            {host}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchConfig}
            className="px-3 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
          >
            Rafraîchir
          </button>
          <button
            onClick={handleDisconnect}
            className="px-3 py-1.5 text-sm text-red-400 border border-red-800 rounded-lg hover:bg-red-900/20 transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-[var(--bg-secondary)] border-b border-[var(--border)] px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="p-6 max-w-7xl mx-auto space-y-4">
        {activeTab === "firewall" && firewall && (
          <>
            <GlobalOptions options={firewall.globalOptions} />
            <FirewallGroups groups={firewall.groups} />
            <ZoneMatrix
              zones={firewall.zones}
              rulesets={firewall.rulesets}
              onSelectRuleset={setSelectedRuleset}
              selectedRuleset={selectedRuleset}
            />
            {selectedRs && (
              <RulesetDetail ruleset={selectedRs} groups={firewall.groups} />
            )}

            {!selectedRuleset && (
              <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                  Tous les rulesets ({firewall.rulesets.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {firewall.rulesets.map((rs) => (
                    <button
                      key={rs.name}
                      onClick={() => setSelectedRuleset(rs.name)}
                      className="text-left p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm">{rs.name}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded action-${rs.defaultAction}`}
                        >
                          {rs.defaultAction}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-secondary)] mt-1">
                        {rs.rules.length} rule{rs.rules.length > 1 ? "s" : ""}
                        {rs.description && ` — ${rs.description}`}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "interfaces" && interfaces && (
          <InterfacesView config={interfaces} zoneMap={zoneMap} />
        )}

        {activeTab === "nat" && nat && (
          <NatView config={nat} />
        )}

        {activeTab === "stats" && fwStats && firewall && (
          <FirewallStatsView
            stats={fwStats}
            zones={firewall.zones}
            onRefresh={refreshFwStats}
          />
        )}

        {activeTab === "drops" && dropLogs && (
          <DropLogsView stats={dropLogs} zones={firewall?.zones || []} onRefresh={refreshDropLogs} />
        )}

        {activeTab === "openvpn" && (
          <OpenVPNView
            serverConfig={vpnConfig}
            clients={vpnClients}
            interfaceStats={vpnIfStats}
            onRefreshClients={refreshVpnClients}
          />
        )}
      </main>
    </div>
  );
}
