import { memberRoomOf, ownerOfOffice, type RoomId } from "@tokenmaxxing/core/world.ts";
import { useEffect, useState } from "react";
import { send } from "../game/input.ts";
import { roomName, self, world } from "../game/world.ts";
import { conn, town } from "../net.ts";
import { hud, useHud } from "../store.ts";

/** Rooms shown before "+N more". */
const SHOWN = 5;

/**
 * Under the games: every room with someone in it, busiest first, and how many. A click takes you there at once,
 * without walking (`goTo`): any room but another company's house or common room, which are for its members.
 */
export function RoomsBox() {
  const occupancy = useHud((s) => s.occupancy);
  const here = useHud((s) => s.room);
  const [all, setAll] = useState(false);
  const owners = useOfficeOwners(occupancy);
  const mine = self()?.info.companyId ?? null;
  const rooms = (Object.entries(occupancy) as [RoomId, number][])
    .filter(([, n]) => n > 0)
    .sort(([a, n], [b, m]) => m - n || a.localeCompare(b));
  if (rooms.length === 0) return null;
  const name = (room: RoomId) => {
    const owner = ownerOfOffice(room);
    if (owner === null) return roomName(room);
    return owner === world.selfId ? "Your office" : `${owners.get(owner) ?? "Someone"}'s office`;
  };
  const shown = all ? rooms : rooms.slice(0, SHOWN);
  return (
    <section className="panel games-box rooms-box" aria-label="Where people are">
      <p className="miniboard-title">
        📍 Rooms <span className="muted">· {rooms.reduce((n, [, m]) => n + m, 0)} online</span>
      </p>
      <ul>
        {shown.map(([room, n]) => {
          const house = memberRoomOf(room);
          const closed = house !== null && house !== mine;
          const label = name(room);
          return (
            <li key={room}>
              <button
                type="button"
                className={room === here ? "who link here" : "who link"}
                disabled={room === here || closed}
                title={room === here ? "You're here" : closed ? "For its members" : `Go to ${label}`}
                onClick={() => {
                  hud.set({ panel: null });
                  send(conn.goTo(room));
                }}
              >
                {label}
              </button>
              <small className="muted">👤 {n}</small>
            </li>
          );
        })}
        {rooms.length > SHOWN && (
          <li>
            <button type="button" className="link muted small" onClick={() => setAll(!all)}>
              {all ? "Fewer" : `+${rooms.length - SHOWN} more`}
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}

/** Office owners' names for the offices people are in, fetched again when one shows up that isn't known yet. */
function useOfficeOwners(occupancy: Partial<Record<RoomId, number>>): Map<number, string> {
  const [names, setNames] = useState(() => new Map<number, string>());
  const unknown = Object.keys(occupancy).some((r) => {
    const owner = ownerOfOffice(r as RoomId);
    return owner !== null && owner !== world.selfId && !names.has(owner);
  });
  useEffect(() => {
    if (!unknown) return;
    let live = true;
    void town.openOffices().then(
      (rows) => live && setNames(new Map(rows.map((r) => [r.id, r.name]))),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [unknown]);
  return names;
}
