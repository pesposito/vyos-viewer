// ============================================================
// VyOS NAT JSON parser
// Parses the API response from path: ["nat"]
// ============================================================

export interface NatRule {
  number: number;
  description?: string;
  protocol?: string;
  source?: {
    address?: string;
    port?: string;
  };
  destination?: {
    address?: string;
    port?: string;
  };
  translation: {
    address?: string;
    port?: string;
  };
  inboundInterface?: string;
  outboundInterface?: string;
}

export interface NatConfig {
  sourceRules: NatRule[];
  destinationRules: NatRule[];
}

export function parseNatFromJSON(data: Record<string, unknown>): NatConfig {
  return {
    sourceRules: parseNatRules(data.source as Record<string, unknown> | undefined),
    destinationRules: parseNatRules(data.destination as Record<string, unknown> | undefined),
  };
}

function parseNatRules(section: Record<string, unknown> | undefined): NatRule[] {
  if (!section) return [];

  const rulesObj = section.rule as Record<string, Record<string, unknown>> | undefined;
  if (!rulesObj) return [];

  const rules: NatRule[] = [];

  for (const [numStr, ruleData] of Object.entries(rulesObj)) {
    const rule: NatRule = {
      number: parseInt(numStr, 10),
      description: ruleData.description as string | undefined,
      protocol: ruleData.protocol as string | undefined,
      translation: {},
    };

    const src = ruleData.source as Record<string, unknown> | undefined;
    if (src) {
      rule.source = {
        address: src.address as string | undefined,
        port: src.port as string | undefined,
      };
    }

    const dst = ruleData.destination as Record<string, unknown> | undefined;
    if (dst) {
      rule.destination = {
        address: dst.address as string | undefined,
        port: dst.port as string | undefined,
      };
    }

    const tr = ruleData.translation as Record<string, unknown> | undefined;
    if (tr) {
      rule.translation = {
        address: tr.address as string | undefined,
        port: tr.port as string | undefined,
      };
    }

    const inIf = ruleData["inbound-interface"] as Record<string, unknown> | undefined;
    if (inIf?.name) rule.inboundInterface = inIf.name as string;

    const outIf = ruleData["outbound-interface"] as Record<string, unknown> | undefined;
    if (outIf?.name) rule.outboundInterface = outIf.name as string;

    rules.push(rule);
  }

  rules.sort((a, b) => a.number - b.number);
  return rules;
}
