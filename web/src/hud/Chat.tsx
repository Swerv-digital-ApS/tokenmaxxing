import { isBot } from "@tokenmaxxing/core/bots.ts";
import type { MatchChatLine } from "@tokenmaxxing/core/games/wire.ts";
import { CHAT_MAX_LENGTH, mentionsIn } from "@tokenmaxxing/core/world.ts";
import { memo, useEffect, useRef, useState } from "react";
import { errorText } from "../errors.ts";
import { roomName, world } from "../game/world.ts";
import { conn, matchConn, town } from "../net.ts";
import { storage } from "../storage.ts";
import { hud, useHud } from "../store.ts";
import { DanceBar } from "./DanceBar.tsx";
import { MentionInput } from "./MentionInput.tsx";
import { QuickReplies } from "./QuickReplies.tsx";
import { AvatarImage, Pills } from "./ui.tsx";

/** `@feedback <text>` pins the rest on the Tavern's request pile instead of saying it. */
const FEEDBACK = /^@feedback(?:\s+|$)/i;

/** Who's online in this room (people, not the town's bots), you first, then by name. */
const onlineHere = () =>
  [...world.avatars.values()]
    .filter((a) => a.info.online && !isBot(a.info.id))
    .sort(
      (a, b) =>
        Number(b.info.id === world.selfId) - Number(a.info.id === world.selfId) ||
        a.info.name.localeCompare(b.info.name),
    )
    .map((a) => a.info);

/**
 * "● 3 online" with the first few faces; hover (or focus) lists everyone online in the room and their
 * company, and a name opens their card. The list is read when it opens, so it's never stale.
 */
function WhosHere({ count }: { count: number }) {
  const [people, setPeople] = useState(onlineHere);
  const refresh = () => setPeople(onlineHere());
  // biome-ignore lint/correctness/useExhaustiveDependencies: the list is read again whenever the count changes
  useEffect(refresh, [count]);
  const companies = useHud((s) => s.companies);
  const companyName = (id: number | null) =>
    id === null ? "Freelancer" : (companies.find((c) => c.id === id)?.name ?? "A company");
  return (
    <span className="whos-here">
      <button
        type="button"
        className="whos-here-chip"
        aria-label={`${count} online here`}
        onMouseEnter={refresh}
        onFocus={refresh}
      >
        <span className="online-dot" aria-hidden="true" />
        <span className="whos-here-faces" aria-hidden="true">
          {people.slice(0, 3).map((p) => (
            <AvatarImage key={p.id} look={p.look} scale={1} />
          ))}
        </span>
        {count} online
      </button>
      <ul className="panel whos-here-list" aria-label="Online here">
        {people.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => hud.set({ panel: { kind: "card", userId: p.id } })}>
              <AvatarImage look={p.look} scale={2} />
              <span>
                <strong>
                  {p.name}
                  {p.id === world.selfId && <span className="muted"> (you)</span>}
                </strong>
                <small className="muted">{companyName(p.companyId)}</small>
              </span>
              <span className="muted small">Lv{p.level}</span>
            </button>
          </li>
        ))}
      </ul>
    </span>
  );
}

/** A chat line with `@name` highlighted; mentions of me stand out more. */
function Text({ text, me }: { text: string; me: string | undefined }) {
  return (
    <span>
      {text.split(/(@[a-z0-9][a-z0-9._-]{1,31})/gi).map((part, i) =>
        i % 2 === 1 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: parts of one immutable string
          <span key={i} className={`mention${part.slice(1).toLowerCase() === me ? " me" : ""}`}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </span>
  );
}

/** The lines, kept apart from the input so typing doesn't redo all of them. */
const ChatLines = memo(function ChatLines({
  chat,
  inGame,
  myId,
  myName,
}: {
  chat: MatchChatLine[];
  inGame: boolean;
  myId: number | undefined;
  myName: string | undefined;
}) {
  const list = useRef<HTMLOListElement>(null);
  // The tournament champion's title: a crown by their name until the next tournament has a winner.
  const champ = useHud((s) => s.tournament?.champion?.userId);
  // Keep the newest line in view as lines arrive.
  useEffect(() => {
    if (chat.length) list.current?.scrollTo(0, list.current.scrollHeight);
  }, [chat]);
  return (
    <ol ref={list}>
      {chat.length === 0 && (
        <li className="muted">{inGame ? "Players and watchers talk here." : "No messages yet. Say hi!"}</li>
      )}
      {chat.map((l) => (
        <li key={l.id} className={myName && mentionsIn(l.text).includes(myName) ? "mentions-me" : ""}>
          {l.userId === 0 ? (
            <span className="author">{l.name}</span>
          ) : (
            <button
              type="button"
              className={`author${l.userId === myId ? " me" : ""}`}
              onClick={() => hud.set({ panel: { kind: "card", userId: l.userId } })}
            >
              {l.userId === champ && <span title="Tournament champion">👑 </span>}
              {l.name}
            </button>
          )}
          <Text text={l.text} me={myName} />
        </li>
      ))}
    </ol>
  );
});

const OPEN_KEY = "tokenmaxxing.chatOpen";
/** How long the chat stays fully opaque after a line arrives. */
const FRESH_MS = 6000;

/**
 * The room's chat. Beside a match (`match`) there's the match's own chat too, for its players and
 * whoever is watching, and it starts there. Memoised: the panels it sits beside re-render often.
 */
export const Chat = memo(function Chat({ match = false }: { match?: boolean }) {
  const [tab, setTab] = useState<"game" | "room">(match ? "game" : "room");
  const inGame = match && tab === "game";
  const roomChat = useHud((s) => s.chat);
  const gameChat = useHud((s) => s.matchChat);
  const chat: MatchChatLine[] = inGame ? gameChat : roomChat;
  const room = useHud((s) => s.room);
  const here = useHud((s) => s.occupancy[s.room] ?? 0);
  const focus = useHud((s) => s.chatFocus);
  const myId = useHud((s) => s.me?.userId);
  const myName = useHud((s) => s.me?.name);
  useHud((s) => s.companies);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // Folded away to a small tab (kept between visits); lines that come in meanwhile are counted on it.
  const [open, setOpen] = useState(() => storage.getItem(OPEN_KEY) !== "0");
  const [unread, setUnread] = useState(0);
  const [fresh, setFresh] = useState(false);
  const seen = useRef<{ id: number | string | undefined; room: string }>({ id: undefined, room: "" });
  const setShown = (v: boolean) => {
    setOpen(v);
    storage.setItem(OPEN_KEY, v ? "1" : "0");
    if (v) setUnread(0);
  };
  const last = roomChat[roomChat.length - 1];
  // biome-ignore lint/correctness/useExhaustiveDependencies: reacts to a new last line only
  useEffect(() => {
    const prev = seen.current;
    seen.current = { id: last?.id, room };
    // First look, or a new room's backlog: nothing "just said".
    if (!last || prev.room !== room || prev.id === last.id) return;
    if (!open && last.userId !== myId) setUnread((n) => n + 1);
    setFresh(true);
    const t = setTimeout(() => setFresh(false), FRESH_MS);
    return () => clearTimeout(t);
  }, [last?.id, room]);
  const say = (t: string) => (inGame ? matchConn!.say(t) : conn.say(t));

  // Enter asks for the chat; one opening beside a panel doesn't take the focus on its own.
  const focused = useRef(focus);
  const wantInput = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: reacts to a new Enter (`focus`) only
  useEffect(() => {
    if (focus !== focused.current) {
      wantInput.current = true;
      if (!open) setShown(true);
      else input.current?.focus();
    }
    focused.current = focus;
  }, [focus]);
  useEffect(() => {
    if (open && wantInput.current) input.current?.focus();
    wantInput.current = false;
  }, [open]);

  if (!open)
    return (
      <div className="chat-dock folded">
        <button
          type="button"
          className="panel chat-tab"
          aria-label={unread ? `Open chat, ${unread} new` : "Open chat"}
          onClick={() => setShown(true)}
        >
          💬{unread > 0 && <span className="count">{unread > 9 ? "9+" : unread}</span>}
        </button>
      </div>
    );

  return (
    <div className={`chat-dock${fresh ? " fresh" : ""}`}>
      <DanceBar onError={setError} />
      <QuickReplies say={say} onError={setError} />
      <section className="panel chat" aria-label="Chat">
        <header>
          {match ? (
            <Pills
              value={tab}
              options={[
                ["game", "🎮 Game"],
                ["room", `📍 ${roomName(room)}`],
              ]}
              onChange={(t) => {
                setTab(t);
                setError(null);
              }}
            />
          ) : (
            <span>📍 {roomName(room)}</span>
          )}
          {!inGame && <WhosHere count={here} />}
          <button type="button" className="chat-fold" aria-label="Hide chat" onClick={() => setShown(false)}>
            –
          </button>
        </header>
        <ChatLines chat={chat} inGame={inGame} myId={myId} myName={myName} />
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const t = text.trim();
            if (!t) return input.current?.blur();
            setText("");
            setError(null);
            const feedback = FEEDBACK.exec(t);
            try {
              if (!feedback) await say(t);
              else {
                await town.requestAdd(t.slice(feedback[0].length));
                hud.set({
                  notice: { text: "📌 Pinned on the Tavern's request pile. Thanks!", at: Date.now() },
                });
              }
            } catch (err) {
              setError(errorText(err));
              // A request takes a while to write: give it back to fix, rather than lose it.
              if (feedback) setText(t);
            }
          }}
        >
          <MentionInput
            inputRef={input}
            label="Chat"
            value={text}
            onChange={setText}
            maxLength={CHAT_MAX_LENGTH}
            placeholder={inGame ? "Say to this game's table" : "Say: press Enter to chat, @ to mention"}
            onEscape={(el) => el.blur()}
          />
        </form>
        {error && <p className="error small">{error}</p>}
      </section>
    </div>
  );
});
