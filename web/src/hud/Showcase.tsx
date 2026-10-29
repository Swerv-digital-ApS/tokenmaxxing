import { PIN_MAX, type PinView } from "@tokenmaxxing/core/collection.ts";
import { RARITY_COLOR } from "@tokenmaxxing/core/rarity.ts";
import { useState } from "react";
import { badgeFrame, FRAME_SIZE, TROPHY_H, TROPHY_W, trophySprite } from "../art/trophies.ts";
import { town } from "../net.ts";
import { dayText } from "./format.ts";
import { ItemIcon } from "./ItemIcon.tsx";
import { Pixels, useLoad, useRun } from "./ui.tsx";

const SCALE = 3;
const SIZE = FRAME_SIZE * SCALE;
const DATE = { day: "numeric", month: "short", year: "numeric" } as const;

/** A pin's picture: a badge's tier frame with its emoji in it, or the trophy. */
function PinIcon({ pin }: { pin: PinView }) {
  if (pin.kind === "trophy") {
    const id = pin.id.slice(pin.id.indexOf(":") + 1);
    return (
      <ItemIcon spec={{ kind: "trophy", id }} size={TROPHY_H * SCALE} label={pin.name}>
        <Pixels
          sprite={trophySprite(id, true)}
          width={TROPHY_W * SCALE}
          height={TROPHY_H * SCALE}
          label={pin.name}
        />
      </ItemIcon>
    );
  }
  return (
    <span className="entry-icon">
      {pin.frame && <Pixels sprite={badgeFrame(pin.frame)} width={SIZE} height={SIZE} />}
      <span className="entry-emoji">{pin.emoji}</span>
    </span>
  );
}

const earned = (pin: PinView) => (pin.at ? dayText(new Date(pin.at).toISOString().slice(0, 10), DATE) : null);

/** The card's shelf: three slots, what's pinned in each, and (on my own card) a button to change it. */
export function Shelf({ pins, mine, onEdit }: { pins: PinView[]; mine: boolean; onEdit: () => void }) {
  if (pins.length === 0 && !mine) return null;
  // An empty shelf of mine is just the way to fill it, not three empty boxes.
  if (pins.length === 0)
    return (
      <button type="button" className="link small" onClick={onEdit}>
        📌 Pin something to your shelf
      </button>
    );
  return (
    <section className="shelf" aria-label="Showcase">
      <ul>
        {Array.from({ length: PIN_MAX }, (_, i) => {
          const pin = pins[i];
          return pin ? (
            <li key={pin.id} title={`${pin.name}${earned(pin) ? ` · ${earned(pin)}` : ""}`}>
              <PinIcon pin={pin} />
              <span className="small">{pin.name}</span>
            </li>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: an empty slot has no identity
            <li key={`empty${i}`} className="empty" aria-hidden="true" />
          );
        })}
      </ul>
      {mine && (
        <button type="button" className="link small" onClick={onEdit}>
          {pins.length ? "✏️ Edit shelf" : "📌 Pin something to your shelf"}
        </button>
      )}
    </section>
  );
}

/**
 * Pick up to three things you've earned for your shelf. The same grid as the bag: a square each, the
 * picked ones ringed with a number, and the one you last touched named above with its rarity.
 */
export function ShelfPicker({
  current,
  onSaved,
  onCancel,
}: {
  current: PinView[];
  onSaved: (pins: PinView[]) => void;
  onCancel: () => void;
}) {
  const { data: options, error: loadError } = useLoad(() => town.showcaseOptions(), []);
  const [ids, setIds] = useState<string[]>(() => current.map((p) => p.id));
  const [shown, setShown] = useState<string | null>(null);
  const { error, busy, run } = useRun();
  if (!options) return <p className="muted">{loadError ?? "Loading…"}</p>;
  const toggle = (id: string) => {
    setShown(id);
    setIds((now) =>
      now.includes(id) ? now.filter((x) => x !== id) : now.length < PIN_MAX ? [...now, id] : now,
    );
  };
  const named = options.find((o) => o.id === (shown ?? ids.at(-1)));
  const save = run(async () => onSaved(await town.setShowcase(ids)));
  return (
    <section className="shelf-picker" aria-label="Pick your showcase">
      <div className="bag-pick">
        {named ? (
          <strong>
            <span className="item-tag">
              {named.name}{" "}
              <span className="rarity" style={{ color: RARITY_COLOR[named.rarity] }}>
                {named.rarity}
              </span>
              {earned(named) && <span className="muted"> · {earned(named)}</span>}
            </span>
          </strong>
        ) : (
          <span className="muted">
            {options.length ? `Pick up to ${PIN_MAX} to show on your card.` : "Nothing earned yet to pin."}
          </span>
        )}
      </div>
      <ul className="bag">
        {options.map((o) => {
          const at = ids.indexOf(o.id);
          return (
            <li key={o.id}>
              <button
                type="button"
                className="cell"
                aria-pressed={at >= 0}
                aria-label={`${o.name}, ${o.rarity}${at >= 0 ? `, pinned ${at + 1}` : ""}`}
                title={o.name}
                style={{
                  backgroundImage: `linear-gradient(to top, ${RARITY_COLOR[o.rarity]} 3px, transparent 3px)`,
                }}
                onClick={() => toggle(o.id)}
              >
                <PinIcon pin={o} />
                {at >= 0 && <span className="n">{at + 1}</span>}
              </button>
              <span className="pick-name" aria-hidden="true">
                {o.name}
                <span style={{ color: RARITY_COLOR[o.rarity] }}>{o.frame ?? o.rarity}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {(error || loadError) && <p className="error">{error ?? loadError}</p>}
      <p>
        <button type="button" onClick={save} disabled={busy}>
          Save
        </button>{" "}
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </p>
    </section>
  );
}
