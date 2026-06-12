import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { JsonView, darkStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { getFieldDoc, type FieldDoc } from "../fieldDocs";

interface Props {
  data: unknown;
}

interface TooltipState {
  doc: FieldDoc;
  /** Anchor rect (viewport coords) of the hovered key label. */
  anchor: { left: number; top: number; bottom: number; width: number };
}

/**
 * A thin wrapper around react-json-view-lite that adds spec-sourced hover
 * descriptions to individual JSON keys.
 *
 * react-json-view-lite (v2) exposes no per-key render hook — only CSS class
 * names. We rely on the fact that every property-name span carries the
 * `darkStyles.label` class, and use event delegation: a single mouseover
 * handler on the container reads the hovered label's text, looks it up in
 * FIELD_DOCS, and positions one shared tooltip. This keeps the library's
 * collapse/expand behaviour intact and survives its re-renders, since we read
 * the live DOM rather than reimplementing the tree.
 */
export function DocumentedJsonView({ data }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tip, setTip] = useState<TooltipState | null>(null);

  // Resolve a hovered element to its key label + documented field, if any.
  const docForTarget = useCallback(
    (target: EventTarget | null): { el: HTMLElement; doc: FieldDoc } | null => {
      if (!(target instanceof Element)) return null;
      const labelClass = darkStyles.label;
      const el = labelClass
        ? (target.closest("." + labelClass) as HTMLElement | null)
        : null;
      if (!el) return null;
      // The label text is the bare key name (quotesForFieldNames defaults to
      // false). Strip any stray quotes/colon defensively just in case.
      const key = (el.textContent ?? "").replace(/^["']|["':]+$/g, "").trim();
      if (!key) return null;
      const doc = getFieldDoc(key);
      if (!doc) return null;
      return { el, doc };
    },
    []
  );

  const handleMouseOver = useCallback(
    (e: React.MouseEvent) => {
      const hit = docForTarget(e.target);
      if (!hit) return;
      const r = hit.el.getBoundingClientRect();
      setTip({
        doc: hit.doc,
        anchor: { left: r.left, top: r.top, bottom: r.bottom, width: r.width },
      });
    },
    [docForTarget]
  );

  const handleMouseOut = useCallback(
    (e: React.MouseEvent) => {
      // Only clear when leaving the documented label entirely (not when moving
      // onto a child text node of the same label).
      const from = docForTarget(e.target);
      const to = docForTarget(e.relatedTarget);
      if (from && to && from.el === to.el) return;
      if (from) setTip(null);
    },
    [docForTarget]
  );

  // A stable shouldExpandNode (avoids re-creating a new fn each render).
  const shouldExpand = useCallback((level: number) => level < 2, []);

  return (
    <div
      ref={containerRef}
      className="json-viewer relative rounded-md border border-[#1f2a4a] bg-[#0b1020] p-3"
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      onScrollCapture={() => setTip(null)}
    >
      <JsonView
        data={(data ?? {}) as object}
        shouldExpandNode={shouldExpand}
        style={darkStyles}
      />
      {tip && <FieldTooltip tip={tip} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------
// Rendered as a fixed-position element so it can escape the JSON viewer's
// overflow box and float above the drawer. Position is measured after layout
// and clamped to the viewport.

function FieldTooltip({ tip }: { tip: TooltipState }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const { width, height } = node.getBoundingClientRect();
    const margin = 8;
    const { left: aLeft, top: aTop, bottom: aBottom } = tip.anchor;

    // Prefer below the key; flip above if it would overflow the bottom.
    let top = aBottom + 6;
    if (top + height + margin > window.innerHeight) {
      top = aTop - height - 6;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));

    let left = aLeft;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

    setPos({ left, top });
  }, [tip]);

  const { doc } = tip;
  const isInferred = doc.source === "inferred";

  return (
    <div
      ref={ref}
      role="tooltip"
      className="fixed z-[60] max-w-[340px] rounded-lg border border-[#2c3a66] bg-[#0e1530] px-3 py-2.5 shadow-2xl pointer-events-none"
      style={{
        left: pos?.left ?? tip.anchor.left,
        top: pos?.top ?? tip.anchor.bottom + 6,
        // Hide until measured to avoid a one-frame flash at the wrong spot.
        visibility: pos ? "visible" : "hidden",
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[13px] font-mono font-semibold text-[#7aa2ff]">
          {doc.key}
        </span>
        {isInferred ? (
          <span className="text-[9px] uppercase tracking-wider font-semibold text-amber-400 border border-amber-400/40 rounded px-1 py-0.5">
            inferred
          </span>
        ) : (
          doc.specRef && (
            <span className="text-[9px] font-mono text-emerald-400 border border-emerald-400/30 rounded px-1 py-0.5">
              {doc.specRef}
            </span>
          )
        )}
      </div>
      <p className="text-[12px] text-[#d4dcf0] leading-snug">{doc.short}</p>
      {doc.payments_analog && (
        <p className="mt-1.5 text-[11px] text-[#a4b0d0] leading-snug italic">
          <span className="not-italic text-[#7b87a8] uppercase tracking-wider text-[9px] font-semibold mr-1.5">
            In payments
          </span>
          {doc.payments_analog}
        </p>
      )}
    </div>
  );
}
