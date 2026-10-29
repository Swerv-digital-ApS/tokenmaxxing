import { BADGES, frameOf, progressOf } from "@tokenmaxxing/core/badges.ts";
import {
  CATALOG,
  type CatalogEntry,
  type CollectionState,
  GROUPS,
  owned,
} from "@tokenmaxxing/core/collection.ts";
import { compact } from "@tokenmaxxing/core/format.ts";
import { TIER_COLOR } from "@tokenmaxxing/core/rarity.ts";
import { useState } from "react";
import { badgeFrame, FRAME_SIZE, TROPHY_H, TROPHY_W, trophySprite } from "../art/trophies.ts";
import { world } from "../game/world.ts";
import { town } from "../net.ts";
import { hud } from "../store.ts";
import { dayText } from "./format.ts";
import { ItemIcon } from "./ItemIcon.tsx";
import { Modal, Pills, Pixels, useLoad } from "./ui.tsx";

const SCALE = 3;
const SIZE = FRAME_SIZE * SCALE;
const DATE = { day: "numeric", month: "short", year: "numeric" } as const;

type Tab = (typeof GROUPS)[number] | "All";
const TABS: readonly (readonly [Tab, string])[] = [["All", "All"], ...GROUPS.map((g) => [g, g] as const)];

/** What someone has of one catalogue entry: its tier (0: not yet), the line about it and how far to the next. */
function standing(state: CollectionState, e: CatalogEntry) {
  const key = e.id.slice(e.id.indexOf(":") + 1);
  if (e.kind === "trophy") {
    const t = state.trophies.find((x) => x.id === key);
    return { tier: +!!t, line: t ? `Earned ${dayText(t.day, DATE)}` : null, bar: null };
  }
  if (e.kind === "title") return { tier: +state.titles.includes(Number(key)), line: null, bar: null };
  const b = state.badges.find((x) => x.id === key);
  const def = BADGES.find((x) => x.id === key);
  if (!b || !def) return { tier: 0, line: null, bar: null };
  const prev = b.tier ? def.tiers[b.tier - 1]!.at : 0;
  const next = def.tiers[b.tier] ?? null;
  const unit = key === "cache" ? "%" : "";
  return {
    tier: b.tier,
    line: b.tier
      ? `${def.tiers[b.tier - 1]!.label}${b.at ? ` · ${new Date(b.at).toLocaleDateString("en-GB", DATE)}` : ""}`
      : null,
    bar: next && {
      frac: progressOf({ value: b.value, next, prev }),
      text: `${compact(b.value)}${unit} / ${compact(next.at)}${unit} for ${next.label}`,
    },
  };
}

function Icon({ e, tier }: { e: CatalogEntry; tier: number }) {
  const key = e.id.slice(e.id.indexOf(":") + 1);
  if (e.kind === "trophy")
    return (
      <ItemIcon spec={{ kind: "trophy", id: key, earned: tier > 0 }} size={TROPHY_H * SCALE} label={e.name}>
        <Pixels
          sprite={trophySprite(key, tier > 0)}
          width={TROPHY_W * SCALE}
          height={TROPHY_H * SCALE}
          label={e.name}
        />
      </ItemIcon>
    );
  if (e.kind === "title") return <span className="entry-emoji">🏅</span>;
  const def = BADGES.find((x) => x.id === key)!;
  const frame = frameOf(Math.max(tier, 1), def.tiers.length);
  return (
    <span className="entry-icon">
      <Pixels sprite={badgeFrame(frame)} width={SIZE} height={SIZE} />
      <span className="entry-emoji">{def.emoji}</span>
    </span>
  );
}

/** Everything there is to earn, with what you have in colour and the rest greyed out, and how to get it. */
export function Collection({ userId }: { userId?: number }) {
  const id = userId ?? world.selfId;
  const { data, error } = useLoad(() => town.collection(id), [id]);
  const [tab, setTab] = useState<Tab>("All");
  const title = "📖 Collection";
  if (!data) return <Modal title={title}>{error ?? "Loading…"}</Modal>;
  const { have, of } = owned(data);
  const shown = CATALOG.filter((e) => tab === "All" || e.group === tab);
  return (
    <Modal title={title} wide>
      <p className="muted">
        {have} of {of}. Each badge tier and trophy pays coins, once.{" "}
        <button type="button" className="link" onClick={() => hud.set({ panel: { kind: "hallOfFame" } })}>
          🏆 Hall of Fame
        </button>
      </p>
      <Pills value={tab} options={TABS} onChange={setTab} />
      <ul className="collection">
        {shown.map((e) => {
          const s = standing(data, e);
          return (
            <li key={e.id} className={s.tier ? "" : "unearned"}>
              <Icon e={e} tier={s.tier} />
              <span>
                <strong>{e.name}</strong>
                <span className="muted small">{s.tier ? (s.line ?? e.how) : e.how}</span>
                {s.bar && (
                  <span className="badge-bar" title={s.bar.text}>
                    <i
                      style={{
                        width: `${s.bar.frac * 100}%`,
                        background: s.tier ? tierColor(e, s.tier) : undefined,
                      }}
                    />
                  </span>
                )}
                {s.bar && <span className="muted small">{s.bar.text}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

const tierColor = (e: CatalogEntry, tier: number): string => {
  const def = BADGES.find((x) => `badge:${x.id}` === e.id);
  return def ? TIER_COLOR[frameOf(tier, def.tiers.length)] : TIER_COLOR.gold;
};
