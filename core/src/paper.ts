/**
 * The morning paper: four headlines about yesterday in town, filled into templates from numbers the
 * town has anyway. Pure and seeded by the day, so a day's paper reads the same to everyone and in
 * tests; `town` builds it once a day (`server/src/town/paper.ts`).
 */
import { compact, fill } from "./format.ts";
import { random } from "./games/random.ts";

/** What the paper can write about one world day. Nulls are things that didn't happen. */
export interface PaperFacts {
  /** The day it's about, `YYYY-MM-DD`. */
  day: string;
  /** Everyone's tokens, and how many people used any. */
  tokens: number;
  people: number;
  burner: { name: string; tokens: number } | null;
  company: { name: string; tokens: number; members: number } | null;
  prs: number;
  shipper: { name: string; prs: number } | null;
  prompts: number;
  model: { name: string; tokens: number } | null;
  pet: { owner: string; pet: string; place: string } | null;
  game: { name: string; game: string; won: number } | null;
}

interface Headline {
  title: string;
  /** The line under it. */
  deck: string;
}

export interface Paper {
  /** The day it's about. */
  day: string;
  headlines: Headline[];
}

export const HEADLINES = 4;

type Story = [string, string][];

/** The lead: whoever burned the most. `{name}`, `{tokens}`. */
const BURNER: Story = [
  ["{name} burns {tokens} tokens", "Cloud provider sends a fruit basket and a 'we noticed' email."],
  ["{name} hits {tokens} tokens, says it was 'mostly cache reads'", "Accountants unconvinced."],
  ["{name} spends {tokens} tokens on a 'small refactor'", "The diff is 4,000 lines. The PR title is 'nit'."],
  ["{tokens} tokens: {name} tops the board", "Neighbours report hearing laptop fans from across the square."],
];
/** `{name}`, `{tokens}`, `{members}`. */
const COMPANY: Story = [
  [
    "{name} burns {tokens}, calls it 'an investment in velocity'",
    "{members} on the team. One standup. Forty minutes.",
  ],
  ["{name} leads the town with {tokens}", "CFO seen pacing by the fountain."],
  ["{name}: {tokens} tokens and counting", "Insiders say the roadmap is 'just vibes, but fast'."],
];
/** `{prs}`, and `{name}` with `{n}` for the top shipper. */
const PRS: Story = [
  ["{prs} PRs opened in town", "Reviewers update LinkedIn to 'open to work'."],
  ["{name} opens {n} PRs in a day", "Approves own vibes. 'LGTM' remains the town's most-typed phrase."],
  [
    "Merge queue reaches the Inn: {prs} PRs yesterday",
    "{name} alone sent {n}. Nobody read the descriptions.",
  ],
];
/** `{owner}`, `{pet}`, `{place}`. */
const PET: Story = [
  ["{owner}'s {pet} spotted at {place}", "Witnesses say it 'looked like it knew where the bug was'."],
  ["Sighting: a {pet} at {place}", "Belongs to {owner}. Has not been invited to standup. Yet."],
  ["{pet} seen near {place}, refuses to comment", "{owner} says it's 'between projects'."],
];
/** `{name}`, `{game}`, `{won}`. */
const GAME: Story = [
  ["{name} wins 🪙 {won} at {game}", "Plans to spend it on 'compute'. It's pølser."],
  ["{game}: {name} walks off with 🪙 {won}", "Losers demand a rematch and a post-mortem."],
];
/** `{name}`, `{tokens}`. */
const MODEL: Story = [
  [
    "{name} did most of the typing yesterday",
    "{tokens} tokens. It would like that on its performance review.",
  ],
  ["{name} writes {tokens} tokens of the town's code", "Humans 'reviewed' it. Some of it."],
];
/** `{tokens}`, `{people}`, `{prompts}`. */
const TOWN: Story = [
  ["Town burns {tokens} across {people} devs", "The fountain now runs entirely on cache reads."],
  ["{prompts} prompts sent from town", "Most of them were 'try again', 'no, the other one' and 'continue'."],
];
/** When there's nothing to report. */
const QUIET: Story = [
  ["Quiet day in town", "CI took a long lunch. Nobody noticed."],
  ["Build snail still deploying", "Sources close to the snail say it's 'nearly there'."],
  ["Nothing shipped, everything is fine", "Everything is not fine. But nothing shipped."],
  ["Pølsevogn reports steady demand", "'Med det hele' remains the house favourite."],
  ["Town clock confirms it is, in fact, Copenhagen time", "Remote workers in other timezones file a ticket."],
];

/** A day key as a seed: the same paper for everyone, a different one tomorrow. */
function seedOf(day: string): number {
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

function shuffle<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Yesterday's front page: the biggest burner leads, then up to three other stories picked by the
 * day, then filler when the town was quiet. Always `HEADLINES` of them, never two from one template set.
 */
export function headlines(f: PaperFacts): Headline[] {
  const rand = random(seedOf(f.day));
  const pick = (story: Story, vars: Record<string, string | number>): Headline => {
    const [title, deck] = story[Math.floor(rand() * story.length)]!;
    return { title: fill(title, vars), deck: fill(deck, vars) };
  };
  const lead = f.burner && pick(BURNER, { name: f.burner.name, tokens: compact(f.burner.tokens) });
  const others: Headline[] = [];
  if (f.company)
    others.push(
      pick(COMPANY, { name: f.company.name, tokens: compact(f.company.tokens), members: f.company.members }),
    );
  if (f.prs > 0 && f.shipper) others.push(pick(PRS, { prs: f.prs, name: f.shipper.name, n: f.shipper.prs }));
  if (f.pet) others.push(pick(PET, f.pet));
  if (f.game && f.game.won > 0) others.push(pick(GAME, f.game));
  if (f.model) others.push(pick(MODEL, { name: f.model.name, tokens: compact(f.model.tokens) }));
  if (f.people > 1)
    others.push(pick(TOWN, { tokens: compact(f.tokens), people: f.people, prompts: f.prompts }));
  // Shuffled by the day: which stories make the front page changes from day to day.
  const quiet = shuffle(QUIET, rand).map(([title, deck]) => ({ title, deck }));
  return [...(lead ? [lead] : []), ...shuffle(others, rand), ...quiet].slice(0, HEADLINES);
}
