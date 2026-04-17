import { NextRequest, NextResponse } from "next/server";
import https from "https";

const agent = new https.Agent({ rejectUnauthorized: false });

async function vyosFetch(
  url: string,
  body: Record<string, unknown>
): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);

    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname,
        method: "POST",
        agent,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        timeout: 30000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode || 500, data })
        );
      }
    );

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Timeout de connexion à VyOS"));
    });

    req.write(payload);
    req.end();
  });
}

export async function POST(request: NextRequest) {
  try {
    const { host, apiKey, path } = await request.json();

    if (!host || !apiKey) {
      return NextResponse.json(
        { error: "Host et clé API requis" },
        { status: 400 }
      );
    }

    // The /show endpoint on VyOS
    const url = `https://${host}/show`;

    const body = {
      op: "show",
      key: apiKey,
      path: path || [],
    };

    const result = await vyosFetch(url, body);

    if (result.status !== 200) {
      return NextResponse.json(
        { error: `VyOS API error (${result.status}): ${result.data}` },
        { status: result.status }
      );
    }

    let data;
    try {
      data = JSON.parse(result.data);
    } catch {
      data = { data: result.data };
    }

    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erreur de connexion à VyOS";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
