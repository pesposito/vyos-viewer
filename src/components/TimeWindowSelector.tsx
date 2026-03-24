"use client";

export type TimeWindow = "5m" | "10m" | "30m" | "1h" | "all";

interface Props {
  value: TimeWindow;
  onChange: (value: TimeWindow) => void;
}

const options: { value: TimeWindow; label: string }[] = [
  { value: "5m", label: "5 min" },
  { value: "10m", label: "10 min" },
  { value: "30m", label: "30 min" },
  { value: "1h", label: "1 heure" },
  { value: "all", label: "Tout" },
];

export function timeWindowToMinutes(tw: TimeWindow): number | null {
  switch (tw) {
    case "5m": return 5;
    case "10m": return 10;
    case "30m": return 30;
    case "1h": return 60;
    case "all": return null;
  }
}

export default function TimeWindowSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-0.5 bg-[var(--bg-primary)] rounded-lg p-0.5 border border-[var(--border)]">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
            value === opt.value
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
