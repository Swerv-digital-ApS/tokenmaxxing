import { isBot } from "@tokenmaxxing/core/bots.ts";
import { calendarOn } from "@tokenmaxxing/core/december.ts";
import { compact, levelTitle, plural } from "@tokenmaxxing/core/format.ts";
import { milestonesBetween } from "@tokenmaxxing/core/milestones.ts";
import { OFFICE_LEVEL } from "@tokenmaxxing/core/office.ts";
import { parsePhoneCode } from "@tokenmaxxing/core/pairing.ts";
import type { Wallet } from "@tokenmaxxing/server/registry";
import { typedSwitch } from "hanzio";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { jump } from "../game/input.ts";
import { setSettings } from "../game/jukebox.ts";
import { takePhoto } from "../game/stage.ts";
import { roomName, world } from "../game/world.ts";
import { redeem } from "../net.ts";
import { storage } from "../storage.ts";
import { chatBeside, FIRST_VISIT_KEY, hud, useHud } from "../store.ts";
import { AppSignIn } from "./AppSignIn.tsx";
import { AppUpdate, tauri } from "./AppUpdate.tsx";
import { ArcadePanel, GamesBox, InviteToast, NewTable } from "./Arcade.tsx";
import { Bag } from "./Bag.tsx";
import { Bar } from "./Bar.tsx";
import { CaseOpening } from "./CaseOpening.tsx";
import { CaseShop } from "./CaseShop.tsx";
import { Chat } from "./Chat.tsx";
import { Collection } from "./Collection.tsx";
import { CompanyCard } from "./CompanyCard.tsx";
import { CompanyPanel } from "./CompanyPanel.tsx";
import { CompanyShop } from "./CompanyShop.tsx";
import { Fishing } from "./Fishing.tsx";
import { FpsMeter, GraphicsPanel, GraphicsToast } from "./Graphics.tsx";
import { GreenBanner } from "./GreenHour.tsx";
import { HallOfFame } from "./HallOfFame.tsx";
import { Hotbar } from "./Hotbar.tsx";
import { Jukebox } from "./Jukebox.tsx";
import { Julekalender } from "./Julekalender.tsx";
import { KeynoteBanner, KeynotePanel } from "./Keynote.tsx";
import { Leaderboard } from "./Leaderboard.tsx";
import { LootToast } from "./Loot.tsx";
import { Market, MarketSlot } from "./Market.tsx";
import { MatchPanel } from "./Match.tsx";
import { MerchShop } from "./Merch.tsx";
import { Merchant } from "./Merchant.tsx";
import { MilestoneToast } from "./MilestoneToast.tsx";
import { MiniBoard } from "./MiniBoard.tsx";
import { Minimap } from "./Minimap.tsx";
import { DeskPanel } from "./OfficeDesks.tsx";
import { DecorPanel, DirectoryPanel, OpenOfficesPanel } from "./Offices.tsx";
import { PamphletPanel } from "./Pamphlet.tsx";
import { PaperPanel } from "./Paper.tsx";
import { PetMenu } from "./PetMenu.tsx";
import { PicnicBanner } from "./Picnic.tsx";
import { BotCard, PlayerCard } from "./PlayerCard.tsx";
import { Poker } from "./Poker.tsx";
import { PokerWatch } from "./PokerWatch.tsx";
import { Quests } from "./Quests.tsx";
import { RaidBox, RaidPanel, RaidToast } from "./Raid.tsx";
import { Regulars } from "./Regulars.tsx";
import { Requests } from "./Requests.tsx";
import { RoomsBox } from "./RoomsBox.tsx";
import { RoulettePanel } from "./Roulette.tsx";
import { Shop } from "./Shop.tsx";
import { ShopDirectory } from "./ShopDirectory.tsx";
import { Sky } from "./Sky.tsx";
import { StarButton, StarsPanel } from "./Stars.tsx";
import { MENU } from "./shops.ts";
import { TombstonePanel } from "./Tombstone.tsx";
import { Tournament } from "./Tournament.tsx";
import { TradePanel, TradesPanel } from "./Trades.tsx";
import { Trophies } from "./Trophies.tsx";
import { Modal, ToastButton, useFresh, useNarrow, useRun } from "./ui.tsx";
import { ChangelogPanel, WhatsNewToast } from "./WhatsNew.tsx";

export function Hud() {
  const status = useHud((s) => s.status);
  const beside = useHud((s) => chatBeside(s.panel));
  const room = useHud((s) => s.room);
  const narrow = useNarrow();
  const [tray, setTray] = useState<Tray | null>(null);
  if (status === "signedOut" || status === "expired")
    return tauri ? <AppSignIn /> : <SignedOut expired={status === "expired"} />;
  return (
    <>
      <Hints />
      <Stats />
      {narrow ? (
        <>
          <div className="tray">
            {TRAY.map(([id, icon, label]) => (
              <button
                key={id}
                type="button"
                className={tray === id ? "icon on" : "icon"}
                aria-label={label}
                aria-pressed={tray === id}
                title={label}
                onClick={() => setTray(tray === id ? null : id)}
              >
                {icon}
              </button>
            ))}
          </div>
          {tray === "info" && <Corner />}
          {tray === "chat" && <Chat />}
          {tray === "map" && <Minimap />}
          <Banner />
          <PicnicBanner />
          <KeynoteBanner />
          <GreenBanner />
        </>
      ) : (
        <>
          <Corner />
          <Banner />
          <PicnicBanner />
          <KeynoteBanner />
          <GreenBanner />
          {!beside && <Chat />}
          <Minimap />
        </>
      )}
      <Hotbar />
      <PetMenu />
      <Dialog />
      <PieceHint />
      <Poker />
      <Panel />
      {status === "connecting" && (
        <div className="toast" role="status">
          Walking into town…
        </div>
      )}
      {status === "offline" && (
        <div className="toast" role="status">
          Reconnecting…
        </div>
      )}
      <div className={room === "dungeon" ? "toasts low" : "toasts"}>
        <MentionToast />
        <NoticeToast />
        <MarketToast />
        <QuestToast />
        <InviteToast />
        <LevelToast />
        <RaidToast />
        <LootToast />
        <GraphicsToast />
      </div>
      <WhatsNewToast />
      <FpsMeter />
      <FirstVisit />
    </>
  );
}

type Tray = (typeof TRAY)[number][0];
/** On a small screen the chat, the map and the corner cards sit behind these icons, one open at a time. */
const TRAY = [
  ["chat", "💬", "Chat"],
  ["map", "🗺", "Map"],
  ["info", "🏅", "Scores and games"],
] as const;

function Corner() {
  return (
    <div className="corner">
      <MiniBoard />
      <GamesBox />
      <RoomsBox />
      <RaidBox />
    </div>
  );
}

function Hints() {
  return (
    // Just an ⓘ until hovered (or focused from the keyboard), then the whole cheat sheet.
    <div className="panel hints">
      <button type="button" className="title" aria-label="Controls">
        ⓘ<span className="hints-name"> ⚡ tokenmaxxing</span>
      </button>
      <dl>
        <dt>Arrows</dt>
        <dd>Move</dd>
        <dt>X</dt>
        <dd>Run</dd>
        <dt>Space</dt>
        <dd>Jump</dd>
        <dt>E</dt>
        <dd>Interact</dd>
        <dt>G</dt>
        <dd>Take</dd>
        <dt>1-9</dt>
        <dd>Hotbar: place a piece (own office)</dd>
        <dt>Right-click</dt>
        <dd>Go and take</dd>
        <dt>Enter</dt>
        <dd>Chat</dd>
        <dt>L</dt>
        <dd>Leaderboard</dd>
        <dt>Esc</dt>
        <dd>Menu</dd>
        <dt>+ −</dt>
        <dd>Zoom</dd>
        <dt>Q R</dt>
        <dd>Turn the view (3D)</dd>
      </dl>
    </div>
  );
}

/** Three pips beside the coins, one per daily quest: filled as it goes, solid when done. A click opens the board. */
function QuestTracker({ quests }: { quests: Wallet["quests"] }) {
  const done = quests.filter((q) => q.done).length;
  return (
    <button
      type="button"
      className="chip"
      title={quests.map((q) => `${q.done ? "✓" : "·"} ${q.text} (${q.value}/${q.target})`).join("\n")}
      aria-label={`Quests: ${done} of ${quests.length} done`}
      onClick={() => hud.set({ panel: { kind: "quests" } })}
    >
      🧾
      <span className="quest-pips" aria-hidden>
        {quests.map((q) => (
          <span
            key={q.id}
            className={`quest-pip${q.done ? " done" : ""}`}
            style={{ "--fill": `${Math.min(100, (q.value / q.target) * 100)}%` } as CSSProperties}
          />
        ))}
      </span>
    </button>
  );
}

function Stats() {
  const stats = useHud((s) => s.stats);
  const wallet = useHud((s) => s.wallet);
  const waiting = useHud((s) => s.me?.company?.applicants.length ?? 0);
  const [photoOpen, setPhotoOpen] = useState(false);
  return (
    <div className="panel stats-chip">
      <AppUpdate />
      <Sky />
      <button
        type="button"
        className="icon"
        title="Take a photo of the town"
        aria-label="Take a photo"
        onClick={() => setPhotoOpen(!photoOpen)}
      >
        📷
      </button>
      {photoOpen && (
        <fieldset className="panel photo-booth">
          <legend>📷 Photo booth</legend>
          <span>Gather everyone in view, then pick your pose.</span>
          <div>
            <button
              type="button"
              onClick={() => {
                setPhotoOpen(false);
                takePhoto();
              }}
            >
              As I am
            </button>{" "}
            <button
              type="button"
              onClick={() => {
                setPhotoOpen(false);
                takePhoto(jump);
              }}
            >
              Jump
            </button>{" "}
            <button type="button" onClick={() => setPhotoOpen(false)}>
              Cancel
            </button>
          </div>
        </fieldset>
      )}
      {stats && (
        <button
          type="button"
          className="chip"
          onClick={() => hud.set({ panel: { kind: "card", userId: world.selfId } })}
        >
          <strong>{compact(stats.tokensToday)}</strong> today
          {stats.rank !== null && <span className="badge">#{stats.rank}</span>}
          <span className="badge lv">Lv{stats.level}</span>
        </button>
      )}
      {wallet && (
        <button
          type="button"
          className="chip"
          title="Wallet"
          aria-label={`Wallet: ${wallet.balance} coins`}
          onClick={() => hud.set({ panel: { kind: "bag" } })}
        >
          🪙 <strong>{wallet.balance.toLocaleString()}</strong>
        </button>
      )}
      {wallet && wallet.streak > 1 && (
        <span
          className="chip"
          title={`Streak: today's token and quest coins pay ×${wallet.streak}. A day without tokens costs two steps.`}
        >
          🔥 <strong>×{wallet.streak}</strong>
        </span>
      )}
      {wallet?.launches.map((l) => (
        <span
          key={l.id}
          className="chip"
          title={`${l.model} launched ${l.day} and you used it that day: +${l.coins} coins, paid once.`}
        >
          🚀 <strong>+{l.coins}</strong>
        </span>
      ))}
      {wallet && wallet.quests.length > 0 && <QuestTracker quests={wallet.quests} />}
      <button
        type="button"
        className="icon"
        title="Bag"
        aria-label={wallet ? `Bag: ${plural(wallet.items, "thing")}` : "Bag"}
        onClick={() => hud.set({ panel: { kind: "bag" } })}
      >
        🎒{wallet && ` ${wallet.items}`}
      </button>
      {calendarOn(Date.now()) && (
        <button
          type="button"
          className="icon"
          title="Julekalender: today's door"
          aria-label="Julekalender"
          onClick={() => hud.set({ panel: { kind: "julekalender" } })}
        >
          🎄
        </button>
      )}
      {wallet?.trading && (
        <button
          type="button"
          className="icon"
          title="Trades"
          aria-label="Trades: an offer is open"
          onClick={() => hud.set({ panel: { kind: "trades" } })}
        >
          🔁
        </button>
      )}
      <button
        type="button"
        className="icon"
        title={waiting ? `Company: ${waiting} asking to join` : "Company"}
        aria-label={waiting ? `Company: ${waiting} asking to join` : "Company"}
        onClick={() => hud.set({ panel: { kind: "company" } })}
      >
        🏢{waiting > 0 && <span className="count">{waiting}</span>}
      </button>
      <button
        type="button"
        className="icon"
        title="Menu (Esc)"
        aria-label="Menu"
        onClick={() => hud.set({ panel: { kind: "menu" } })}
      >
        ☰
      </button>
    </div>
  );
}

const BANNER_MS = 2500;
const MENTION_MS = 8000;

function Banner() {
  const banner = useHud((s) => s.banner);
  if (!useFresh(banner?.at, BANNER_MS) || !banner) return null;
  return <div className="banner">{banner.text}</div>;
}

function Dialog() {
  const dialog = useHud((s) => s.dialog);
  if (!dialog) return null;
  return (
    <div className="panel dialog" role="status">
      {dialog}
      <span className="muted small"> ▼ E</span>
    </div>
  );
}

/** Facing a piece of mine: it can be taken back (the storeroom, the bag) or moved. */
function PieceHint() {
  const hint = useHud((s) => s.pieceHint);
  const busy = useHud((s) => s.dialog !== null || s.panel !== null);
  if (!hint || busy) return null;
  return (
    <div className="panel piece-hint" role="status">
      {hint}
    </div>
  );
}

function Panel() {
  const panel = useHud((s) => s.panel);
  const inMyOffice = useHud((s) => s.room === `office:${world.selfId}`);
  if (!panel) return null;
  return typedSwitch(panel, "kind", {
    leaderboard: () => <Leaderboard />,
    card: (p) => (isBot(p.userId) ? <BotCard id={p.userId} /> : <PlayerCard userId={p.userId} />),
    companyCard: (p) => <CompanyCard companyId={p.companyId} />,
    company: () => <CompanyPanel />,
    companyShop: () => <CompanyShop />,
    merch: (p) => <MerchShop companyId={p.companyId} />,
    shop: (p) => <Shop tab={p.tab} />,
    shops: () => <ShopDirectory />,
    merchant: () => <Merchant />,
    julekalender: () => <Julekalender />,
    bag: (p) => <Bag tab={p.tab} />,
    arcade: () => <ArcadePanel />,
    newTable: (p) => <NewTable invite={p.invite} inviteName={p.inviteName} game={p.game} />,
    match: (p) => <MatchPanel id={p.id} />,
    trade: (p) => <TradePanel userId={p.userId} />,
    trades: () => <TradesPanel />,
    quests: () => <Quests />,
    bar: () => <Bar />,
    tournament: () => <Tournament />,
    requests: () => <Requests />,
    hallOfFame: () => <HallOfFame />,
    collection: () => <Collection />,
    regulars: () => <Regulars />,
    jukebox: () => <Jukebox />,
    fishing: () => <Fishing />,
    graphics: () => <GraphicsPanel />,
    paper: () => <PaperPanel />,
    pamphlet: () => <PamphletPanel />,
    tombstone: (p) => <TombstonePanel id={p.id} />,
    keynote: () => <KeynotePanel />,
    stars: () => <StarsPanel />,
    trophies: (p) => <Trophies userId={p.userId} name={p.name} />,
    raid: () => <RaidPanel />,
    openOffices: () => <OpenOfficesPanel />,
    directory: () => <DirectoryPanel />,
    decor: () => <DecorPanel />,
    desk: () => <DeskPanel />,
    changelog: () => <ChangelogPanel />,
    caseOpening: () => <CaseOpening />,
    caseShop: (p) => <CaseShop shelf={p.shelf} />,
    market: (p) => <Market tab={p.tab} />,
    marketSlot: (p) => <MarketSlot slot={p.slot} />,
    roulette: (p) => <RoulettePanel watch={p.watch} />,
    pokerWatch: () => <PokerWatch />,
    menu: () => (
      <Modal title="Menu">
        <nav className="menu">
          <MusicToggle />
          {inMyOffice && (
            <button type="button" onClick={() => hud.set({ panel: { kind: "decor" } })}>
              🏠 My room
            </button>
          )}
          {MENU.map(([open, label]) => (
            <button key={open.kind} type="button" onClick={() => hud.set({ panel: open })}>
              {label}
            </button>
          ))}
          <StarButton />
        </nav>
      </Modal>
    ),
  });
}

/** Mutes or unmutes all the music (the room's and the jukebox's), for this device. */
function MusicToggle() {
  const settings = useHud((s) => s.jukeSettings);
  return (
    <button type="button" onClick={() => setSettings({ ...settings, muted: !settings.muted })}>
      {settings.muted ? "🔇 Music off" : "🔊 Music on"}
    </button>
  );
}

function SignedOut({ expired }: { expired: boolean }) {
  const [code, setCode] = useState("");
  const { busy, error, run } = useRun();
  const submit = run(async () => {
    const value = code.trim();
    if (!parsePhoneCode(value) && !/^\d{1,12}\.[A-Za-z0-9_-]{16,128}$/.test(value))
      throw new Error("Type the code from your computer, like 42-K7QF-M2XP.");
    await redeem(value);
    location.reload();
  });
  return (
    <div className="signed-out">
      <div className="panel">
        <p className="title">⚡ tokenmaxxing</p>
        <p>
          {expired
            ? "That link has expired. Make a new code on your computer."
            : "Connect to your existing account."}
        </p>
        <p>
          On your computer, open your player card → Computers → Connect phone. Scan the QR in the Android app,
          or type its code here.
        </p>
        <form className="phone-signin" onSubmit={submit}>
          <label>
            Sign-in code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="42-K7QF-M2XP"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </label>
          <button type="submit" className="primary" disabled={busy || !code.trim()}>
            Sign in
          </button>
        </form>
        {error && <p className="error">{error}</p>}
        <p className="muted">
          New here? <a href="/">Get the desktop app</a> to create an account and sync your usage.
        </p>
      </div>
    </div>
  );
}

/** Right after signing up: the first time in town without a company, offer to start or join one. */
function FirstVisit() {
  const me = useHud((s) => s.me);
  useEffect(() => {
    if (!me || storage.getItem(FIRST_VISIT_KEY)) return;
    storage.setItem(FIRST_VISIT_KEY, "1");
    if (!me.company && !me.application) hud.set({ panel: { kind: "company" } });
  }, [me]);
  return null;
}

const NOTICE_ICONS = {
  company: "🏢",
  trades: "🔁",
  bag: "🎒",
  quests: "🧾",
  hallOfFame: "🏆",
  tournament: "🏆",
  collection: "📖",
  market: "🧺",
} as const;

/** A line for me from the server (a company application, a trade); a click opens what it's about. */
function NoticeToast() {
  const notice = useHud((s) => s.notice);
  if (!useFresh(notice?.at, MENTION_MS) || !notice) return null;
  const { open } = notice;
  return (
    <ToastButton
      open={open && (open === "market" ? { kind: "market", tab: "shelf" } : { kind: open })}
      dismiss={() => hud.set({ notice: null })}
    >
      {open && `${NOTICE_ICONS[open]} `}
      {notice.text}
    </ToastButton>
  );
}

/** Things of mine that sold in Torvehallen while I was away: one line, which opens my shelf. */
function MarketToast() {
  const sold = useHud((s) => s.marketSold);
  if (!useFresh(sold?.at, MENTION_MS) || !sold) return null;
  const total = sold.sales.reduce((sum, s) => sum + s.price, 0);
  return (
    <ToastButton open={{ kind: "market", tab: "shelf" }} dismiss={() => hud.set({ marketSold: null })}>
      🧺 {sold.sales.length === 1 ? "Your item sold" : `${sold.sales.length} of your items sold`} for 🪙{" "}
      {total.toLocaleString()}
    </ToastButton>
  );
}

/** My level went up while I was here; the first level after load is just where I started. */
function LevelToast() {
  const level = useHud((s) => s.stats?.level);
  const company = useHud((s) => s.me?.company);
  const seen = useRef<number | undefined>(undefined);
  const [up, setUp] = useState<{ from: number; to: number; at: number } | null>(null);
  useEffect(() => {
    if (level === undefined) return;
    if (seen.current !== undefined && level > seen.current)
      setUp({ from: seen.current, to: level, at: Date.now() });
    seen.current = level;
  }, [level]);
  if (!useFresh(up?.at, MENTION_MS) || !up) return null;
  const open = () => {
    setUp(null);
    hud.set({ panel: { kind: "bag" } });
  };
  // Every level reward is a milestone's. A big sync can pass two: the toast shows the last.
  const passed = milestonesBetween(up.from, up.to);
  if (passed.length > 0) {
    const office =
      passed[0]!.level === OFFICE_LEVEL
        ? company
          ? "Your own office is open"
          : "Join a company for your own office"
        : null;
    return <MilestoneToast milestone={passed.at(-1)!} level={up.to} office={office} onClick={open} />;
  }
  return (
    <ToastButton open={{ kind: "bag" }} dismiss={() => setUp(null)}>
      ⬆️ Level {up.to} · {levelTitle(up.to)}
    </ToastButton>
  );
}

/** Someone @-mentioned me from another room. */
function MentionToast() {
  const mention = useHud((s) => s.mention);
  if (!useFresh(mention?.at, MENTION_MS) || !mention) return null;
  const { line } = mention;
  return (
    <ToastButton open={{ kind: "card", userId: line.userId }} dismiss={() => hud.set({ mention: null })}>
      💬 <strong>{line.name}</strong> mentioned you in {roomName(line.room)}: {line.text}
    </ToastButton>
  );
}

/**
 * Quests the last wallet has done that the one before didn't. The first wallet after load
 * is the baseline, so a reload doesn't toast what's already done.
 */
function QuestToast() {
  const quests = useHud((s) => s.wallet?.quests);
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<{ quests: NonNullable<typeof quests>; at: number } | null>(null);
  useEffect(() => {
    if (!quests) return;
    const done = quests.filter((q) => q.done);
    const before = seen.current;
    seen.current = new Set(done.map((q) => q.id));
    const now = before ? done.filter((q) => !before.has(q.id)) : [];
    if (now.length > 0) setFresh({ quests: now, at: Date.now() });
  }, [quests]);
  if (!useFresh(fresh?.at, MENTION_MS) || !fresh) return null;
  return (
    <ToastButton open={{ kind: "quests" }} dismiss={() => setFresh(null)}>
      {fresh.quests.map((q) => `✓ ${q.text} · 🪙 ${q.coins}`).join("  ")}
    </ToastButton>
  );
}
