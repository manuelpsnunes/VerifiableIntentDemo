import { useState } from "react";

interface SdJwtData {
  serialized?: string;
  header?: Record<string, any>;
  payload?: Record<string, any>;
  resolved?: Record<string, any>;
  disclosures?: Array<{
    salt: string;
    name: string | null;
    value: any;
    hash: string;
    encoded: string;
  }>;
}

interface Props {
  data: SdJwtData;
  title: string;
  layerColor?: string;
}

function shortHash(h?: string, len = 10): string {
  if (!h) return "—";
  return h.length > len + 3 ? `${h.slice(0, len)}…` : h;
}

function Quadrant({
  title,
  count,
  color,
  children,
}: {
  title: string;
  count?: number;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border bg-[#0b1020] overflow-hidden flex flex-col min-h-0"
      style={{ borderColor: color + "40" }}>
      <div
        className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold flex items-center gap-2 border-b"
        style={{ background: color + "12", color, borderColor: color + "30" }}
      >
        <span>{title}</span>
        {count !== undefined && (
          <span className="font-mono text-[#7b87a8]">({count})</span>
        )}
      </div>
      <div className="p-2 text-[10px] font-mono text-white/85 leading-relaxed overflow-auto flex-1">
        {children}
      </div>
    </div>
  );
}

export function SdJwtXRay({ data, title, layerColor = "#7aa2ff" }: Props) {
  const [highlightedHash, setHighlightedHash] = useState<string | null>(null);

  const header = data.header ?? {};
  const payload = data.payload ?? {};
  const disclosures = data.disclosures ?? [];

  // Pull _sd hashes out of the payload for binding highlights.
  const sdHashes: string[] = Array.isArray(payload._sd) ? payload._sd : [];

  // Visible (non-_sd) payload fields, formatted compactly.
  const visiblePayload: Record<string, any> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === "_sd" || k === "_sd_alg") continue;
    visiblePayload[k] = v;
  }

  return (
    <div className="rounded-lg border bg-[#0e1530] overflow-hidden"
      style={{ borderColor: layerColor + "40" }}>
      <div
        className="px-4 py-2 text-xs uppercase tracking-wider font-semibold border-b flex items-center justify-between"
        style={{ background: layerColor + "12", color: layerColor, borderColor: layerColor + "30" }}
      >
        <span>SD-JWT X-Ray · {title}</span>
        <span className="text-[10px] font-mono text-[#7b87a8] normal-case">
          hover a disclosure to bind it to its _sd hash
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-2" style={{ minHeight: 220 }}>
        {/* Header */}
        <Quadrant title="Header" color="#7aa2ff" count={Object.keys(header).length}>
          {Object.entries(header).map(([k, v]) => (
            <div key={k} className="truncate">
              <span className="text-[#7b87a8]">{k}:</span>{" "}
              <span className="text-white/90">{String(v)}</span>
            </div>
          ))}
        </Quadrant>

        {/* Payload (with _sd hashes) */}
        <Quadrant
          title="Payload"
          color="#34d399"
          count={Object.keys(visiblePayload).length + (sdHashes.length ? 1 : 0)}
        >
          {Object.entries(visiblePayload).map(([k, v]) => (
            <div key={k} className="mb-0.5 truncate">
              <span className="text-[#7b87a8]">{k}:</span>{" "}
              <span className="text-white/90">
                {typeof v === "object" ? JSON.stringify(v).slice(0, 60) + (JSON.stringify(v).length > 60 ? "…" : "") : String(v)}
              </span>
            </div>
          ))}
          {sdHashes.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[#1f2a4a]">
              <div className="text-[#7b87a8] mb-1">
                _sd[{sdHashes.length}]:
              </div>
              {sdHashes.map((h, i) => {
                const matched = highlightedHash === h;
                return (
                  <div
                    key={h + i}
                    className={
                      "truncate transition-all rounded px-1 " +
                      (matched
                        ? "bg-[#7aa2ff] text-[#0b1020] font-bold"
                        : "text-[#7aa2ff]/80")
                    }
                  >
                    {shortHash(h, 16)}
                  </div>
                );
              })}
            </div>
          )}
        </Quadrant>

        {/* Disclosures */}
        <Quadrant title="Disclosures" color="#facc15" count={disclosures.length}>
          {disclosures.length === 0 ? (
            <div className="text-[#4f5a7e] italic">
              No disclosures (everything in payload is plaintext).
            </div>
          ) : (
            <div className="space-y-1">
              {disclosures.map((d, i) => {
                const matched = highlightedHash === d.hash;
                return (
                  <div
                    key={d.hash + i}
                    onMouseEnter={() => setHighlightedHash(d.hash)}
                    onMouseLeave={() => setHighlightedHash(null)}
                    className={
                      "rounded px-1.5 py-1 cursor-help transition " +
                      (matched
                        ? "bg-[#facc15]/30 ring-1 ring-[#facc15]"
                        : "hover:bg-[#facc15]/10")
                    }
                  >
                    <div className="flex items-center gap-1.5 text-[9px] mb-0.5">
                      <span className="text-[#7b87a8]">salt:</span>
                      <span className="text-[#facc15] truncate max-w-[80px]">
                        {shortHash(d.salt, 8)}
                      </span>
                      <span className="text-[#7b87a8]">→ _sd:</span>
                      <span className={matched ? "text-[#0b1020] bg-[#facc15] px-1 rounded font-bold" : "text-[#7aa2ff]"}>
                        {shortHash(d.hash, 10)}
                      </span>
                    </div>
                    <div className="text-white/90">
                      <span className="text-[#7b87a8]">{d.name ?? "(array)"}</span>
                      :{" "}
                      <span className="text-white">
                        {typeof d.value === "object"
                          ? JSON.stringify(d.value).slice(0, 80) +
                            (JSON.stringify(d.value).length > 80 ? "…" : "")
                          : String(d.value)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Quadrant>

        {/* Signature */}
        <Quadrant title="Signature" color="#f472b6">
          {data.serialized ? (
            <>
              <div className="text-[#7b87a8] mb-1">
                ES256 over header.payload (last segment of the JWT):
              </div>
              <div className="text-[#f472b6] break-all">
                {(() => {
                  const parts = data.serialized.split(".");
                  // serialized SD-JWT is jwt~disclosure~disclosure
                  const jwtPart = parts[0]?.split("~")[0] ?? "";
                  const sig = jwtPart.split(".")[2] ?? data.serialized.slice(-40);
                  return shortHash(sig, 32);
                })()}
              </div>
              <div className="mt-2 text-[9px] text-[#4f5a7e]">
                Verified against the issuer's public key (no shared secret).
              </div>
            </>
          ) : (
            <div className="text-[#4f5a7e] italic">No serialized form.</div>
          )}
        </Quadrant>
      </div>
    </div>
  );
}
