import {
  EMPLOYEE_MERCH_DISCOUNT,
  type Item,
  itemById,
  MERCH,
  merchId,
  merchPrice,
} from "@tokenmaxxing/core/shop.ts";
import { shopOfRoom } from "@tokenmaxxing/core/shoprooms.ts";
import { MERCH_PRINT_H, MERCH_PRINT_W, type MerchDesign } from "@tokenmaxxing/core/world.ts";
import { useEffect, useState } from "react";
import { type MerchCompany, merchColours, merchPreview } from "../art/merch.ts";
import { errorText } from "../errors.ts";
import { refreshMe, refreshWallet, town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { ItemIcon } from "./ItemIcon.tsx";
import { ItemImage, isWorn, WearButton, withItem } from "./Shop.tsx";
import { TakeMeThere } from "./ShopDirectory.tsx";
import { Modal, Pixels, useRun, WalletLine } from "./ui.tsx";

/** "Acme tee": merch says whose it is; everything else is its own name. */
export function merchName(item: Item): string {
  if (item.companyId === undefined) return item.name;
  const company = hud.get().companies.find((c) => c.id === item.companyId);
  return company ? `${company.name} ${item.name.toLowerCase()}` : item.name;
}

/**
 * A company's merch: a tee, a hoodie, a cap and a mug in its colours. Outsiders pay, into the company
 * wallet; its own people get `EMPLOYEE_MERCH_DISCOUNT` off (free, as it stands).
 */
export function MerchShop({ companyId }: { companyId: number }) {
  const me = useHud((s) => s.me);
  const wallet = useHud((s) => s.wallet);
  const company = useHud((s) => s.companies.find((c) => c.id === companyId));
  const { error, run } = useRun();
  const atShop = useHud((s) => shopOfRoom(s.room) === "clothes");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    void refreshWallet().catch((e) => hud.set({ dialog: errorText(e) }));
  }, []);
  if (!me || !wallet || !company)
    return <Modal title="👕 Merch">{company ? "Loading…" : "That company is gone."}</Modal>;
  const employee = me.company?.id === companyId;
  if (editing && employee) return <MerchEditor company={company} onClose={() => setEditing(false)} />;
  const off = Math.round(EMPLOYEE_MERCH_DISCOUNT * 100);

  const buy = (item: Item) =>
    run(async () => {
      hud.set({ wallet: await town.buy(item.id) });
      await town.setLook(withItem(item, me.look, true));
      await refreshMe();
    });

  return (
    <Modal title={`👕 ${company.name} merch`} wide>
      <p className="muted small">
        {employee
          ? off === 100
            ? "You work here: yours are free, one of each."
            : `You work here: ${off}% off, and what you pay goes into the company wallet.`
          : `Everything you pay goes into ${company.name}'s company wallet. Its people get theirs ${off === 100 ? "free" : `${off}% off`}.`}
      </p>
      {!atShop && (
        <p className="muted small">
          Merch is sold at Thread &amp; Token. <TakeMeThere shop="clothes" />
        </p>
      )}
      <WalletLine balance={wallet.balance} />
      {employee && (
        <button type="button" onClick={() => setEditing(true)}>
          🎨 Design the merch
        </button>
      )}
      <ul className="shop">
        {MERCH.map((m) => {
          const item = itemById(merchId(companyId, m.kind))!;
          const owned = wallet.owned.includes(item.id);
          const price = merchPrice(m.kind, employee);
          return (
            <li key={m.kind} className={isWorn(item, me.look) ? "wearing" : undefined}>
              <span className="merch-pics">
                <ItemImage item={item} look={me.look} bare />
                <ItemImage item={item} look={me.look} />
              </span>
              <span>{merchName(item)}</span>
              {owned && <WearButton item={item} look={me.look} run={run} />}
              {!(owned && price === 0) && (
                <button
                  type="button"
                  className="primary"
                  disabled={!atShop || wallet.balance < price}
                  onClick={buy(item)}
                >
                  {price === 0 ? "Free" : `🪙 ${price}`}
                  {employee && price < m.price && <s className="muted"> {m.price}</s>}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}

/** The brushes: `.` rubs out; the rest are what `MerchDesign.rows` spells them. */
const BRUSHES = [
  [".", "Erase"],
  ["a", "Accent"],
  ["w", "White"],
  ["k", "Dark"],
] as const;

const FILL = (ch: string) => (ch === "w" ? "#ffffff" : ch === "k" ? "#1b1b26" : null);

/** Any member draws what the company's merch carries: two colours and a small pixel print. */
function MerchEditor({ company, onClose }: { company: MerchCompany; onClose: () => void }) {
  const start = merchColours(company);
  const [design, setDesign] = useState<MerchDesign>(
    company.merch ?? {
      main: start.main,
      accent: start.accent,
      rows: Array.from({ length: MERCH_PRINT_H }, () => ".".repeat(MERCH_PRINT_W)),
    },
  );
  const [brush, setBrush] = useState<string>("a");
  const { error, run } = useRun();
  const paint = (x: number, y: number) =>
    setDesign((d) => ({
      ...d,
      rows: d.rows.map((r, j) => (j === y ? r.slice(0, x) + brush + r.slice(x + 1) : r)),
    }));
  const draft = { ...company, merch: design };
  return (
    <Modal title={`🎨 ${company.name} merch design`} wide>
      <p className="muted small">
        Everyone in the house can draw this: the last save is what the merch looks like.
      </p>
      <div className="merch-editor">
        <div
          className="merch-grid"
          style={{ gridTemplateColumns: `repeat(${MERCH_PRINT_W}, 28px)`, background: design.main }}
        >
          {design.rows.flatMap((row, y) =>
            [...row].map((ch, x) => (
              <button
                // biome-ignore lint/suspicious/noArrayIndexKey: a fixed grid
                key={`${x},${y}`}
                type="button"
                aria-label={`Pixel ${x + 1},${y + 1}`}
                style={{ background: ch === "a" ? design.accent : (FILL(ch) ?? "transparent") }}
                onClick={() => paint(x, y)}
              />
            )),
          )}
        </div>
        <div className="merch-pics">
          {MERCH.map((m) => (
            <ItemIcon
              key={m.kind}
              spec={{ kind: "merch", company: draft, merch: m.kind }}
              size={64}
              className="avatar"
            >
              <Pixels
                sprite={merchPreview(draft, m.bit)}
                width={64}
                height={64}
                scale={4}
                className="avatar"
              />
            </ItemIcon>
          ))}
        </div>
      </div>
      <div className="company-actions">
        {BRUSHES.map(([ch, name]) => (
          <button
            key={ch}
            type="button"
            className={brush === ch ? "primary" : undefined}
            onClick={() => setBrush(ch)}
          >
            {name}
          </button>
        ))}
        <label className="field">
          Shirt
          <input
            type="color"
            value={design.main}
            onChange={(e) => setDesign({ ...design, main: e.target.value })}
          />
        </label>
        <label className="field">
          Accent
          <input
            type="color"
            value={design.accent}
            onChange={(e) => setDesign({ ...design, accent: e.target.value })}
          />
        </label>
      </div>
      <div className="company-actions">
        <button
          type="button"
          className="primary"
          onClick={run(async () => {
            await town.setMerch(design);
            onClose();
          })}
        >
          Save
        </button>
        <button
          type="button"
          onClick={run(async () => {
            await town.setMerch(null);
            onClose();
          })}
        >
          Back to brand colours
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </Modal>
  );
}
