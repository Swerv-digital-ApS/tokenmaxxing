import { CASE_SHELVES, CASES, type CaseDef, slideOfShelf, VENDOR_COINS } from "@tokenmaxxing/core/cases.ts";
import { RARITY_COLOR } from "@tokenmaxxing/core/rarity.ts";
import { greeting } from "@tokenmaxxing/core/shopkeepers.ts";
import { defaultLook } from "@tokenmaxxing/core/world.ts";
import type { BagRow } from "@tokenmaxxing/server/registry";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
import { CASE_BOX_SIZE, caseBoxSprite } from "../art/case-box.ts";
import { errorText } from "../errors.ts";
import { refreshWallet, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { CaseOpening } from "./CaseOpening.tsx";
import { itemChances, percent, spareCopies } from "./caseOdds.ts";
import { coins } from "./format.ts";
import { ItemImage } from "./Shop.tsx";
import { Modal, useRun } from "./ui.tsx";

const LOOK = defaultLook(1);

/** The case `caseId`, drawn from its pixel art (`art/case-box.ts`), closed or open, scaled up. */
function CaseSprite({ caseId, open, scale = 4 }: { caseId: string; open?: boolean; scale?: number }) {
  const kind = open ? "open" : "closed";
  const { w, h } = CASE_BOX_SIZE[kind];
  return (
    <span aria-hidden="true" className="cshop-art-wrap">
      <canvas
        className="cshop-art"
        width={w * scale}
        height={h * scale}
        ref={(c) => {
          const g = c?.getContext("2d");
          if (!g || !c) return;
          g.imageSmoothingEnabled = false;
          g.clearRect(0, 0, c.width, c.height);
          g.drawImage(caseBoxSprite(kind, 0, caseId), 0, 0, w * scale, h * scale);
        }}
      />
    </span>
  );
}

/** A case still to come: only its shape, on a shelf at the back of the hall. */
function ComingSoon({ n }: { n: number }) {
  return (
    <li className="cshop-card locked" aria-label="Coming soon">
      <div className="cshop-silhouette" data-shape={n % 3} aria-hidden="true">
        <span>🔒</span>
      </div>
      <div className="cshop-main">
        <h3>Coming soon</h3>
        <p className="muted small">Something is wrapped on the shelf. Check back after dark.</p>
      </div>
    </li>
  );
}

/** Whether the last slide is the "Coming soon" one: only while some shelf at the back of the hall is still empty. */
const SOON = CASES.length < CASE_SHELVES;
/** The cases, then the one locked slide. The order is the shelves' order, left to right. */
const SLIDES = CASES.length + (SOON ? 1 : 0);

/** Left/right on the keyboard, unless a key is meant for a field or a dialog is on top. */
function pagerKey(e: KeyboardEvent): 1 | -1 | 0 {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return 0;
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || hud.get().dialog) return 0;
  const t = e.target;
  if (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement ||
    (t instanceof HTMLElement && t.isContentEditable)
  )
    return 0;
  return e.key === "ArrowRight" ? 1 : -1;
}

/**
 * Natmarked's counter and shelves: the cases on sale, one at a time (left and right, the arrow keys or the dots),
 * then a locked "Coming soon" while a shelf is still empty. Each card has the case's art, what it costs, "Open case"
 * (the opening screen, wired to the server's `openCase`), the odds of everything inside and a button that sells
 * the spare copies back to the vendor. The server rolls and charges; this only asks and shows.
 */
export function CaseShop({ shelf }: { shelf?: number }) {
  const me = useHud((s) => s.me);
  const wallet = useHud((s) => s.wallet);
  const [hello] = useState(() => greeting("natmarked", Math.floor(Math.random() * 8)));
  const [bag, setBag] = useState<BagRow[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [opening, setOpening] = useState<CaseDef | null>(null);
  const [sold, setSold] = useState<string | null>(null);
  const { error, busy, run } = useRun();
  // Which slide, and which way it came from (for the slide-in).
  const [page, setPage] = useState({ at: slideOfShelf(shelf), dir: 1 });
  const go = (to: number, dir?: number) => {
    setSold(null);
    setPage((p) => {
      const at = ((to % SLIDES) + SLIDES) % SLIDES;
      return { at, dir: dir ?? (at >= p.at ? 1 : -1) };
    });
  };

  const reload = async () => {
    await refreshWallet();
    setBag(await town.bag());
  };
  // The bag again whenever the opening screen is closed: the new item is in it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `reload` only calls stable setters; it should run when `opening` flips, not on every render.
  useEffect(() => {
    if (opening) return;
    void reload().catch((e) => setFailed(errorText(e)));
  }, [opening]);

  // Arrow keys turn the page while the shop is open. The game itself ignores them with a panel up.
  useEffect(() => {
    if (opening) return;
    const onKey = (e: KeyboardEvent) => {
      const d = pagerKey(e);
      if (d === 0) return;
      e.preventDefault();
      setSold(null);
      setPage((p) => ({ at: (p.at + d + SLIDES) % SLIDES, dir: d }));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opening]);

  if (opening)
    return (
      <CaseOpening
        def={opening}
        keyPrice={opening.keyPrice}
        onClose={() => setOpening(null)}
        roll={async () => {
          const r = await town.openCase(opening.id);
          hud.set({ wallet: r.wallet });
          return r.item;
        }}
      />
    );

  if (!me || !wallet) return <Modal title="🏮 Natmarked">{failed ?? "Loading…"}</Modal>;

  return (
    <Modal title="🏮 Natmarked" wide="xl">
      <div className="shop-top">
        <p className="shop-hello">{hello}</p>
        <div className="shop-bar">
          <span className="coin-chip on">
            <strong>{coins(wallet.balance)}</strong> yours
          </span>
          <button type="button" className="shop-leave" onClick={() => hud.set({ panel: null })}>
            Leave
          </button>
        </div>
      </div>
      {sold && (
        <p className="muted" role="status">
          {sold}
        </p>
      )}
      <div className="cshop-pager">
        <button
          type="button"
          className="cshop-arrow prev"
          aria-label="Previous case"
          onClick={() => go(page.at - 1, -1)}
        >
          ‹
        </button>
        <ul className="cshop-list" style={{ "--dir": page.dir } as CSSProperties}>
          {page.at < CASES.length ? (
            <CaseCard
              key={CASES[page.at]!.id}
              def={CASES[page.at]!}
              balance={wallet.balance}
              bag={bag}
              busy={busy}
              onOpen={() => {
                setSold(null);
                setOpening(CASES[page.at]!);
              }}
              onSell={run(async () => {
                const r = await town.sellDuplicates(CASES[page.at]!.id);
                hud.set({ wallet: r.wallet });
                setBag(await town.bag());
                setSold(
                  r.sold === 0
                    ? "No spare copies to sell."
                    : `Sold ${r.sold} spare ${r.sold === 1 ? "copy" : "copies"}.`,
                );
              })}
            />
          ) : (
            <ComingSoon key="soon" n={CASES.length} />
          )}
        </ul>
        <button
          type="button"
          className="cshop-arrow next"
          aria-label="Next case"
          onClick={() => go(page.at + 1, 1)}
        >
          ›
        </button>
        <nav className="cshop-dots" aria-label="Cases">
          {Array.from({ length: SLIDES }, (_, k) => k).map((k) => (
            <button
              key={CASES[k]?.id ?? "soon"}
              type="button"
              className="cshop-dot"
              aria-label={
                CASES[k] ? `${CASES[k].name}, ${k + 1} of ${SLIDES}` : `Coming soon, ${k + 1} of ${SLIDES}`
              }
              aria-current={k === page.at ? "true" : undefined}
              onClick={() => go(k)}
            />
          ))}
          <span className="cshop-count muted small" aria-hidden="true">
            {page.at + 1} / {SLIDES}
          </span>
        </nav>
      </div>
      {error && <p className="error">{error}</p>}
      {failed && <p className="error">{failed}</p>}
    </Modal>
  );
}

function CaseCard({
  def,
  balance,
  bag,
  busy,
  onOpen,
  onSell,
}: {
  def: CaseDef;
  balance: number;
  bag: readonly BagRow[];
  busy: boolean;
  onOpen: () => void;
  onSell: () => void;
}) {
  const rows = useMemo(() => itemChances(def), [def]);
  // Like a CS knife: the case says there is a legendary in it, never which ones.
  const legendary = rows.filter((r) => r.tier === "legendary");
  const legendaryOwned = legendary.reduce(
    (a, r) => a + (bag.find((b) => b.item === r.item.id)?.count ?? 0),
    0,
  );
  const spare = useMemo(() => spareCopies(def, bag), [def, bag]);
  const short = def.keyPrice - balance;
  const tiers = [...new Set(rows.map((r) => r.tier))];
  return (
    <li className="cshop-card">
      <div className="cshop-top">
        <CaseSprite caseId={def.id} />
        <div className="cshop-main">
          <h3>{def.name}</h3>
          <p className="muted">{def.blurb}</p>
          <p className="cshop-price">
            <span className="coin-chip">
              <strong>{coins(def.keyPrice)}</strong> a key
            </span>
            <span className="muted small"> · {rows.length} things inside</span>
          </p>
          <div className="cshop-actions">
            <button type="button" className="primary" disabled={short > 0 || busy} onClick={onOpen}>
              Open case · {coins(def.keyPrice)}
            </button>
            <button
              type="button"
              disabled={spare.copies === 0 || busy}
              onClick={onSell}
              title="Sells every copy past the first of each item from this case"
            >
              {spare.copies === 0
                ? "Sell duplicates"
                : `Sell ${spare.copies} duplicate${spare.copies === 1 ? "" : "s"} · +${coins(spare.coins)}`}
            </button>
          </div>
          {short > 0 && (
            <p className="error small">
              Not enough coins: the key is {coins(def.keyPrice)} and you have {coins(balance)}.
            </p>
          )}
          <p className="muted small">
            The vendor pays {tiers.map((t) => `${coins(VENDOR_COINS[t])} for ${t}`).join(", ")}.
          </p>
        </div>
      </div>
      <h4 className="cshop-contains">Contains</h4>
      <ul className="cshop-items">
        {legendary.length > 0 && (
          <li
            className="mystery"
            title="Something rarer than the rest. You find out when you open it."
            style={{ "--r": RARITY_COLOR.legendary } as CSSProperties}
          >
            <span className="cs-q">???</span>
            <span className="cs-name">Legendary Item!</span>
            <span className="cshop-odds">{percent(legendary.reduce((a, r) => a + r.chance, 0))}</span>
            <span className="cs-slot" style={{ color: RARITY_COLOR.legendary }}>
              legendary
              {legendaryOwned > 0 && ` · you have ${legendaryOwned}`}
            </span>
          </li>
        )}
        {rows
          .filter((r) => r.tier !== "legendary")
          .map(({ item, tier, chance }) => {
            const n = bag.find((b) => b.item === item.id)?.count ?? 0;
            return (
              <li key={item.id} title={item.blurb} style={{ "--r": RARITY_COLOR[tier] } as CSSProperties}>
                <ItemImage item={item} look={LOOK} bare />
                <span className="cs-name">{item.name}</span>
                <span className="cshop-odds">{percent(chance)}</span>
                <span className="cs-slot" style={{ color: RARITY_COLOR[tier] }}>
                  {tier}
                  {n > 0 && ` · you have ${n}`}
                </span>
              </li>
            );
          })}
      </ul>
      <p className="muted small">
        Chances are per opening, split evenly inside each rarity. Every {def.rareWithin}th opening in a row
        without a rare is a rare or better. A pick you already own is drawn again{" "}
        {def.dupeRerolls === 1 ? "once" : `${def.dupeRerolls} times`}.
      </p>
    </li>
  );
}
