import { EDITIONS, editionById } from "@tokenmaxxing/core/editions.ts";
import { editionLabel, PER_WEEK, ROTATION } from "@tokenmaxxing/core/merchant.ts";
import type { Cart, Copy } from "@tokenmaxxing/server/registry";
import { useEffect, useState } from "react";
import { merchantFrame } from "../art/cart.ts";
import { errorText } from "../errors.ts";
import { refreshMe, refreshWallet, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { dayText } from "./format.ts";
import { ItemTag } from "./ItemTag.tsx";
import { ItemImage } from "./Shop.tsx";
import { Modal, Pixels, useRun, WalletLine } from "./ui.tsx";

/** How often the stock is fetched again while the cart is open: others are buying too. */
const POLL_MS = 5_000;

/**
 * The traveling merchant's cart: this week's editions with how many of each run are left, and the
 * next number. The first copy bought goes on, like the shop's.
 */
export function Merchant() {
  const me = useHud((s) => s.me);
  const wallet = useHud((s) => s.wallet);
  const [cart, setCart] = useState<Cart | null>(null);
  const [copies, setCopies] = useState<Copy[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [got, setGot] = useState<string | null>(null);
  const { error, run } = useRun();
  useEffect(() => {
    const fail = (e: unknown) => setFailed(errorText(e));
    const load = () => void town.cart().then(setCart, fail);
    load();
    void refreshWallet().catch(fail);
    void town.copies().then(setCopies, fail);
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, []);
  if (!me || !wallet || !cart) return <Modal title="🛒 The traveling merchant">{failed ?? "Loading…"}</Modal>;

  const buy = (id: string) =>
    run(async () => {
      const e = editionById(id)!;
      const first = !wallet.owned.includes(id);
      const r = await town.buyEdition(id);
      hud.set({ wallet: r.wallet });
      setGot(`${e.name}, ${editionLabel(r.n, e)}. Yours.`);
      setCart(await town.cart());
      setCopies(await town.copies());
      if (first) {
        await town.setLook({ ...me.look, [e.slot]: e.index });
        await refreshMe();
      }
    });

  return (
    <Modal title="🛒 The traveling merchant" wide>
      <div className="merchant-hello">
        {/* The merchant himself, at 4×. */}
        <Pixels sprite={merchantFrame("down")} width={64} height={64} className="avatar" />
        <p>
          {cart.open ? (
            <>
              “Merchant editions, week of {dayText(cart.week, { day: "numeric", month: "short" })}. Every copy
              numbered, and when a run is gone it's gone. I'm off on Monday at 08:00.”
            </>
          ) : (
            <>“Packing up, friend. Back on Thursday at 08:00 with new stock.”</>
          )}
        </p>
      </div>
      <WalletLine balance={wallet.balance} />
      {got && <p className="merchant-got">✨ {got}</p>}
      <ul className="shop merchant">
        {cart.stock.map((s) => {
          const e = editionById(s.id);
          if (!e) return null;
          const left = s.supply - s.sold;
          const mine = copies.filter((c) => c.item === s.id && c.week === cart.week);
          return (
            <li key={s.id} className={left === 0 ? "sold-out" : undefined}>
              <ItemImage item={e} look={me.look} />
              <strong>{e.name}</strong>
              <ItemTag item={e} />
              <span className="stock" aria-hidden="true">
                <span style={{ width: `${(100 * left) / s.supply}%` }} />
              </span>
              <span className="small">
                {left === 0
                  ? `All ${s.supply} sold`
                  : `${left} of ${s.supply} left · next ${editionLabel(s.sold + 1, s)}`}
              </span>
              {mine.length > 0 && (
                <span className="small mine">You have {mine.map((c) => `#${c.n}`).join(", ")}</span>
              )}
              {left === 0 ? (
                <span className="stamp">SOLD OUT</span>
              ) : (
                <button
                  type="button"
                  className="primary"
                  disabled={wallet.balance < s.price}
                  onClick={buy(s.id)}
                >
                  🪙 {s.price}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted small">
        {PER_WEEK} editions a week, different ones each time: all {EDITIONS.length} come round once every{" "}
        {ROTATION} weeks. Numbered copies trade like anything else.
      </p>
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}
