import { DECORS, type DecorKind } from "@tokenmaxxing/core/decor.ts";
import { DESKS, effectiveDesk, nextFleet } from "@tokenmaxxing/core/desks.ts";
import { OFFICE_SIZES } from "@tokenmaxxing/core/office.ts";
import { useEffect, useState } from "react";
import { deskFrame } from "../art/desks.ts";
import { decorSwatch } from "../art/tiles.ts";
import { world } from "../game/world.ts";
import { refreshMe, refreshWallet, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { coins } from "./format.ts";
import { ItemIcon } from "./ItemIcon.tsx";
import { BuyAtMobelhuset } from "./ShopDirectory.tsx";
import { Pills, Pixels, useRun } from "./ui.tsx";

/**
 * What furnishes a room besides pieces: wallpaper and floors, monitor setups and the company's house desks.
 * One set of lists for two places: Møbelhuset's tabs (`buy`: with prices and Buy buttons) and the "My room"
 * panels in the menus (no `buy`: you only apply what you own, and are pointed at the shop for the rest).
 */

const KINDS = [
  ["wall", "Wallpaper"],
  ["floor", "Floors"],
] as const;

/** What my office wears now, if I can tell: I am standing in it. Otherwise the last one I applied. */
const applied: { wall?: string | null; floor?: string | null } = {};
const wearing = (kind: DecorKind): string | null | undefined => {
  const o = world.owner;
  if (o && o.id === world.selfId) return (kind === "wall" ? o.wall : o.floor) ?? null;
  return applied[kind];
};

/** A wallpaper or floor sample: the way a room draws it. */
export const DecorSample = ({ kind, id }: { kind: DecorKind; id: string }) => (
  <Pixels sprite={decorSwatch(kind, id)} width={96} height={64} className="avatar" label={`${kind} sample`} />
);

/** A setup's desk with its screens on, 4× in a box. */
export const DeskPreview = ({ tier, mode = "lit" }: { tier: number; mode?: "lit" | "off" }) => (
  <ItemIcon spec={{ kind: "desk", tier }} size={88} className="avatar">
    <Pixels sprite={deskFrame(tier, mode)} width={64} height={88} scale={4} stand className="avatar" />
  </ItemIcon>
);

const SIZE_NAMES = ["Starter", "Roomy", "Spacious", "Grand"] as const;

/** How big my office is, and the next size up: bought once each, in order, and the room grows at once. */
function OfficeSpace({ buy }: { buy: boolean }) {
  const wallet = useHud((s) => s.wallet);
  const [tier, setTier] = useState<number | null>(null);
  const { error, run } = useRun();
  useEffect(() => {
    void town.officeSize().then(setTier);
  }, []);
  if (!wallet || tier === null) return null;
  const next = OFFICE_SIZES[tier + 1];
  const size = OFFICE_SIZES[tier]!;
  const purchase = () =>
    run(async () => {
      hud.set({ wallet: await town.buyOfficeSize() });
      setTier(await town.officeSize());
    });
  return (
    <>
      <p className="muted small">
        Your office is {SIZE_NAMES[tier]}, {size.w}×{size.h}.{" "}
        {next
          ? "A bigger one takes more furniture and keeps what is in yours."
          : "It is as big as they come."}
      </p>
      {next &&
        (buy ? (
          <button
            type="button"
            className="primary"
            disabled={wallet.balance < next.price}
            onClick={purchase()}
          >
            Expand to {SIZE_NAMES[tier + 1]} {next.w}×{next.h} · 🪙 {next.price}
          </button>
        ) : (
          <span className="muted small">
            {SIZE_NAMES[tier + 1]} {next.w}×{next.h}: 🪙 {next.price} at Møbelhuset
          </span>
        ))}
      {error && <p className="error">{error}</p>}
    </>
  );
}

/** Wallpaper and floors: buy one once (in the shop), then change between yours whenever you like. */
export function DecorGoods({ buy }: { buy: boolean }) {
  const wallet = useHud((s) => s.wallet);
  const [kind, setKind] = useState<DecorKind>("wall");
  const [owned, setOwned] = useState<string[] | null>(null);
  const [now, setNow] = useState(() => ({ wall: wearing("wall"), floor: wearing("floor") }));
  const { error, run } = useRun();
  useEffect(() => {
    void refreshWallet();
    void town.decorOwned().then(setOwned);
    void town.decorNow().then((d) => {
      applied.wall = d.wall;
      applied.floor = d.floor;
      setNow(d);
    });
  }, []);
  if (!wallet || !owned) return <p className="muted">Loading…</p>;

  const plain = DECORS[kind][0]!.id;
  const set = (v: string | null) => {
    applied[kind] = v;
    setNow((n) => ({ ...n, [kind]: v }));
  };
  const use = (id: string) =>
    run(async () => {
      await town.setDecor(kind, id === plain ? null : id);
      set(id === plain ? null : id);
    });
  const purchase = (id: string) =>
    run(async () => {
      hud.set({ wallet: await town.buyDecor(kind, id) });
      setOwned(await town.decorOwned());
      await town.setDecor(kind, id);
      set(id);
    });

  return (
    <>
      <p className="muted small">
        {buy
          ? "Buy one once, then change between yours whenever you like. Apply puts it on your own office."
          : "Change between the ones you own whenever you like. New ones are bought at Møbelhuset."}
      </p>
      {!buy && <BuyAtMobelhuset tab="decor" />}
      <OfficeSpace buy={buy} />
      <Pills value={kind} options={KINDS} onChange={setKind} />
      <ul className="shop">
        {DECORS[kind].map((d) => {
          const has = owned.includes(`${kind}.${d.id}`);
          const current = now[kind];
          const using = current === undefined ? false : (current ?? plain) === d.id;
          return (
            <li key={d.id} className={using ? "wearing" : undefined}>
              <DecorSample kind={kind} id={d.id} />
              <strong>{d.name}</strong>
              <span className="muted small">{d.blurb}</span>
              {has ? (
                <button type="button" disabled={using} onClick={use(d.id)}>
                  {using ? "In use" : "Apply"}
                </button>
              ) : d.level !== undefined ? (
                <button type="button" disabled>
                  🔒 Lv {d.level}
                </button>
              ) : buy ? (
                <button
                  type="button"
                  className="primary"
                  disabled={wallet.balance < d.price}
                  onClick={purchase(d.id)}
                >
                  🪙 {d.price}
                </button>
              ) : (
                <span className="muted small">🪙 {d.price} at Møbelhuset</span>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="error">{error}</p>}
    </>
  );
}

/** My desk setups, all looks and no edge: bought once with my coins (or earned by level), then switched for free. */
export function DeskGoods({ buy }: { buy: boolean }) {
  const wallet = useHud((s) => s.wallet);
  const [mine, setMine] = useState<{ owned: string[]; using: string } | null>(null);
  const { error, run } = useRun();
  useEffect(() => {
    void refreshWallet();
    void town.deskOwned().then(setMine);
  }, []);
  if (!wallet || !mine) return <p className="muted">Loading…</p>;

  const reload = async () => setMine(await town.deskOwned());
  const use = (id: string) =>
    run(async () => {
      await town.setDesk(id);
      await reload();
    });
  const purchase = (id: string) =>
    run(async () => {
      hud.set({ wallet: await town.buyDesk(id) });
      await town.setDesk(id);
      await reload();
    });

  return (
    <>
      <p className="muted small">
        Just for looks: everyone sees your setup when you sit at a desk.{" "}
        {buy
          ? "Buy one once, then switch between yours for free."
          : "Switch between yours for free; new ones are bought at Møbelhuset."}
      </p>
      {!buy && <BuyAtMobelhuset tab="desk" />}
      <ul className="shop">
        {DESKS.map((d, i) => {
          const has = mine.owned.includes(d.id);
          const using = mine.using === d.id;
          return (
            <li key={d.id} className={using ? "wearing" : undefined}>
              <DeskPreview tier={i} />
              <strong>{d.name}</strong>
              <span className="muted small">
                {d.blurb}
                {!has && d.level !== undefined && ` Free at Lv ${d.level}.`}
              </span>
              {has ? (
                <button type="button" disabled={using} onClick={use(d.id)}>
                  {using ? "In use" : "Apply"}
                </button>
              ) : buy ? (
                <button
                  type="button"
                  className="primary"
                  disabled={wallet.balance < d.price}
                  onClick={purchase(d.id)}
                >
                  🪙 {d.price}
                </button>
              ) : (
                <span className="muted small">🪙 {d.price} at Møbelhuset</span>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="error">{error}</p>}
    </>
  );
}

/**
 * The company's house desks: every desk in the house gets this setup, whoever sits there. The wallet pays
 * (and the owner buys the next tier, in the shop); outside the shop it only shows the tier.
 */
export function DeskFleet({ buy }: { buy: boolean }) {
  const co = useHud((s) => s.me?.company);
  const [mine, setMine] = useState<{ using: string } | null>(null);
  const { error, run } = useRun();
  useEffect(() => {
    void town.deskOwned().then(setMine);
  }, []);
  if (!co) return null;
  const next = nextFleet(co.deskFleet);
  const personal = DESKS.findIndex((d) => d.id === mine?.using);
  const shows = effectiveDesk(Math.max(0, personal), co.deskFleet);

  return (
    <>
      <h3>🏢 {co.name}: house desks</h3>
      {!buy && (
        <p className="wallet">
          <strong>{coins(co.wallet)}</strong> in the company wallet
        </p>
      )}
      <p className="muted small">
        Every desk in the house gets this setup, whoever sits there. The wallet pays and the owner buys the
        next one. In the house you see the better of yours and this.
      </p>
      <ul className="shop">
        <li className="wearing">
          <DeskPreview tier={co.deskFleet} />
          <strong>{DESKS[co.deskFleet]?.name ?? DESKS[0]!.name}</strong>
          <span className="muted small">The house's desks now</span>
        </li>
        {next && (
          <li>
            <DeskPreview tier={next.tier} />
            <strong>{next.setup.name}</strong>
            {buy && co.isOwner ? (
              <button
                type="button"
                className="primary"
                disabled={co.wallet < next.setup.fleet}
                onClick={run(async () => {
                  await town.buyDeskFleet();
                  await refreshMe();
                })}
              >
                Buy · 🪙 {next.setup.fleet}
              </button>
            ) : (
              <span className="muted small">
                🪙 {next.setup.fleet} {buy ? "· the owner buys it" : "at Møbelhuset"}
              </span>
            )}
          </li>
        )}
      </ul>
      {!next && <p className="muted small">The house has the best setup there is.</p>}
      {mine && <p className="muted small">At a desk in your house you show: {DESKS[shows]!.name}.</p>}
      {error && <p className="error">{error}</p>}
    </>
  );
}
