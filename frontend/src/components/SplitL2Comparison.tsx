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
  merchantView: SdJwtData;
  networkView: SdJwtData;
  fullL2DisclosureCount: number;
}

function disclosureNames(d?: SdJwtData["disclosures"]): Set<string> {
  if (!d) return new Set();
  return new Set(d.map((x) => x.name ?? "(array)"));
}

function ViewCard({
  title,
  party,
  partyColor,
  data,
  highlightSharedHash,
}: {
  title: string;
  party: string;
  partyColor: string;
  data: SdJwtData;
  highlightSharedHash?: string;
}) {
  const disclosures = data.disclosures ?? [];
  const payload = data.payload ?? {};
  const sdHash = payload.sd_hash as string | undefined;
  return (
    <div
      className="rounded-md border bg-[#0b1020] overflow-hidden flex flex-col"
      style={{ borderColor: partyColor + "40" }}
    >
      <div
        className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold border-b flex items-center gap-2"
        style={{ background: partyColor + "12", color: partyColor, borderColor: partyColor + "30" }}
      >
        <span>{title}</span>
        <span className="font-mono text-[#7b87a8] normal-case">
          → {party}
        </span>
      </div>
      <div className="p-2 text-[10px] font-mono leading-relaxed">
        <div className="mb-1.5">
          <span className="text-[#7b87a8]">disclosures:</span>{" "}
          <span className="text-white font-bold">{disclosures.length}</span>
        </div>
        <div className="space-y-0.5 max-h-[120px] overflow-auto">
          {disclosures.map((d, i) => (
            <div key={d.hash + i} className="text-white/85 truncate">
              <span className="text-[#7b87a8]">·</span>{" "}
              <span className="text-[#facc15]">
                {d.name ?? "(array elem)"}
              </span>
              {d.name && (
                <span className="text-white/70">
                  : {typeof d.value === "object" ? JSON.stringify(d.value).slice(0, 40) : String(d.value).slice(0, 40)}
                </span>
              )}
            </div>
          ))}
        </div>

        {sdHash && (
          <div className="mt-2 pt-2 border-t border-[#1f2a4a]">
            <div className="text-[#7b87a8] mb-0.5">
              sd_hash → L1 (binding to parent):
            </div>
            <div
              className={
                "truncate font-mono " +
                (highlightSharedHash && sdHash === highlightSharedHash
                  ? "bg-[#34d399]/30 text-[#34d399] px-1 rounded font-bold"
                  : "text-[#34d399]")
              }
            >
              {sdHash.slice(0, 24)}…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SplitL2Comparison({
  merchantView,
  networkView,
  fullL2DisclosureCount,
}: Props) {
  const merchantNames = disclosureNames(merchantView.disclosures);
  const networkNames = disclosureNames(networkView.disclosures);
  const onlyMerchant = [...merchantNames].filter((n) => !networkNames.has(n));
  const onlyNetwork = [...networkNames].filter((n) => !merchantNames.has(n));
  const shared = [...merchantNames].filter((n) => networkNames.has(n));

  const merchantSd = merchantView.payload?.sd_hash as string | undefined;
  const networkSd = networkView.payload?.sd_hash as string | undefined;
  const sameParent = merchantSd && networkSd && merchantSd === networkSd;

  return (
    <div className="rounded-lg border border-[#1f2a4a] bg-[#0e1530] overflow-hidden">
      <div className="px-4 py-2 text-xs uppercase tracking-wider font-semibold border-b border-[#1f2a4a] bg-[#0a0f25] flex items-center gap-2 text-white">
        <span>Same L2, two views</span>
        <span className="text-[10px] font-mono text-[#7b87a8] normal-case">
          (selective disclosure in action)
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-2">
        <ViewCard
          title="Checkout view"
          party="Merchant"
          partyColor="#c084fc"
          data={merchantView}
          highlightSharedHash={sameParent ? merchantSd : undefined}
        />
        <ViewCard
          title="Payment view"
          party="Network"
          partyColor="#f472b6"
          data={networkView}
          highlightSharedHash={sameParent ? networkSd : undefined}
        />
      </div>

      {/* Diff summary */}
      <div className="px-4 py-3 border-t border-[#1f2a4a] grid grid-cols-3 gap-3 text-[11px]">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[#c084fc] font-semibold mb-1">
            Merchant-only ({onlyMerchant.length})
          </div>
          <div className="text-white/80 space-y-0.5">
            {onlyMerchant.length === 0 ? (
              <div className="text-[#4f5a7e] italic">none</div>
            ) : (
              onlyMerchant.map((n) => (
                <div key={n} className="truncate font-mono text-[10px]">
                  · {n}
                </div>
              ))
            )}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[#34d399] font-semibold mb-1">
            Shared ({shared.length})
          </div>
          <div className="text-white/80 space-y-0.5">
            {shared.length === 0 ? (
              <div className="text-[#4f5a7e] italic">none</div>
            ) : (
              shared.map((n) => (
                <div key={n} className="truncate font-mono text-[10px]">
                  · {n}
                </div>
              ))
            )}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[#f472b6] font-semibold mb-1">
            Network-only ({onlyNetwork.length})
          </div>
          <div className="text-white/80 space-y-0.5">
            {onlyNetwork.length === 0 ? (
              <div className="text-[#4f5a7e] italic">none</div>
            ) : (
              onlyNetwork.map((n) => (
                <div key={n} className="truncate font-mono text-[10px]">
                  · {n}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Punchline */}
      <div className="px-4 py-2 bg-[#0a0f25] border-t border-[#1f2a4a] text-[11px]">
        {sameParent ? (
          <div className="text-[#34d399]">
            <span className="font-bold">✓</span> Both views compute the{" "}
            <span className="font-mono">same sd_hash</span> back to L1 — the chain is intact
            without either party seeing the other's disclosures. (Full L2 has{" "}
            <span className="font-mono">{fullL2DisclosureCount}</span> disclosures total.)
          </div>
        ) : (
          <div className="text-[#facc15]">
            ⚠ sd_hash mismatch between views — the chain would not verify.
          </div>
        )}
      </div>
    </div>
  );
}
