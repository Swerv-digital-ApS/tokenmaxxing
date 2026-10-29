import { editionLabel } from "@tokenmaxxing/core/merchant.ts";
import { cleanPetName, PET_NAME_MAX, PET_VARIANTS, petLooks, petOutfit } from "@tokenmaxxing/core/pets.ts";
import { FREE_OUTFITS, type Item, itemById, PODIUM_COINS } from "@tokenmaxxing/core/shop.ts";
import { shopForSlot } from "@tokenmaxxing/core/shoprooms.ts";
import { LOOK_OPTIONS, type Look, pieceOfDrop, STYLE_NAMES } from "@tokenmaxxing/core/world.ts";
import type { BagRow, Copy, Wallet } from "@tokenmaxxing/server/registry";
import { omit } from "hanzio";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { variantArt } from "../art/pet-variants/index.ts";
import { PET_H, PET_W, petFrame } from "../art/pets.ts";
import { errorText } from "../errors.ts";
import { startPlace } from "../game/furniture.ts";
import { world } from "../game/world.ts";
import { conn, refreshMe, refreshWallet, town } from "../net.ts";
import type { IconStage } from "../render3d/icons.ts";
import { graphics } from "../settings/graphics.ts";
import { hud, useHud } from "../store.ts";
import { coins } from "./format.ts";
import { ItemIcon, loadIcons } from "./ItemIcon.tsx";
import { ItemTag, rarityRing } from "./ItemTag.tsx";
import { lootLine, rarityClass } from "./Loot.tsx";
import { isWorn, sameLook, withItem, withoutMerchTop } from "./lookOps.ts";
import { merchName } from "./Merch.tsx";
import { ItemImage } from "./Shop.tsx";
import { TakeMeThere } from "./ShopDirectory.tsx";
import { buyHint, SLOT_NOUN } from "./shops.ts";
import { AvatarImage, Modal, Pills, Pixels, useRun } from "./ui.tsx";

export type BagTab = "you" | "pet" | "things";

const TABS = [
  ["you", "🧍 You"],
  ["pet", "🐾 Pet"],
  ["things", "📦 Everything"],
] as const;

/**
 * The bag, and the character and pet you dress from it, in one place. A live picture of you and your pet
 * beside three tabs: You (the free style, skin, hair and outfits, and what you hold to wear), Pet (which one,
 * its look, its gear, its name) and Everything (all you hold, to drop or put down). Changes are a draft until
 * Save, so trying things on costs nothing.
 */
export function Bag({ tab: wanted }: { tab?: BagTab }) {
  const me = useHud((s) => s.me);
  const wallet = useHud((s) => s.wallet);
  const notice = useHud((s) => s.notice);
  const [bag, setBag] = useState<BagRow[] | null>(null);
  // Merchant editions' numbers (`Merchant.tsx`).
  const [copies, setCopies] = useState<Copy[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [tab, setTab] = useState<BagTab>(wanted ?? "you");
  // What's being tried on, and the name typed: null while it's still what's saved.
  const [draft, setDraft] = useState<Look | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [petName, setPetName] = useState<string | null>(null);
  const { error, run } = useRun();
  // biome-ignore lint/correctness/useExhaustiveDependencies: a trade settling (a notice) or a changed wallet (a drop) can mean a new bag
  useEffect(() => {
    void town.bag().then(setBag, (e) => setFailed(errorText(e)));
    void town.copies().then(setCopies, () => {});
  }, [wallet, notice]);
  useEffect(() => {
    if (wanted) setTab(wanted);
  }, [wanted]);
  if (!me || !bag)
    return (
      <Modal title="🎒 Bag" wide="xl">
        {failed ?? "Loading…"}
      </Modal>
    );

  const look = draft ?? me.look;
  const typedPet = petName ?? me.look.petName ?? "";
  const cleanName = cleanPetName(typedPet);
  const badPetName = typedPet.trim() !== "" && !cleanName;
  const next: Look = look.pet
    ? cleanName
      ? { ...look, petName: cleanName }
      : omit(look, ["petName"])
    : omit(look, ["petName"]);
  const lookChanged = !sameLook(next, me.look);
  const nameChanged = name !== null && name.trim() !== me.name;
  const changed = lookChanged || nameChanged;
  const tryOn = (l: Look) => setDraft(l);
  const undo = () => {
    setDraft(null);
    setName(null);
    setPetName(null);
  };
  const save = run(async () => {
    if (lookChanged) await town.setLook(next);
    if (nameChanged) await town.rename(name!.trim());
    await refreshMe();
    undo();
  });
  // Dances aren't things to wear or drop: they're on the dance bar.
  const held = bag.flatMap((b) => {
    const it = itemById(b.item);
    return it && it.slot !== "dance" ? [{ row: b, item: it }] : [];
  });
  const owned = (slot: Item["slot"]) => held.filter((h) => h.item.slot === slot).map((h) => h.item);

  return (
    <Modal title="🎒 Bag" wide="xl">
      {wallet && <WalletInfo wallet={wallet} />}
      <div className="wardrobe">
        <Preview look={next} />
        <div className="wardrobe-side">
          <Pills value={tab} options={TABS} onChange={setTab} />
          {tab === "you" && (
            <You look={look} owned={owned} tryOn={tryOn} name={name ?? me.name} setName={setName} />
          )}
          {tab === "pet" && (
            <Pet
              look={look}
              owned={owned}
              tryOn={tryOn}
              petName={typedPet}
              setPetName={setPetName}
              badName={badPetName}
            />
          )}
          {tab === "things" && (
            <Things
              held={held}
              copies={copies}
              look={look}
              tryOn={(item) => {
                tryOn(withItem(item, look, true));
                setTab(item.slot === "pet" || item.slot === "petwear" ? "pet" : "you");
              }}
            />
          )}
        </div>
      </div>
      {(changed || error) && (
        <div className="wardrobe-save">
          {error && <p className="error">{error}</p>}
          {changed && (
            <>
              <span className="muted small">Not saved yet: others see you once you save.</span>
              <button type="button" onClick={undo}>
                Undo
              </button>
              <button type="button" className="primary" disabled={badPetName} onClick={save}>
                Save
              </button>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

/** You and your pet as the town will see you, the draft included: live and turnable in 3D, a sprite on Low. */
function Preview({ look }: { look: Look }) {
  const tier = useSyncExternalStore(graphics.subscribe, graphics.tier);
  const [flat, setFlat] = useState(false);
  if (tier !== "low" && !flat) return <Stage look={look} onFail={() => setFlat(true)} />;
  return (
    <div className="wardrobe-preview">
      <AvatarImage look={look} scale={10} />
      {look.pet > 0 && (
        <Pixels
          sprite={petFrame(look.pet, false, false, look.petVariant, petOutfit(look))}
          width={PET_W * 4}
          height={PET_H * 4}
          className="avatar pet"
        />
      )}
    </div>
  );
}

/** How big the stage is drawn, in CSS pixels. */
const STAGE_PX = 380;

/** The live 3D picture (`IconStage`): it sways on its own; drag to turn it. */
function Stage({ look, onFail }: { look: Look; onFail: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<IconStage | null>(null);
  const latest = useRef(look);
  latest.current = look;
  const dressed = useRef("");
  const drag = useRef<number | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: opened once; the look is read from `latest` each frame
  useEffect(() => {
    let live = true;
    let raf = 0;
    void loadIcons().then(
      (m) => {
        const out = canvas.current;
        const s = live && out ? m.IconStage.open(out) : null;
        if (!s) return live && onFail();
        stage.current = s;
        const px = m.devicePixels(128) * (STAGE_PX / 128);
        const tick = (now: number) => {
          const l = latest.current;
          const key = JSON.stringify(l);
          if (key !== dressed.current) {
            dressed.current = key;
            s.set(
              l,
              l.pet ? { pet: l.pet, variant: l.petVariant, name: l.petName ?? "", wear: l.petwear } : null,
            );
          }
          s.frame(now, Math.round(px));
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      () => live && onFail(),
    );
    return () => {
      live = false;
      cancelAnimationFrame(raf);
      stage.current?.dispose();
      stage.current = null;
    };
  }, []);
  return (
    <div className="wardrobe-preview stage">
      <canvas
        ref={canvas}
        className="turntable"
        style={{ width: STAGE_PX, height: STAGE_PX }}
        aria-label="You, as others see you. Drag to turn."
        onPointerDown={(e) => {
          drag.current = e.clientX;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current === null) return;
          stage.current?.spin(e.clientX - drag.current);
          drag.current = e.clientX;
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      />
      <span className="muted small">Drag to turn</span>
    </div>
  );
}

type Owned = (slot: Item["slot"]) => Item[];

/** The free outfits' numbers. */
const FREE = Array.from({ length: FREE_OUTFITS }, (_, i) => i);
/** The free parts that cycle: style, skin and hair. */
const CYCLES = { style: "Style", skin: "Skin", hair: "Hair" } as const;
/** What you wear from the bag, a row each. */
const WORN = [
  ["hat", "Hat"],
  ["glasses", "Glasses"],
  ["held", "In hand"],
  ["back", "On back"],
  ["aura", "Aura"],
] as const;

function You(props: {
  look: Look;
  owned: Owned;
  tryOn: (l: Look) => void;
  name: string;
  setName: (n: string) => void;
}) {
  const { look, owned, tryOn } = props;
  const cycle = (k: keyof typeof CYCLES, d: number) =>
    tryOn({ ...look, [k]: (look[k] + d + LOOK_OPTIONS[k]) % LOOK_OPTIONS[k] });
  const outfits = owned("outfit");
  const merch = owned("merch");
  return (
    <>
      <div className="wardrobe-cycles">
        {(Object.keys(CYCLES) as (keyof typeof CYCLES)[]).map((k) => (
          <div key={k} className="cycle">
            <button type="button" aria-label={`Previous ${CYCLES[k]}`} onClick={() => cycle(k, -1)}>
              ◀
            </button>
            <span>{k === "style" ? STYLE_NAMES[look.style] : `${CYCLES[k]} ${look[k] + 1}`}</span>
            <button type="button" aria-label={`Next ${CYCLES[k]}`} onClick={() => cycle(k, 1)}>
              ▶
            </button>
          </div>
        ))}
      </div>
      <Row label="Outfit">
        {FREE.map((i) => {
          const free = withoutMerchTop({ ...look, outfit: i });
          return (
            <Choice key={i} on={look.outfit === i} label={`Outfit ${i + 1}`} onClick={() => tryOn(free)}>
              <ItemIcon spec={{ kind: "avatar", look: free, focus: "body" }} size={52} className="avatar">
                <AvatarImage look={free} scale={3} />
              </ItemIcon>
            </Choice>
          );
        })}
        <Items items={outfits} look={look} tryOn={tryOn} />
        {outfits.length === 0 && <More slot="outfit" />}
      </Row>
      {/* Nothing sells an aura: the row is there once the case has given you one. */}
      {WORN.filter(([slot]) => slot !== "aura" || owned(slot).length > 0 || look.aura).map(
        ([slot, label]) => (
          <Row key={slot} label={label}>
            <Choice on={(look[slot] ?? 0) === 0} label="None" onClick={() => tryOn({ ...look, [slot]: 0 })}>
              <span className="none">—</span>
            </Choice>
            <Items items={owned(slot)} look={look} tryOn={tryOn} />
            {owned(slot).length === 0 && <More slot={slot} />}
          </Row>
        ),
      )}
      {merch.length > 0 && (
        <Row label="Merch">
          <Items items={merch} look={look} tryOn={tryOn} toggle />
        </Row>
      )}
      <label className="field">
        Name
        <input value={props.name} onChange={(e) => props.setName(e.target.value)} maxLength={32} />
      </label>
    </>
  );
}

function Pet(props: {
  look: Look;
  owned: Owned;
  tryOn: (l: Look) => void;
  petName: string;
  setPetName: (n: string) => void;
  badName: boolean;
}) {
  const { look, owned, tryOn } = props;
  const pets = owned("pet");
  if (pets.length === 0)
    return (
      <p className="muted">
        No pet yet. <More slot="pet" />
      </p>
    );
  const pet = itemById(`pet.${look.pet}`);
  return (
    <>
      <Row label="Pet">
        <Choice on={look.pet === 0} label="No pet" onClick={() => tryOn(withItem(pets[0]!, look, false))}>
          <span className="none">—</span>
        </Choice>
        <Items items={pets} look={look} tryOn={tryOn} />
      </Row>
      {pet && look.pet > 0 && (
        <>
          {petLooks(look.pet) > 1 && (
            <Row label="Look">
              {Array.from({ length: petLooks(look.pet) }, (_, v) => {
                const soon = v > 0 && variantArt(look.pet, v) === null;
                const label = `${variantName(look.pet, v)}${soon ? " (coming soon)" : ""}`;
                return (
                  <Choice
                    key={PET_VARIANTS[look.pet]?.[v - 1] ?? "original"}
                    on={look.petVariant === v}
                    label={label}
                    onClick={() => tryOn({ ...look, petVariant: v })}
                  >
                    <ItemIcon spec={{ kind: "pet", pet: look.pet, variant: v }} size={52} className="avatar">
                      <Pixels
                        sprite={petFrame(look.pet, false, false, v, null)}
                        width={PET_W * 2}
                        height={PET_H * 2}
                        className="avatar"
                      />
                    </ItemIcon>
                  </Choice>
                );
              })}
            </Row>
          )}
          <Row label="Gear">
            <Choice on={look.petwear === 0} label="None" onClick={() => tryOn({ ...look, petwear: 0 })}>
              <span className="none">—</span>
            </Choice>
            <Items items={owned("petwear")} look={look} tryOn={tryOn} />
            {owned("petwear").length === 0 && <More slot="petwear" />}
          </Row>
          <label className="field">
            {pet.name}'s name
            <input
              value={props.petName}
              maxLength={PET_NAME_MAX}
              placeholder="No name"
              onChange={(e) => props.setPetName(e.target.value)}
            />
          </label>
          {props.badName && <p className="error small">Letters, digits, spaces, ' and - only.</p>}
        </>
      )}
    </>
  );
}

/**
 * Everything held, a square per kind with how many. Picking one shows its name and what it can do: try it on,
 * drop it (onto the floor where I am: in my own office, that's furnishing it). 🏅 is a reward: it stays with
 * me, but an earned piece (Touched grass) can furnish my own office.
 */
function Things(props: {
  held: { row: BagRow; item: Item }[];
  copies: Copy[];
  look: Look;
  tryOn: (item: Item) => void;
}) {
  const { held, copies, look } = props;
  const inMyOffice = useHud((s) => s.room === `office:${world.selfId}`);
  const [picked, setPicked] = useState<string | null>(null);
  const [dropped, setDropped] = useState<string | null>(null);
  const { error, run } = useRun();
  const grid = useRef<HTMLUListElement>(null);
  const putAway = run(async () => {
    setDropped(null);
    const r = await conn.putAway();
    setDropped(r.notice);
    await Promise.all([refreshMe(), refreshWallet()]);
  });
  const drop = (id: string) =>
    run(async () => {
      setDropped(null); // a refused one shows only its error
      const r = await town.drop(id);
      setDropped(r.notice);
      if (r.drop) {
        // One fewer on 🎒, and the new wallet refetches the bag.
        hud.set((s) => ({ wallet: s.wallet && { ...s.wallet, items: s.wallet.items - 1 } }));
        // The last one takes its Drop button with it: focus goes back to the dialog, not the page.
        if (held.find((h) => h.item.id === id)?.row.count === 1)
          grid.current?.closest<HTMLElement>("[role=dialog]")?.focus();
      }
      await refreshMe(); // a worn one comes off
    });
  // The last one dropped leaves nothing picked.
  const item = held.find((h) => h.item.id === picked)?.item;
  const piece = item && pieceOfDrop({ item: item.id });

  return (
    <>
      {held.length === 0 && <p className="muted">Nothing yet. Things are bought in the shops.</p>}
      {item && (
        <div className="bag-pick">
          <strong>
            {item.level !== undefined && "🏅 "}
            {merchName(item)}
            <Numbers copies={copies} item={item.id} />
            {item.loot && (
              <span className={`small rarity-text-${item.loot.rarity}`}> · {lootLine(item)}</span>
            )}
            <ItemTag item={item} />
          </strong>
          {item.earned && (
            <span className="muted small">
              {item.earned}.{!inMyOffice && " Drop it in your own office."}
            </span>
          )}
          {item.slot !== "furniture" && !isWorn(item, look) && (
            <button type="button" onClick={() => props.tryOn(item)}>
              Try on
            </button>
          )}
          {(item.tradeable || (item.earned && inMyOffice)) && (
            <button type="button" onClick={piece && inMyOffice ? () => startPlace(item.id) : drop(item.id)}>
              {piece && inMyOffice ? "Place…" : inMyOffice ? "Drop here" : "Drop"}
            </button>
          )}
        </div>
      )}
      {inMyOffice && (
        <p className="muted small">
          <button type="button" onClick={putAway}>
            Put everything in this room away
          </button>
        </p>
      )}
      {dropped && <p className="muted">{dropped}</p>}
      {error && <p className="error">{error}</p>}
      <ul className="bag" ref={grid}>
        {held.map(({ row, item: it }) => {
          const wearing = isWorn(it, look);
          return (
            <li key={row.item}>
              <button
                type="button"
                className={`${wearing ? "cell wearing" : "cell"}${rarityClass(it)}`}
                aria-pressed={row.item === picked}
                aria-label={`${merchName(it)} ×${row.count}${wearing ? ", wearing" : ""}${it.level === undefined ? "" : ", reward"}`}
                title={it.loot ? `${merchName(it)}\n${lootLine(it)}` : merchName(it)}
                style={rarityRing(it)}
                onClick={() => setPicked(row.item)}
              >
                <ItemImage item={it} look={look} bare worn />
                {it.level !== undefined && <span className="medal">🏅</span>}
                {copies.some((c) => c.item === row.item) && (
                  <span className="medal">#{copies.find((c) => c.item === row.item)!.n}</span>
                )}
                {row.count > 1 && <span className="n">×{row.count}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <ShopHints missing={HINT_SLOTS.filter((slot) => !held.some((h) => h.item.slot === slot))} />
    </>
  );
}

/** A labelled row of choices. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="wardrobe-row">
      <span className="wardrobe-label">{label}</span>
      <div className="wardrobe-choices">{children}</div>
    </div>
  );
}

/** One square to pick: lit when it's what the draft wears. */
function Choice(props: { on: boolean; label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={props.on ? "cell wearing" : "cell"}
      aria-pressed={props.on}
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

/** Held items as choices: picking one wears it (merch, `toggle`, goes on and off; the rest swap). */
function Items(props: { items: Item[]; look: Look; tryOn: (l: Look) => void; toggle?: boolean }) {
  const { look, tryOn } = props;
  return props.items.map((it) => {
    const on = isWorn(it, look);
    return (
      <Choice
        key={it.id}
        on={on}
        label={merchName(it)}
        onClick={() => tryOn(withItem(it, look, props.toggle ? !on : true))}
      >
        <ItemImage item={it} look={look} bare worn />
      </Choice>
    );
  });
}

/** Where to find one for a slot you hold none of. */
function More({ slot }: { slot: Item["slot"] }) {
  const shop = shopForSlot(slot);
  const noun = SLOT_NOUN[slot] ?? slot;
  return shop ? (
    <TakeMeThere
      shop={shop}
      className="link small"
      title={buyHint(slot, noun) ?? undefined}
      label={`Find ${noun} ›`}
    />
  ) : null;
}

/** A look's name: "Original", the art's name, or (while the art is missing) its id. */
function variantName(pet: number, variant: number): string {
  if (variant === 0) return "Original";
  const id = PET_VARIANTS[pet]?.[variant - 1] ?? "";
  return variantArt(pet, variant)?.name ?? id.charAt(0).toUpperCase() + id.slice(1);
}

/** The slots the bag hints at, when it holds nothing of them. */
const HINT_SLOTS = ["hat", "outfit", "pet", "furniture"] as const;

const HINT_ICON: Record<(typeof HINT_SLOTS)[number], string> = {
  hat: "🎩",
  outfit: "👕",
  pet: "🐾",
  furniture: "🛋",
};

/** A way to the shop for each slot you have nothing in: "Find more: 🎩 Hats 👕 Outfits". */
function ShopHints({ missing }: { missing: readonly (typeof HINT_SLOTS)[number][] }) {
  if (missing.length === 0) return null;
  return (
    <p className="bag-more muted small">
      Find more:
      {missing.map((slot) => {
        const shop = shopForSlot(slot);
        const noun = SLOT_NOUN[slot] ?? slot;
        return (
          shop && (
            <TakeMeThere
              key={slot}
              shop={shop}
              className=""
              title={buyHint(slot, noun) ?? undefined}
              label={`${HINT_ICON[slot]} ${noun[0]!.toUpperCase()}${noun.slice(1)}`}
            />
          )
        );
      })}
    </p>
  );
}

/** The wallet at the top of the bag: coins, today's take (how it's earned on hover), the quests still open today. */
function WalletInfo({ wallet }: { wallet: Wallet }) {
  return (
    <>
      <p className="wallet">
        <strong>{coins(wallet.balance)}</strong>{" "}
        <span
          className="muted small"
          title={`Every day you earn √(tokens ÷ 1M) coins: 100M tokens is 10, 1B is 31. Finish a day 1st, 2nd or 3rd for ${PODIUM_COINS.join(", ")} more.`}
        >
          +{wallet.today} today ⓘ
        </span>
      </p>
      {wallet.quests.some((q) => !q.done) && (
        <ul className="members">
          {wallet.quests
            .filter((q) => !q.done)
            .map((q) => (
              <li key={q.id} className="muted">
                <span>○ {q.text}</span>
                <span>🪙 {q.coins}</span>
              </li>
            ))}
        </ul>
      )}
    </>
  );
}

/** " · #3 of 20, #7 of 20": the numbers on my copies of a merchant edition. */
function Numbers({ copies, item }: { copies: Copy[]; item: string }) {
  const mine = copies.filter((c) => c.item === item);
  if (mine.length === 0) return null;
  return <span className="edition"> · {mine.map((c) => editionLabel(c.n, c)).join(", ")}</span>;
}
