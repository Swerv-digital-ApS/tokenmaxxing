import { DOORS, giftLabel } from "@tokenmaxxing/core/december.ts";
import type { Calendar } from "@tokenmaxxing/server/registry";
import { useEffect, useState } from "react";
import { errorText } from "../errors.ts";
import { town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { Modal, useRun, WalletLine } from "./ui.tsx";

/**
 * The julekalender (`core/src/december.ts`): 24 doors, one a day from 1 to 24 December, each the same gift for
 * everyone, coins or something to wear. Today's opens once (`town.openDoor`); a missed day stays shut.
 */
export function Julekalender() {
  const wallet = useHud((s) => s.wallet);
  const [cal, setCal] = useState<Calendar | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [got, setGot] = useState<string | null>(null);
  const { error, run } = useRun();
  useEffect(() => {
    void town.julekalender().then(setCal, (e: unknown) => setFailed(errorText(e)));
  }, []);
  if (!cal || !wallet) return <Modal title="🎄 Julekalender">{failed ?? "Loading…"}</Modal>;

  const open = run(async () => {
    const r = await town.openDoor();
    hud.set({ wallet: r.wallet });
    setGot(r.notice);
    setCal(await town.julekalender());
  });

  return (
    <Modal title="🎄 Julekalender" wide>
      <p>
        {cal.today
          ? `A door a day until Christmas Eve, the same gift behind it for everyone. Today is door ${cal.today}.`
          : "The doors open from 1 to 24 December, one a day."}
      </p>
      <WalletLine balance={wallet.balance} />
      {got && <p className="merchant-got">{got}</p>}
      <ol className="julekalender">
        {DOORS.map((gift, i) => {
          const n = i + 1;
          const opened = cal.opened.includes(n);
          const today = n === cal.today;
          const shut = !opened && !today;
          return (
            <li
              key={n}
              className={opened ? "opened" : today ? "today" : cal.today && n < cal.today ? "missed" : ""}
            >
              <span className="door-n">{n}</span>
              {opened && <span className="small">{giftLabel(gift)}</span>}
              {today && !opened && (
                <button type="button" className="primary" onClick={open}>
                  Open
                </button>
              )}
              {shut && <span className="small muted">{cal.today && n < cal.today ? "missed" : "🔒"}</span>}
            </li>
          );
        })}
      </ol>
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}
