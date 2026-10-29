import { compact, plural } from "@tokenmaxxing/core/format.ts";
import type { RangeKey } from "@tokenmaxxing/core/range.ts";
import { houseTierName } from "@tokenmaxxing/core/world.ts";
import { useState } from "react";
import { town } from "../net.ts";
import { hud, useHud } from "../store.ts";
import { coins } from "./format.ts";
import { BoardRow } from "./Leaderboard.tsx";
import { DailyChart, RANGES, StatsGrid } from "./PlayerCard.tsx";
import { AvatarImage, House, Modal, Pills, useLoad } from "./ui.tsx";

const openCard = (userId: number) => hud.set({ panel: { kind: "card", userId } });

/** A company's page, like a player's: its house and logo, website, numbers and people. */
export function CompanyCard({ companyId }: { companyId: number }) {
  const [range, setRange] = useState<RangeKey>("7d");
  const { data: c, error } = useLoad(() => town.company(companyId, range), [companyId, range]);
  const mine = useHud((s) => s.me?.company?.id === companyId);

  if (error) return <Modal title="Company">{error}</Modal>;
  if (!c) return <Modal title="Company">Loading…</Modal>;
  const top = Math.max(1, ...c.members.map((m) => m.tokens));
  return (
    <Modal title={`🏢 ${c.name}`}>
      <div className="card-head company-head">
        <House companyId={c.id} tier={c.tier} scale={1} />
        <div>
          {c.logo && <img className="company-logo" src={c.logo} alt={`${c.name} logo`} />}
          <p>
            <strong>{houseTierName(c.tier)}</strong> · {plural(c.members.length, "member")}
          </p>
          <p className="wallet">
            <strong>{coins(c.wallet)}</strong> <span className="muted small">in the company wallet</span>
          </p>
          {c.website && (
            <p>
              <a href={`https://${c.website}`} target="_blank" rel="noreferrer noopener">
                🔗 {c.website}
              </a>
            </p>
          )}
          {c.rank !== null && (
            <p className="muted">
              #{c.rank} in town {RANGES.find(([k]) => k === range)?.[1].toLowerCase()}
            </p>
          )}
          <p className="company-actions">
            <button type="button" onClick={() => hud.set({ panel: { kind: "merch", companyId: c.id } })}>
              👕 Merch shop
            </button>
            {mine && (
              <button type="button" onClick={() => hud.set({ panel: { kind: "company" } })}>
                Manage your company
              </button>
            )}
          </p>
        </div>
      </div>
      <Pills value={range} options={RANGES} onChange={setRange} />
      <StatsGrid totals={c.totals} />
      <DailyChart daily={c.daily} />
      <h3>People</h3>
      <ol className="lb-list company-people">
        {c.members.map((m) => (
          <BoardRow
            key={m.userId}
            picture={<AvatarImage look={m.look} scale={2} />}
            name={
              <>
                {m.name}
                {m.isOwner && " 👑"}
              </>
            }
            sub={`Lv${m.level}`}
            share={Math.max(0.02, m.tokens / top)}
            value={compact(m.tokens)}
            onClick={() => openCard(m.userId)}
          />
        ))}
      </ol>
    </Modal>
  );
}
