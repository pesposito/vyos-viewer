"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const RECENT_HOSTS_KEY = "vyos_recent_hosts";
const MAX_RECENT_HOSTS = 5;

export default function LoginPage() {
  const router = useRouter();
  const [host, setHost] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [recentHosts, setRecentHosts] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedRecent = localStorage.getItem(RECENT_HOSTS_KEY);
    const parsedRecent = storedRecent ? JSON.parse(storedRecent) : [];
    if (Array.isArray(parsedRecent)) {
      setRecentHosts(parsedRecent);
      const sessionHost = sessionStorage.getItem("vyos_host");
      if (sessionHost) {
        setHost(sessionHost);
      } else if (parsedRecent.length > 0) {
        setHost(parsedRecent[0]);
      }
    }
  }, []);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/vyos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          apiKey,
          op: "showConfig",
          path: ["firewall"],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Connexion échouée");
      }

      const nextRecentHosts = [host, ...recentHosts.filter((item) => item !== host)].slice(0, MAX_RECENT_HOSTS);
      localStorage.setItem(RECENT_HOSTS_KEY, JSON.stringify(nextRecentHosts));
      setRecentHosts(nextRecentHosts);

      sessionStorage.setItem("vyos_host", host);
      sessionStorage.setItem("vyos_key", apiKey);

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">VyOS Viewer</h1>
          <p className="text-[var(--text-secondary)]">
            Connectez-vous à votre routeur VyOS
          </p>
        </div>

        <form
          onSubmit={handleConnect}
          className="bg-[var(--bg-card)] rounded-xl p-6 space-y-4 border border-[var(--border)]"
        >
          <div>
            <label className="block text-sm font-medium mb-1">
              Adresse IP / Hostname
            </label>
            <input
              list="recent-hosts"
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.1"
              required
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--text-primary)]"
            />
            {recentHosts.length > 0 && (
              <datalist id="recent-hosts">
                {recentHosts.map((recentHost) => (
                  <option key={recentHost} value={recentHost} />
                ))}
              </datalist>
            )}
            {recentHosts.length > 0 && (
              <div className="mt-3 text-sm text-[var(--text-secondary)]">
                <div className="font-medium mb-2">Connexions récentes :</div>
                <div className="flex flex-wrap gap-2">
                  {recentHosts.map((recentHost) => (
                    <button
                      key={recentHost}
                      type="button"
                      onClick={() => setHost(recentHost)}
                      className="px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--bg-primary)] hover:bg-[var(--bg-card)] text-[var(--text-primary)] transition"
                    >
                      {recentHost}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Clé API</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Votre clé API VyOS"
              required
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--text-primary)]"
            />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 rounded-lg font-medium transition-colors cursor-pointer"
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
