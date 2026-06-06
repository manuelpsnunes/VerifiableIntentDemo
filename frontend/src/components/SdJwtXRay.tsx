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

/**
 * Decompose an SD-JWT compact serialization into its on-the-wire segments:
 *   <HEADER>.<PAYLOAD>.<SIGNATURE>~<DISCLOSURE>~<DISCLOSURE>~...
 * Each piece is base64url. The dots separate the JWS parts; the tildes
 * separate appended SD-JWT disclosures.
 */
function decomposeSerialized(serialized?: string): {
  header: string;
  payload: string;
  signature: string;
  disclosures: string[];
} | null {
  if (!serialized) return null;
  // Strip a trailing ~ that SD-JWT compact form uses as a sentinel.
  const trimmed = serialized.endsWith("~") ? serialized.slice(0, -1) : serialized;
  const tildeParts = trimmed.split("~");
  const jwt = tildeParts[0] ?? "";
  const disclosures = tildeParts.slice(1).filter(Boolean);
  const dotParts = jwt.split(".");
  if (dotParts.length !== 3) return null;
  return {
    header: dotParts[0],
    payload: dotParts[1],
    signature: dotParts[2],
    disclosures,
  };
}

// Tailwind-color tokens kept consistent with the existing quadrant colors so
// the wire-format strip visually maps 1:1 to the inspector panels below it.
const SEG_COLOR = {
  header: "#7aa2ff",
  payload: "#34d399",
  signature: "#f472b6",
  disclosure: "#facc15",
} as const;

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

      {/* Wire-format strip: shows the on-the-wire compact serialization with
          each base64url segment color-coded to the matching inspector quadrant
          below. Separators "." (JWS) and "~" (SD-JWT disclosure) are dimmed
          so the segment boundaries pop out visually. */}
      {(() => {
        const decomposed = decomposeSerialized(data.serialized);
        if (!decomposed) return null;
        const seg = (text: string, color: string, label: string) => (
          <span
            className="px-1 rounded font-mono break-all"
            style={{ background: color + "18", color }}
            title={`${label} (${text.length} chars base64url)`}
          >
            {shortHash(text, 18)}
          </span>
        );
        const dot = <span className="text-[#7b87a8] mx-0.5">.</span>;
        const tilde = <span className="text-[#7b87a8] mx-0.5">~</span>;
        return (
          <div className="px-4 py-2 border-b border-[#1f2a4a] bg-[#0a0f25] text-[10px] leading-snug">
            <div className="text-[9px] uppercase tracking-wider text-[#7b87a8] mb-1 font-semibold">
              Compact wire format · what actually travels over the wire
            </div>
            <div className="flex flex-wrap items-baseline gap-y-1">
              {seg(decomposed.header, SEG_COLOR.header, "HEADER")}
              {dot}
              {seg(decomposed.payload, SEG_COLOR.payload, "PAYLOAD")}
              {dot}
              {seg(decomposed.signature, SEG_COLOR.signature, "SIGNATURE")}
              {decomposed.disclosures.map((d, i) => (
                <span key={i} className="flex items-baseline">
                  {tilde}
                  {seg(d, SEG_COLOR.disclosure, `DISCLOSURE #${i + 1}`)}
                </span>
              ))}
              {tilde}
            </div>
            <div className="mt-1.5 text-[9px] text-[#4f5a7e] flex flex-wrap gap-x-3 gap-y-0.5">
              <span>
                <span style={{ color: SEG_COLOR.header }}>■</span> header
              </span>
              <span>
                <span style={{ color: SEG_COLOR.payload }}>■</span> payload
              </span>
              <span>
                <span style={{ color: SEG_COLOR.signature }}>■</span> signature
              </span>
              <span>
                <span style={{ color: SEG_COLOR.disclosure }}>■</span> disclosure(s)
              </span>
              <span className="text-[#4f5a7e]">all base64url · "." = JWS separator · "~" = SD-JWT disclosure separator</span>
            </div>
          </div>
        );
      })()}

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
          {(() => {
            const decomposed = decomposeSerialized(data.serialized);
            if (!decomposed) {
              return <div className="text-[#4f5a7e] italic">No serialized form.</div>;
            }
            return (
              <>
                <div className="text-[#7b87a8] mb-1">
                  Third segment of the JWS · base64url(64-byte ECDSA r∥s):
                </div>
                <div className="text-[#f472b6] break-all">
                  {shortHash(decomposed.signature, 40)}
                </div>
                <div className="mt-2 pt-2 border-t border-[#1f2a4a] text-[9px] text-[#7b87a8] font-mono leading-snug">
                  <div className="text-[#f472b6] mb-0.5">how this was signed:</div>
                  <div>
                    sig = <span className="text-white">ECDSA_sign</span>(
                  </div>
                  <div className="pl-3">
                    <span className="text-white">private_key</span>,
                  </div>
                  <div className="pl-3">
                    <span className="text-white">SHA-256</span>(b64u(header) + "." + b64u(payload))
                  </div>
                  <div>)</div>
                </div>
                <div className="mt-2 text-[9px] text-[#4f5a7e]">
                  Verified against the issuer's public key (no shared secret).
                  Tamper any byte of header or payload → verification fails.
                </div>
              </>
            );
          })()}
        </Quadrant>
      </div>
    </div>
  );
}
