import { DANCES, type Dance, knownDances } from "@tokenmaxxing/core/dances.ts";
import { SHOPS, shopOfRoom } from "@tokenmaxxing/core/shoprooms.ts";
import { type MouseEvent, useEffect } from "react";
import { errorText } from "../errors.ts";
import { goToShopDoor } from "../game/input.ts";
import { showMyDance, world } from "../game/world.ts";
import { conn, refreshWallet } from "../net.ts";
import { hud, useHud } from "../store.ts";

/**
 * The dance bar, over the quick replies: a button for every dance I know. One starts it, anywhere, and it goes on
 * until I press it again, pick another, walk or sit down. The last button is the way to the rest of them.
 */
export function DanceBar({ onError }: { onError: (message: string | null) => void }) {
  const owned = useHud((s) => s.wallet?.owned);
  const dancing = useHud((s) => s.dancing);
  const inShop = useHud((s) => shopOfRoom(s.room) === "clothes");
  const hasPet = useHud((s) => !!s.me?.look.pet);
  useEffect(() => {
    if (!owned) void refreshWallet().catch(() => {});
  }, [owned]);
  const known = knownDances(owned ?? []);
  const more = DANCES.length - known.length;

  const pick = (d: Dance) => async (e: MouseEvent<HTMLButtonElement>) => {
    // Let go of focus, or Space (jump) would press the button again.
    e.currentTarget.blur();
    onError(null);
    const was = hud.get().dancing;
    const next = was === d.index ? 0 : d.index;
    const me = world.avatars.get(world.selfId);
    if (next && me && me.state !== "idle") return onError("Get up first: you dance on your feet.");
    showMyDance(next);
    try {
      await conn.dance(next);
    } catch (err) {
      showMyDance(was);
      onError(errorText(err));
    }
  };

  return (
    <section className="panel dance-bar" aria-label="Dances">
      {known.map((d) => (
        <button
          key={d.index}
          type="button"
          className={d.aura ? "aura" : undefined}
          aria-pressed={dancing === d.index}
          aria-label={dancing === d.index ? `Stop ${d.name}` : `Dance ${d.name}`}
          title={dancing === d.index ? `${d.name}: click to stop` : d.name}
          style={d.aura ? { ["--aura" as string]: d.aura } : undefined}
          onClick={pick(d)}
        >
          {d.emoji}
        </button>
      ))}
      {hasPet && (
        <button
          type="button"
          title="Your pet: pet it, give it a treat, a trick (P)"
          aria-label="Your pet"
          onClick={(e) => {
            e.currentTarget.blur();
            hud.set((s) => ({ petMenu: !s.petMenu }));
          }}
        >
          🐾
        </button>
      )}
      {more > 0 && (
        <button
          type="button"
          className="dance-more"
          title={`${more} more at ${SHOPS.clothes.name}`}
          aria-label={`${more} more dances at ${SHOPS.clothes.name}`}
          onClick={(e) => {
            e.currentTarget.blur();
            if (inShop) hud.set({ panel: { kind: "shop", tab: "dance" } });
            else if (!goToShopDoor("clothes"))
              onError(`${SHOPS.clothes.name} has no door in town right now.`);
          }}
        >
          +{more}
        </button>
      )}
    </section>
  );
}
