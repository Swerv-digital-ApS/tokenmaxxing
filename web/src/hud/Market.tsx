import {
  type Listing,
  listable,
  MARKET_ALLOWANCE,
  MARKET_LEVEL,
  MARKET_SLOTS,
  MARKET_TTL,
  type MyMarket,
  priceCap,
  slotTile,
} from "@tokenmaxxing/core/market.ts";
import { editionLabel } from "@tokenmaxxing/core/merchant.ts";
import { RARITIES, RARITY_COLOR, type Rarity, rarityOf } from "@tokenmaxxing/core/rarity.ts";
import { type Item, itemById } from "@tokenmaxxing/core/shop.ts";
import { greeting } from "@tokenmaxxing/core/shopkeepers.ts";
import { SHOPS } from "@tokenmaxxing/core/shoprooms.ts";
import type { BagRow, Copy } from "@tokenmaxxing/server/registry";
import { type CSSProperties, useEffect, useState } from "react";
import { errorText } from "../errors.ts";
import { world } from "../game/world.ts";
import { marketBuy, marketCancel, marketList, refreshMarket, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { coins } from "./format.ts";
import { isWorn } from "./lookOps.ts";
import { ItemImage } from "./Shop.tsx";
import { Modal, Pills, useRun, useTicker } from "./ui.tsx";

/** How often an open market panel reads the hall again: others are buying and listing too. */
const POLL_MS = 5_000;

// MARK: Where things are

/** Where a slot is in the hall: a shelf on the back wall, or one spot of a glass case (a run of tiles). */
interface Place {
  kind: "shelf" | "case";
  /** Which shelf or case, from 1, in reading order. */
  n: number;
  /** For a case: which spot of it, from 1, and how many it has. */
  spot: number;
  of: number;
}

const PLACES: readonly Place[] = (() => {
  const rows = SHOPS.market.rows;
  const cases = new Map<string, number>();
  let shelves = 0;
  return Array.from({ length: MARKET_SLOTS }, (_, slot): Place => {
    const [x, y] = slotTile(slot)!;
    const here = rows[y]![x]!;
    if (rows[y - 1]?.[x] === "W") return { kind: "shelf", n: ++shelves, spot: 1, of: 1 };
    let start = x;
    while (rows[y]![start - 1] === here) start--;
    let end = x;
    while (rows[y]![end + 1] === here) end++;
    const key = `${y}:${start}`;
    if (!cases.has(key)) cases.set(key, cases.size + 1);
    return { kind: "case", n: cases.get(key)!, spot: x - start + 1, of: end - start + 1 };
  });
})();

/** "Case 2, spot 3 of 4" or "Back wall, shelf 5". */
const placeText = (slot: number): string => {
  const p = PLACES[slot];
  if (!p) return "Somewhere in the hall";
  return p.kind === "shelf" ? `Back wall, shelf ${p.n}` : `Case ${p.n}, spot ${p.spot} of ${p.of}`;
};

// MARK: Time

/** "6d 4h", "3h 20m", "12m". */
function span(ms: number): string {
  const m = Math.max(1, Math.floor(ms / 60_000));
  if (m >= 1440) return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m}m`;
}

const DAYS = MARKET_TTL / 86_400_000;

// MARK: Data

/** A numbered copy as the server lists it; `id` is its row, which is what `marketList`'s `copy` takes. */
type NumberedCopy = Copy & { id?: number };

/**
 * The hall as the store has it, read again as the panel opens (which also tells me of sales I missed) and every
 * few seconds while it is open.
 */
function useHall() {
  const market = useHud((s) => s.market);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    const load = (toast: boolean) =>
      refreshMarket(toast).then(
        () => setFailed(null),
        (e) => setFailed(errorText(e)),
      );
    void load(true);
    const id = setInterval(() => void load(false), POLL_MS);
    return () => clearInterval(id);
  }, []);
  return { market, failed };
}

const rarityStyle = (r: Rarity): CSSProperties => ({ "--r": RARITY_COLOR[r] }) as CSSProperties;

// MARK: One listing

/**
 * One thing on display: what it is, its price, who sells it and for how long, and where it is in the hall. Mine
 * can be taken back; anyone else's can be bought (in the hall, with the coins). `done` is told what happened.
 */
function ListingDetail({ listing, done }: { listing: Listing; done?: (said: string) => void }) {
  const me = useHud((s) => s.me);
  const wallet = useHud((s) => s.wallet);
  const inHall = useHud((s) => s.room === "shop-market");
  const { error, busy, run } = useRun();
  useTicker(30_000);
  const item = itemById(listing.item);
  if (!item || !me || !wallet) return null;
  const mine = listing.sellerId === world.selfId;
  const short = listing.price - wallet.balance;
  const why = !inHall
    ? "You buy in the hall: walk into Torvehallen."
    : short > 0
      ? `You need ${coins(short)} more.`
      : null;
  const rarity = rarityOf(item);
  const buy = run(async () => {
    await marketBuy(listing);
    done?.(`You bought ${item.name} for ${coins(listing.price)}. It's in your bag.`);
  });
  const takeBack = run(async () => {
    await marketCancel(listing);
    done?.(`${item.name} is back in your bag.`);
  });
  return (
    <div className="mk-detail" style={rarityStyle(rarity)}>
      <div className="mk-pic">
        <ItemImage item={item} look={me.look} bare />
      </div>
      <div className="mk-info">
        <h3>
          {item.name}
          {listing.edition && (
            <span className="muted"> {editionLabel(listing.edition.n, listing.edition)}</span>
          )}
        </h3>
        <p>
          <span className="mk-rarity">{rarity}</span>
          {item.blurb && <span className="muted"> {item.blurb}</span>}
        </p>
        <p className="mk-price">{coins(listing.price)}</p>
        <p className="muted small">
          {mine ? (
            "Yours."
          ) : (
            <>
              Sold by{" "}
              <button
                type="button"
                className="link"
                onClick={() => hud.set({ panel: { kind: "card", userId: listing.sellerId } })}
              >
                {listing.seller}
              </button>
              .
            </>
          )}{" "}
          Comes down in {span(listing.expiresAt - Date.now())} if nobody buys it.
        </p>
        <p className="muted small">{placeText(listing.slot)}</p>
        <div className="mk-actions">
          {mine ? (
            <button type="button" onClick={takeBack} disabled={busy}>
              Take back
            </button>
          ) : (
            <button type="button" className="primary" onClick={buy} disabled={busy || why !== null}>
              Buy for {coins(listing.price)}
            </button>
          )}
          {!mine && why && <span className="muted small">{why}</span>}
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}

// MARK: Putting something up

/** What stops me putting more up, in plain words, or null. */
function refusal(level: number, mine: MyMarket): string | null {
  if (level < MARKET_LEVEL)
    return `You can put things on display from level ${MARKET_LEVEL}. You are level ${level}. Until then you can still buy here.`;
  if (mine.room > 0) return null;
  const next = MARKET_ALLOWANCE.find((a) => a.listings > mine.allowance);
  return `All ${mine.allowance} of your spots are in use at level ${level}. Take something back, or wait for it to sell${
    next ? `. Level ${next.level} gives you ${next.listings}` : ""
  }.`;
}

/** An empty spot: choose one of your things, name a price, and it is on display. Choosing is for good, so it says so. */
function PutUp({ slot, mine }: { slot: number; mine: MyMarket | null }) {
  const me = useHud((s) => s.me);
  const level = useHud((s) => s.stats?.level);
  const [bag, setBag] = useState<BagRow[] | null>(null);
  const [copies, setCopies] = useState<NumberedCopy[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [copy, setCopy] = useState<number | undefined>(undefined);
  const [price, setPrice] = useState("");
  const { error, busy, run } = useRun();
  useEffect(() => {
    void town.bag().then(setBag, (e) => setFailed(errorText(e)));
    void town.copies().then(setCopies, () => {});
  }, []);
  if (level === undefined || !mine || !me || !bag) return <p className="muted">{failed ?? "Loading…"}</p>;
  const stopped = refusal(level, mine);
  if (stopped) return <p role="status">{stopped}</p>;

  const things = bag.flatMap((row) => {
    const item = itemById(row.item);
    return item && listable(item.id) ? [{ row, item }] : [];
  });
  const item = things.find((t) => t.item.id === picked)?.item;
  const cap = item ? priceCap(item.id) : 0;
  const numbered = copies.filter((c) => c.item === picked);
  const amount = Number(price);
  const ok =
    item !== undefined && price.trim() !== "" && Number.isInteger(amount) && amount >= 1 && amount <= cap;
  const choose = (it: Item) => {
    setPicked(it.id);
    setCopy(copies.find((c) => c.item === it.id && c.id !== undefined)?.id);
  };
  const submit = run(async () => {
    if (!item || !ok) return;
    await marketList({ item: item.id, slot, price: amount, ...(copy === undefined ? {} : { copy }) });
  });
  return (
    <form className="mk-put" onSubmit={submit}>
      <p>Put something of yours here. {mine && `You have ${mine.room} of ${mine.allowance} spots free.`}</p>
      {things.length === 0 && (
        <p className="muted">
          Nothing in your bag can go on display. Hats, outfits, pets and furniture you bought can; rewards
          can't.
        </p>
      )}
      <ul className="mk-things">
        {things.map(({ row, item: it }) => (
          <li key={it.id} style={rarityStyle(rarityOf(it))}>
            <button type="button" aria-pressed={it.id === picked} onClick={() => choose(it)}>
              <ItemImage item={it} look={me.look} bare />
              <span className="mk-name">{it.name}</span>
              <span className="muted small">
                {rarityOf(it)}
                {row.count > 1 && ` · ×${row.count}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {item && (
        <>
          {numbered.length > 0 &&
            (numbered.some((c) => c.id !== undefined) ? (
              <label className="mk-field">
                Which copy
                <select value={copy ?? ""} onChange={(e) => setCopy(Number(e.target.value))}>
                  {numbered.map((c) => (
                    <option key={c.id ?? `${c.week}.${c.n}`} value={c.id}>
                      {editionLabel(c.n, c)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="muted small">It's a numbered copy: your newest one goes up.</p>
            ))}
          <label className="mk-field">
            Price (🪙 1 to {cap.toLocaleString()} for a {rarityOf(item)} thing)
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={cap}
              step={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={`up to ${cap}`}
            />
          </label>
          <p className="muted small">
            A price can't be changed once it's up. To change it, take the {item.name.toLowerCase()} back and
            put it up again. If nobody buys it in {DAYS} days it goes back in your bag. The coins are yours
            the moment someone buys.
            {isWorn(item, me.look) && " You're wearing it: it comes off."}
          </p>
          <div className="mk-actions">
            <button type="submit" className="primary" disabled={busy || !ok}>
              Put it on display{ok ? ` for ${coins(amount)}` : ""}
            </button>
          </div>
        </>
      )}
      {(error || failed) && <p className="error">{error ?? failed}</p>}
    </form>
  );
}

/** E on a case or shelf: what is there to buy, or a free spot to fill. */
export function MarketSlot({ slot }: { slot: number }) {
  const { market, failed } = useHall();
  const [said, setSaid] = useState<string | null>(null);
  const title = `🧺 ${placeText(slot)}`;
  if (!market) return <Modal title={title}>{failed ?? "Loading…"}</Modal>;
  const listing = market.listings.find((l) => l.slot === slot && l.expiresAt > Date.now());
  return (
    <Modal title={title} wide>
      {said ? (
        <>
          <p role="status">{said}</p>
          <div className="mk-actions">
            <button type="button" onClick={() => hud.set({ panel: null })}>
              Close
            </button>
          </div>
        </>
      ) : listing ? (
        <ListingDetail listing={listing} done={setSaid} />
      ) : (
        <PutUp slot={slot} mine={market.mine} />
      )}
      {failed && <p className="error">{failed}</p>}
    </Modal>
  );
}

// MARK: The counter

type Tab = "display" | "shelf";
const TABS = [
  ["display", "🧺 On display"],
  ["shelf", "📦 My shelf"],
] as const;

const KINDS = [
  ["all", "Everywhere"],
  ["shelf", "Shelves"],
  ["case", "Cases"],
] as const;
const SORTS = [
  ["new", "Newest"],
  ["cheap", "Cheapest"],
  ["dear", "Dearest"],
] as const;
const RARITY_PILLS: readonly (readonly [Rarity | "all", string])[] = [
  ["all", "Any rarity"],
  ...RARITIES.map((r) => [r, r] as const),
];

/** Torvehallen's counter: everything on display with filters, and my own shelf. */
export function Market({ tab: wanted }: { tab?: Tab }) {
  const wallet = useHud((s) => s.wallet);
  const { market, failed } = useHall();
  const [hello] = useState(() => greeting("market", Math.floor(Math.random() * 8)));
  const [tab, setTab] = useState<Tab>(wanted ?? "display");
  useEffect(() => {
    if (wanted) setTab(wanted);
  }, [wanted]);
  if (!market || !wallet) return <Modal title="🧺 Torvehallen">{failed ?? "Loading…"}</Modal>;
  return (
    <Modal title="🧺 Torvehallen" wide="xl">
      <div className="shop-top">
        <p className="shop-hello">{hello}</p>
        <div className="shop-bar">
          <span className="coin-chip on">
            <strong>{coins(wallet.balance)}</strong> yours
          </span>
          <Pills value={tab} options={TABS} onChange={setTab} />
          <button type="button" className="shop-leave" onClick={() => hud.set({ panel: null })}>
            Leave
          </button>
        </div>
      </div>
      {tab === "display" ? <OnDisplay listings={market.listings} /> : <MyShelf mine={market.mine} />}
      {failed && <p className="error">{failed}</p>}
    </Modal>
  );
}

/** Everything on display, by rarity and where it is, cheapest or newest first. A click shows where it is. */
function OnDisplay({ listings }: { listings: Listing[] }) {
  const me = useHud((s) => s.me);
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [kind, setKind] = useState<"all" | "shelf" | "case">("all");
  const [sort, setSort] = useState<"new" | "cheap" | "dear">("new");
  const [picked, setPicked] = useState<number | null>(null);
  const now = Date.now();
  const live = listings.filter((l) => l.expiresAt > now && itemById(l.item));
  const shown = live
    .filter(
      (l) =>
        (rarity === "all" || rarityOf(itemById(l.item)!) === rarity) &&
        (kind === "all" || PLACES[l.slot]?.kind === kind),
    )
    .sort((a, b) =>
      sort === "cheap" ? a.price - b.price : sort === "dear" ? b.price - a.price : b.expiresAt - a.expiresAt,
    );
  if (!me) return null;
  return (
    <>
      <div className="mk-filters">
        <Pills value={rarity} options={RARITY_PILLS} onChange={setRarity} />
        <Pills value={kind} options={KINDS} onChange={setKind} />
        <Pills value={sort} options={SORTS} onChange={setSort} />
      </div>
      {live.length === 0 ? (
        <p className="muted">
          Nothing is on display yet. Walk up to a free case or shelf in the hall and press E to put something
          there.
        </p>
      ) : (
        <p className="muted small">
          {shown.length === live.length
            ? `${live.length} on display.`
            : `${shown.length} of ${live.length} on display.`}{" "}
          Pick one to see where it is.
        </p>
      )}
      <ul className="mk-list">
        {shown.map((l) => {
          const item = itemById(l.item)!;
          const open = picked === l.id;
          return (
            <li key={l.id} className={open ? "open" : undefined} style={rarityStyle(rarityOf(item))}>
              <button
                type="button"
                className="mk-row"
                aria-expanded={open}
                onClick={() => setPicked(open ? null : l.id)}
              >
                <ItemImage item={item} look={me.look} bare />
                <span className="mk-name">
                  {item.name}
                  {l.edition && <span className="muted"> {editionLabel(l.edition.n, l.edition)}</span>}
                </span>
                <span className="muted small">
                  {rarityOf(item)} · {placeText(l.slot)} · {l.seller}
                </span>
                <strong className="mk-cost">{coins(l.price)}</strong>
              </button>
              {open && <ListingDetail listing={l} />}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** What I have on display and may put up, with Take back, and the sales I have heard of. */
function MyShelf({ mine }: { mine: MyMarket | null }) {
  const level = useHud((s) => s.stats?.level);
  const log = useHud((s) => s.marketLog);
  const [said, setSaid] = useState<string | null>(null);
  if (!mine || level === undefined) return <p className="muted">Loading…</p>;
  const next = MARKET_ALLOWANCE.find((a) => a.listings > mine.allowance);
  const earned = log.reduce((sum, s) => sum + s.price, 0);
  return (
    <>
      <p>
        {level < MARKET_LEVEL ? (
          <>
            You can put things on display from level {MARKET_LEVEL}. You are level {level}.
          </>
        ) : (
          <>
            <strong>
              {mine.listings.length} of {mine.allowance}
            </strong>{" "}
            spots used.{" "}
            {next && (
              <span className="muted">
                Level {next.level} gives you {next.listings}.
              </span>
            )}
          </>
        )}
      </p>
      <p className="muted small">
        To put something up, walk to a free case or shelf in the hall and press E on it. A price can't be
        changed once it's up: take the thing back and put it up again. Unsold things come down after {DAYS}{" "}
        days and go back in your bag.
      </p>
      {said && <p role="status">{said}</p>}
      {mine.listings.length === 0 ? (
        <p className="muted">Nothing of yours is on display.</p>
      ) : (
        <ul className="mk-list">
          {mine.listings.map((l) => (
            <li key={l.id} style={rarityStyle(rarityOf(itemById(l.item)!))}>
              <ListingDetail listing={l} done={setSaid} />
            </li>
          ))}
        </ul>
      )}
      <h3>Sold</h3>
      {log.length === 0 ? (
        <p className="muted small">Nothing has sold yet.</p>
      ) : (
        <>
          <p className="muted small">
            The last {log.length}: {coins(earned)} in all.
          </p>
          <ul className="mk-sales">
            {log.map((s) => (
              <li key={s.id}>
                <span>{itemById(s.item)?.name ?? s.item}</span>
                <span className="muted small">
                  to {s.buyer} · {span(Date.now() - s.at)} ago
                </span>
                <strong>{coins(s.price)}</strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
