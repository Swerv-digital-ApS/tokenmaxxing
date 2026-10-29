/**
 * Bent, the Tavern's barkeep: a town character who never leaves his cell behind the bar. He talks about
 * the hour, the weather, the crowd and the day's special; at the bar he takes your order (a coffee, the
 * special, or work off the quest board). The `world` actor places him on wake (`home`) and never walks him (`still`).
 */

import { BADGES, frameOf } from "./badges.ts";
import type { BotDef } from "./bots.ts";
import { BOT_LEVEL } from "./format.ts";
import { lookWith } from "./world.ts";

/** His cell: the rug behind the bar, in the Tavern (`inn`). Nothing but him can step there. */
export const BARKEEP_HOME = { room: "inn", x: 5, y: 3, facing: "down" } as const;

export const BARKEEP: BotDef = {
  id: -4,
  name: "Bent the Barkeep",
  // Overalls for an apron, and a mug in hand.
  look: lookWith({ style: 0, skin: 2, hair: 3, outfit: 22, held: 1 }),
  level: BOT_LEVEL,
  bio: "Runs the Tavern. Pulls the day's special, keeps the quest board and remembers who sat where. Has heard every excuse for a failing build.",
  home: BARKEEP_HOME,
  still: true,
  lines: [
    "What'll it be? The special's on the board.",
    "Nobody ever orders the decaf. Nobody.",
    "Sit anywhere. The stools are all the same wobbly.",
    "Take a quest off the board. They pay in coins and bragging rights.",
    "The Hall of Fame is on the wall. Mind the gold ones.",
    "I don't judge anyone's token count. I just pour.",
    "A fire, a stool, a pint. That's the whole stack.",
    "Behind this bar I have heard every build excuse there is.",
    "Regulars get their name on a plaque by the hearth.",
    "Back in my day we deployed on Fridays. Once.",
    "The stage is open. Mind the lute.",
    "Beds are in the corner, if you need one.",
    "The town cat was asleep by the square again. Better company than most error logs.",
    "Someone startled the pigeons. They'll be back before the next build.",
    "Heard a commotion down in the dungeon. Must be another raid.",
    "If you find a secret in town, don't tell me. I like the mystery.",
  ],
  every: [30_000, 90_000],
  followChance: 0,
  moments: [
    {
      from: 6,
      to: 11,
      lines: [
        "Morning. Coffee's at the fountain, the special's at the tap.",
        "Early one. The fire's just warming up.",
      ],
    },
    {
      from: 17,
      to: 23,
      lines: [
        "Evening crowd's in. Pull up a stool.",
        "The fire's at its best after dark.",
        "Dinner service. The special's still on.",
      ],
    },
    {
      from: 0,
      to: 6,
      lines: [
        "Last orders were hours ago. Stay anyway.",
        "Quiet at this hour. Just the fire and the servers.",
      ],
    },
    { days: [5], from: 15, lines: ["Friday. Nobody deploys. Everybody orders."] },
    { days: [0, 6], lines: ["Weekend crowd. Good, I like a full house."] },
  ],
  weatherLines: {
    rain: ["Rain again. You're staying for one more.", "Listen to that rain. Stay a while."],
    drizzle: ["A little drizzle never hurt a regular."],
    storm: ["That storm can wait outside. Fire's lit in here."],
    snow: ["Snow out there. Warm yourself by the hearth."],
    fog: ["Fog like that and you can't find the door. Have another."],
    clear: ["Lovely day. I wouldn't know. I'm in here."],
    cloudy: ["Grey out there. Good tavern weather."],
  },
  crowdLines: {
    empty: ["Quiet in here. Just me and the fire.", "Empty room. More special for me."],
    busy: ["Busy tonight! Good, the barrels are full.", "Packed house. Mind the elbows."],
  },
  specialLines: ["Today's special: {special}", "On the board today: {special}"],
  keynoteLines: {
    soon: [
      "{title}, on the big screen {when}. Popcorn's on the house.",
      "Watch party here {when}: {title}. Bring a friend.",
      "I've dusted off the projector for {title}. {when}, don't be late.",
    ],
    live: [
      "Shh! {title} is on.",
      "A round for whoever guesses the context window.",
      "Every time they say 'agentic', the special's on me. Kidding.",
      "The stream's link is on the screen, if you want it in HD.",
      "Best seats are by the stage. Mind the lute.",
    ],
  },
};

/** He mentions at most one award this often; the rest are dropped. */
export const REMARK_GAP_MS = 30_000;

/** Whether he may speak up again at `now`, given when he last did. */
export const mayRemark = (last: number, now: number): boolean => now - last >= REMARK_GAP_MS;

/** His one-liner for a fresh award: a gold or diamond badge tier, or a level milestone. Null if unknown. */
export function awardRemark(name: string, badge: string, tier: number): string | null {
  if (badge === "level") return `${name} just hit level ${tier}. Drinks are on the house. Not really.`;
  const def = BADGES.find((b) => b.id === badge);
  if (!def || !def.tiers[tier - 1]) return null;
  return `${name} just hit ${frameOf(tier, def.tiers.length)} in ${def.name}`;
}
