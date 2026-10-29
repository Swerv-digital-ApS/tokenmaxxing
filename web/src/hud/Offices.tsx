import { directory, OFFICE_LEVEL, OFFICE_SIZES } from "@tokenmaxxing/core/office.ts";
import { send, walkTo } from "../game/input.ts";
import { world } from "../game/world.ts";
import { conn, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { DecorGoods } from "./RoomGoods.tsx";
import { Modal, useLoad, WalletLine } from "./ui.tsx";

/**
 * My room's wallpaper and floor: choose between the ones I own. Nothing is sold here; the shop is Møbelhuset
 * ("Wallpaper & floors").
 */
export function DecorPanel() {
  const wallet = useHud((s) => s.wallet);
  return (
    <Modal title="🏠 My room: wallpaper, floors & space" wide>
      {wallet && <WalletLine balance={wallet.balance} />}
      <DecorGoods buy={false} />
    </Modal>
  );
}

const SIZE_NAMES = ["Starter", "Roomy", "Spacious", "Grand"] as const;

/** The board of open offices: who's welcome, and how busy they've been this week. */
export function OpenOfficesPanel() {
  const { data, error } = useLoad(() => town.openOffices(), []);
  if (error) return <Modal title="🚪 Open offices">{error}</Modal>;
  if (!data) return <Modal title="🚪 Open offices">Loading…</Modal>;
  const visit = (id: number) => () => {
    hud.set({ panel: null });
    world.portalPending = true;
    send(conn.visit(id));
  };
  return (
    <Modal title="🚪 Open offices">
      <p className="muted small">Offices their owners have left open. The busiest this week come first.</p>
      {data.length === 0 ? (
        <p className="muted">No office is open right now.</p>
      ) : (
        <ul className="members offices">
          {data.map((o) => (
            <li key={o.id}>
              <span>
                <strong>{o.name}</strong>
                <span className="muted small facts">
                  {o.company && <span>{o.company}</span>}
                  <span>
                    {SIZE_NAMES[o.tier]} {OFFICE_SIZES[o.tier]!.w}×{OFFICE_SIZES[o.tier]!.h}
                  </span>
                  <span>{o.visitors === 1 ? "1 visitor" : `${o.visitors} visitors`} this week</span>
                  {o.inside > 0 && <span>{o.inside} inside</span>}
                </span>
              </span>
              <button type="button" onClick={visit(o.id)}>
                🚪 {o.id === world.selfId ? "My office" : "Visit"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** The company house's directory board: every office in the building, and a way to its door. */
export function DirectoryPanel() {
  const rows = directory(world.doors, world.selfId);
  const walk = (x: number, y: number) => () => {
    hud.set({ panel: null });
    walkTo(x, y);
  };
  return (
    <Modal title="🚪 Office directory">
      <p className="muted small">Everyone in the building with an office, in door order.</p>
      {rows.length === 0 ? (
        <p className="muted">No one here has an office yet. Offices open at level {OFFICE_LEVEL}.</p>
      ) : (
        <ul className="members offices">
          {rows.map((r) => (
            <li key={r.userId}>
              <span>
                <strong>{r.name}</strong>{" "}
                <span className="muted small facts">
                  <span>{r.mine ? "Your office" : "Open"}</span>
                </span>
              </span>
              <button type="button" onClick={walk(r.x, r.y)}>
                🚶 Walk there
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
