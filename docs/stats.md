# The stats

How every number in the game is counted.


- **Tokens:** input + output + cache writes + cache reads.
- **Cost:** all sources use [LiteLLM's table](https://github.com/BerriAI/litellm), refreshed daily, including reasoning-effort matching. If no model price matches, Cursor uses the API's `chargedCents`, falling back to `tokenUsage.totalCents`, preserving zero and fractional cents. Reported values reflect usage-time costs and credit adjustments; there are no hardcoded Cursor rates. Models without either a price or a reported cost contribute $0. These totals combine current model-price estimates with historical reported usage values; they are not subscription invoices.
- **Parallelism ×:** the average number of agents running at the same time, measured over the time you
  had at least one running. Three agents working through the same hour is 3.0×. Time is measured in
  5-minute buckets, subagents count as agents, and you need at least 1 active hour in the range to be
  ranked.
- **Peak agents:** the most agents running at once.
- **Tokens / active hour:** tokens divided by hours with at least one agent running.
- **Days** are Copenhagen days for everyone: one world, one clock.
- **Level** comes from lifetime tokens (1M → Lv1, 1B → Lv7).
- **Houses** show how hard a company's people push: tokens **per member** over the last 30 days. Under 100M
  each is a cellar hatch in a fenced yard; then a shack (100M), cottage (1B), two-storey house (5B), villa
  (15B) and a mansion with a tower (40B). A big team of light users stays in the basement.
- **Coins:** from the day you sign up, every day pays `2.5 × (tokens ÷ 1M)^0.6`: 100M tokens is 39 coins, 1B is 157. A heavy day earns a lot more.
  (Days before 2026-10-27 were paid at `√(tokens ÷ 1M)` and still are.) Finishing a day 1st, 2nd or 3rd adds 25, 15 or 10.
- **Green hours:** the town reads west Denmark's power grid (price area DK1, from Energinet's free
  [Energi Data Service](https://www.energidataservice.dk)). An hour is green when the hour before it ran at
  75 g CO₂/kWh or less (about a third of hours); a banner says so, and tokens burned in it pay a quarter of
  what they'd pay as a day of their own on top (`¼ √(tokens ÷ 1M)`: 100M green tokens is 2 coins). The price
  board on the square's north-east lamp post shows the power price, and when it's in the day's dearest
  quarter (and over 1 kr/kWh) the street lamps burn dimmer.
- **Quests:** three a day, worth 1, 2 and 3 coins, picked for you and scaled to your own last 30 days (at most 6 a day), plus a weekly one for 15. Some are errands in town. Badges climb bronze, silver, gold and diamond, and the longest ladders go on to mythic and cosmic (a 100B-token day, 1000 agents at once); the town hears of gold and up. Trophies are the silly coincidences on your office shelf, 42 of them.
- **The raid:** from the first Monday after launch, every Monday at 08:00 a ladder of five bosses opens in the Raid Dungeon, down the gate in the square,
  easiest first, five in all. Clear all five and the ladder rests until next Monday, when it comes back one level up (The Rate Limit II…) and 10% tougher; fall short and next Monday it starts again at the same level. Every token you sync hits the one up now, no cap, and
  every PR you open is a 25M special attack. When one falls the next, 1.5× tougher, appears at once; each kill pays everyone who'd hit for
  10M or more that week by then 40, 100, 200, 300 and 400 coins (and 10% more for each level the ladder is up). Everyone with agents running sits at a desk in the
  dungeon, wherever they are, firing magic missiles (and a robot minion per extra agent) as fast as they burn
  tokens: that's the show, the hits are the synced tokens. Until the first one the gate is boarded up with a
  ⚠️ and a countdown to that Monday 08:00.
  Each boss also drops its own rare loot: every raider a kill pays rolls its four items, from a 10% hat to a
  0.1% trophy (Golden Hourglass, Infinite Context Crown…). Rolls are fixed per week, rung and player, so nobody
  can reroll. Loot is worn or placed like shop items, and can be traded.

