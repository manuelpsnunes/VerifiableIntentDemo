import { AnimatePresence, motion } from "framer-motion";
import type { Catalog, Product } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  catalog: Catalog | null;
  selectedSku?: string | null;
}

const BRAND_COLOR: Record<string, string> = {
  Babolat: "#f59e0b",
  HEAD: "#34d399",
  Wilson: "#c084fc",
};

function ProductCard({
  p,
  highlight,
}: {
  p: Product;
  highlight: boolean;
}) {
  const color = BRAND_COLOR[p.brand] ?? "#7aa2ff";
  return (
    <div
      className={
        "rounded-lg border p-3 flex flex-col gap-1 transition " +
        (highlight
          ? "border-[#7aa2ff] bg-[#7aa2ff14] shadow-[0_0_0_2px_#7aa2ff44]"
          : "border-[#1f2a4a] bg-[#0e1530] hover:border-[#2c3a66]")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono"
          style={{ background: color + "25", color }}
        >
          {p.brand}
        </span>
        <span className="text-[10px] font-mono text-[#7b87a8]">{p.sku}</span>
      </div>
      <div className="text-sm font-semibold text-white leading-snug">
        {p.name}
      </div>
      <div className="text-[11px] text-[#7b87a8] uppercase tracking-wider">
        {p.category}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-lg font-bold text-white">
          ${p.price_dollars.toFixed(2)}
        </span>
        <span className="text-[10px] text-[#7b87a8]">{p.currency}</span>
      </div>
      {highlight && (
        <div className="mt-1 text-[10px] uppercase tracking-wider text-[#7aa2ff]">
          ★ selected by the agent
        </div>
      )}
    </div>
  );
}

export function CatalogModal({ open, onClose, catalog, selectedSku }: Props) {
  return (
    <AnimatePresence>
      {open && catalog && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
        >
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-xl border border-[#1f2a4a] bg-[#111933] shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2a4a]">
              <div>
                <div className="text-lg font-semibold text-white">
                  {catalog.merchant.name}
                </div>
                <div className="text-xs text-[#7b87a8]">
                  {catalog.merchant.website} · {catalog.products.length} products
                  in the agent's acceptable-items set
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-[#7b87a8] hover:text-white text-sm px-3 py-1 rounded border border-[#1f2a4a] hover:border-[#2c3a66]"
              >
                Close
              </button>
            </div>

            <div className="p-5 overflow-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {catalog.products.map((p) => (
                  <ProductCard
                    key={p.sku}
                    p={p}
                    highlight={!!selectedSku && p.sku === selectedSku}
                  />
                ))}
              </div>

              <div className="mt-5 pt-4 border-t border-[#1f2a4a] text-[11px] text-[#7b87a8] leading-relaxed">
                These products are referenced inside the L2 mandate as
                selectively-disclosable items. The agent only sees this set
                because the user's wallet disclosed it; nothing outside this
                list can be purchased on this mandate.
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
