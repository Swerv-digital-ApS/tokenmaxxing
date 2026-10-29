# Case 2: Ragnarok Eve (design brief)

Status: stage 1 (data, tests, this brief) is done; art (2D, then 3D) and the Mjødhallen shop are later steps.
Code: `core/src/case-ragnarok.ts` (30 wearables), `core/src/case-ragnarok-furniture.ts` (6 pieces), the `ragnarok-eve`
entry in `core/src/cases.ts`. Tests: `core/test/case-ragnarok.test.ts`, `server/test/town-cases.test.ts` ("a second case").

**Merge blocker for the art stage:** the case is already in `CASES`, so once this lands on a deployed server players can open
it. Until the 2D and 3D art below exist, its pets draw as a duck in 3D, its wearables draw nothing, and a placed piece has no
sprite (`web/src/art/objects.ts` `FANCY` is built from `ALL_CASE_PIECES` with `fancyPiece(art)!`, so a piece with no art
would throw when drawn). Do not ship stage 1 alone to production; land it with the art, or gate the `CASES` entry.

## The pitch

The gods hold one last feast before Fimbulwinter and the end of the world, and you are invited. Cozy-comic doom: a
snowed-in longhouse, firelight, horns passed round, ravens gossiping, a wolf pup who is definitely going to be a problem.
Night Market is hot, neon, lacquer and paper; this is cold, oak, iron, fur and frost, lit by ember.

- Case name: **Ragnarok Eve case**. Id `ragnarok-eve`. Blurb: "Furs, horns, ravens and runes from the last feast before the end of the world."
- Key price 100, odds 0.475 / 0.25 / 0.15 / 0.10 / 0.025, `rareWithin` 10, `dupeRerolls` 1: odds and guarantee identical to Night Market (the key costs 100, Night Market's stays 75; the vendor's
  `VENDOR_COINS` are unchanged, so spares return a smaller share of the key). Pool = 30 wearables + 6 pieces = 36 items (the "36" is wearables plus furniture).
- Sold at the existing Natmarked counter for now (`CASE_SHOP_ID` unchanged; `CaseShop.tsx` lists every case in `CASES`).

## Look-index ranges

| Range | Owner |
|---|---|
| below 300 | shop, editions, costumes, loot |
| 300 to 399 | Night Market (`CASE_BASE`) |
| 400 to 499 | Nusantara |
| 500 to 599 | Ragnarok Eve (`RAGNAROK_BASE = 500`) |

Each slot counts from 500 (`slot.500`, `slot.501`, ...). Item id is `<slot>.<index>`; furniture is `furn.<ch>`.
`caseAt(slot, index)` (core/src/case.ts) searches `ALL_CASE_ITEMS`, so `parseLook` and `web/src/art/editions.ts` already
accept every index below. `ALL_CASE_PIECES` (core/src/case-furniture.ts) is the combined furniture list; `casePieceOf`
and `isCasePiece` resolve both cases. A later case appends its own list to both.

## Palette

Ice and ember, not neon. Oak `#6b4a2e`, dark oak `#3f2a1a`, iron `#4a5160`, steel `#7a8394`, bone `#e8dfc8`, fur grey
`#9aa3ad`, frost `#cfe8f2`, fjord blue `#1f3550`, ember `#ff9a3c`, gold `#e9b73d`, raven black `#252a3a` (violet sheen
`#4a4366`), blood red cloth `#a8322e`, woad blue `#3b6fb8`, aurora green `#5af0a0`, aurora violet `#9a7cff`.
Avoid Night Market's plum, crimson lacquer, neon pink and cyan. Ink outline is `C.ink` as everywhere.

## The 30 wearables

Per-slot index is `500 + n`. "Draw" notes are for 2D pixel art and the 3D model alike.

| Slot | Name | Rarity | Idx | Blurb | How to draw it |
|---|---|---|---|---|---|
| hat | Fur hood | common | 500 | Wolf-grey fur, and the snow slides right off. | Rounded grey cap with a lighter fringe, darker ear bumps; 3D a squashed hemisphere with a ring of fringe boxes. |
| hat | Nasal helm | common | 501 | Plain iron and a nose guard. Not one horn, which is how they actually looked. | Dome `#7a8394` with a rivet band and a nasal bar down the face. No horns. |
| hat | Beaded braids | common | 502 | Three braids, a bead on each, one dipped in the soup. | Hair-colour twin braids to the shoulders, one ember or gold bead per braid. |
| hat | Opera horns | uncommon | 503 | Never worn by a Viking. Worn by every Viking in the opera. | Iron cap with big curved bone horns. The joke item about the horned-helmet myth; keep it clearly a costume. |
| held | Drinking horn | common | 500 | Passed round the hall, starting with Odin. It gets to you eventually. | Curved bone-white horn, iron tip cap, foam-gold rim. Foamy liquid, deliberately not clearly beer. |
| held | Round shield | common | 501 | Painted in quarters. Good for blocking, better for sledding. | Disc with a four-colour quartered face (red, bone, woad, gold) and a grey iron boss. |
| held | Tafl board | common | 502 | The king in the middle, and a lot of opinions around him. | Small 7x7 checker board, a gold king dot, dark and light pegs. |
| held | Bearded axe | common | 503 | Chops firewood. Mostly firewood. | Oak handle, crescent iron head. Cartoony, no blood. |
| held | Squeaky Mjölnir | uncommon | 504 | Foam, squeaks on impact, and returns to your hand roughly never. | Stubby hammer, grey foam head, leather-wrapped handle, a pale squeak star. ALWAYS a held toy (see rules). |
| glasses | Warpaint stripes | common | 500 | Two blue stripes across the eyes. Washes off. Mostly. | Two diagonal woad-blue bars across the eye line. |
| glasses | Frosted specs | common | 501 | Rimed with ice because you left them on the porch. | Round lenses, pale frost-white rim, a few white sparkle pixels. |
| glasses | Mimir's lens | uncommon | 502 | Drawn from the well of wisdom. The price was one eye, and you kept both. | Single round lens on a leather strap with a faint blue water shimmer. |
| outfit | Wool tunic | common | 500 | Itchy, sturdy, belted, and smells of wood smoke. | Brown-grey tunic, darker belt, brass buckle. |
| outfit | Brewer's apron | common | 501 | Splashed with the third batch. It was supposed to be the first. | Cream apron, gold stain, mug mark on the chest, rope tie (the Noodle apron's cousin). |
| outfit | Yoke sweater | uncommon | 502 | A Nordic knit with a snowflake yoke. Warm enough for the end of the world. | Cream and navy jumper with a pixel snowflake band across the shoulders (mid-20th-century Icelandic: a cozy joke, not Viking). |
| outfit | Byrnie | uncommon | 503 | Ten thousand little rings, and at least one of them is yours. | Grey mail shirt in a fine dot hatch, iron belt, leather collar. |
| outfit | Berserker bearskin | rare | 504 | Growls on its own. Do not feed it after midnight. | Brown bear pelt, the head on the shoulder, visible claws. |
| outfit | Valkyrie plate | epic | 505 | Silver plate that throws light across the whole sky and pours a decent horn of mead. | Silver breastplate, blue sash, a spear. NO wings (see rules). |
| back | Fur mantle | uncommon | 500 | A shaggy shoulder cape that sheds a bit every time you sneeze. | Grey fur cape pinned with a brooch; a tinted take on the Cape model. |
| back | Skíðblaðnir | epic | 501 | The best of ships, folded like a handkerchief on your back and ready to unfold. | Small folded-sail ship on the back, a striped sail that flaps; fold lines visible. |
| pet | Huginn and Muninn | rare | 500 | Thought and Memory, back from the day's flight with news you didn't want. | Two black ravens (violet sheen) hopping in alternation. 12x10, two frames. |
| pet | Ratatoskr | rare | 501 | Runs up the tree and down again carrying gossip, all of it unkind. | Red-brown squirrel, huge tail, a tiny scroll; frame 2 flicks the tail. |
| pet | Tanngrisnir | rare | 502 | One of Thor's goats, gnashing its teeth. Gets eaten for dinner and is back by morning. | Cream goat, big curved horns, a grin of teeth, stubby tail. |
| pet | Hildisvíni | rare | 503 | Freyja's boar. Its bristles gleam gold and it is very proud of them. | Round pink-brown piglet, tusk nubs, golden back bristles. |
| pet | Sleipnir foal | epic | 504 | Eight legs, all of them in a hurry. | Grey foal with eight leg stubs, two alternating hop frames. The legs are the joke. |
| pet | Fenrir pup | epic | 505 | A wolf pup on a ribbon too thin to hold anything. It will hold, for now. | Grey-black pup, white chest, a thin silver thread leash (Gleipnir). No wolf-hook marks anywhere. |
| aura | Bifröst | legendary | 500 | The burning bridge between worlds, curled round your shoulders. | Rainbow ribbon arc orbiting on a tilt, 4 or 5 segments, shimmering. |
| aura | Valkyrie Lights | legendary | 501 | They say the flicker is valkyrie armour catching the light. | Aurora curtains, green and violet, rippling up behind and round. |
| aura | Rune Gale | legendary | 502 | Odin hung nine nights to learn them. They've been following you since. | Single glowing glyphs (safe set only) circling the body in an amber and white wind. NEVER a wheel or a ring of 12. |
| aura | Ginnungagap | legendary | 503 | Where the ice met the embers and the world began. | Left half pale snow specks drifting down, right half orange embers rising, meeting at the head in a spiral. |

Auras: 2D frame is 28x28 with the 16x16 character at (6,6), 8 frames, `CA_MS` 170 (as `case-aura.ts`). Pets: 12x10 facing
right, two hop frames. Rarity counts: 11 common, 6 uncommon, 5 rare, 4 epic, 4 legendary (tested).

## The 6 furniture pieces

| Char | Art id | Name | Rarity | Placement | w | Blurb | How to draw it |
|---|---|---|---|---|---|---|---|
| З | norse-raven-banner | Raven banner | common | wall | 2 | A black raven on a red cloth, snapping in a draught. | Dark raven silhouette on a red banner, pole and finials; 2 frames of cloth flutter. |
| Ы | norse-bearskin-rug | Bearskin rug | common | flat | 2 | Its expression says it has seen things. | Brown rug with head, paws, a faint grin. |
| Ч | norse-mead-stump | Mead stump | common | floor | 1 | A log stool and a horn of mead, left by the last guest. | Short oak stump, a horn lying on it, a foam ring. |
| Н | norse-feast-table | Feast table | uncommon | floor | 2 | A boar roast that is never finished, which is how it works in Valhalla. | Long plank table, a whole roast boar, bread and mugs, steam (2 frames). |
| Т | norse-runestone | Painted runestone | uncommon | floor | 1 | Painted in loud colours, like the originals. It says "Gorm made this". | Grey standing stone with red and blue paint and a fake inscription made of safe glyphs. |
| Х | norse-yggdrasil | Yggdrasil sapling | rare | floor | 3 | The World Tree, in sapling size: an eagle on top and a squirrel running up and down. | Tall ash, glowing gold leaves, a small eagle, a squirrel animation, a nibbled root. |

`Н Т Х` are Cyrillic (U+041D, U+0422, U+0425) and look like Latin H, T, X: take care in editors and diffs. The uniqueness
test (`case-ragnarok.test.ts`) checks no map, legend, catalog or Night Market piece uses any of the six.

## Box and key (2D `caseBoxSprite`, 3D `buildCaseBox`/`buildCaseKey`)

- Box: an oak sea chest. Plank body in oak, iron bands, dragon-head corner studs, a round shield-boss clasp, frost along the
  lid edge, a plain knotwork band (no runes on the box, so it can never read wrong), a hanging carved wood tally with a
  raven on it. 24x28 canvas like the Night Market's so `CASE_BOX_SIZE` stays valid.
- Open frame: lid up, ice-blue and ember-amber light spilling out; frame 0 a breath-frost puff, frame 1 ember sparks.
- Key: a pierced silver coin on a leather thong with a tiny raven stamp (Night Market's is a gold coin on a red tassel).
  16x24.

## Opening animation (HUD, `CaseOpening.tsx`)

- The strip uses a frost-blue background instead of the warm one.
- The pointer is a raven that hops on each tick.
- Rare and better get a low horn blast (a synthesized brass triad through the existing `tone`/`audio` in `jukebox.ts`):
  Gjallarhorn.
- Legendary adds thunder shaking the strip, a frost vignette, and a Bifröst-coloured beam over the winning tile.

## Mjødhallen and Gudrun (a LATER step, not built)

The first draft sells the case in Natmarked. The later step is a second case shop, "Mjødhallen" ("the mead hall").

- Front (5x4 tiles): a longhouse, steep dark shingle roof, crossed dragon-head gable finials, a row of round shields along the
  eave, a smoking roof vent, a barrel and a horn outside, snow on the roof all year as a joke.
- Interior: a long hearth down the middle, benches (`c`), banners, antlers, a barrel bar as the counter, twelve shelves in
  one row (`Ŧ`-style displays, opening `case`).
- Location: the west side, block `[-1, 0]` across the square from Natmarked (unverified free; `SHOP_BLOCKS` in
  `core/src/maps.ts` holds `[-1,-1] [2,-1] [-1,2] [2,2] [2,0] [2,1]`).
- Keeper: **Gudrun**, a stout mead-wife. Bio: "Keeps Mjødhallen, the mead hall. Fills every horn, tends the fire, and has heard
  the end of the world told three times, differently each time." Greeting: "Hej! Pull up a bench. The ravens have already
  told everyone you are coming." Lines: "The hearth has not gone out since before the mead was invented. Do not ask me how." /
  "The gods are feasting, the wolves are late, and the world ends on Thursday. Take a seat." / "Skål! Drink first, open after.
  Or the other way round. Nobody is counting. Except Odin." / "Every case is sealed with a rune. I only read the first half."
- Code touch points when built: `ShopId`/`SHOP_IDS`/`SHOP_ROOM`/`SHOP_BODY_CHAR`/`SHOP_DISPLAY_CHAR`/`SHOPS` in
  `core/src/shoprooms.ts`; `SHOP_BLOCKS` and `shop-*` map ids in `core/src/maps.ts`; `shopkeepers.ts` keeper and
  `GREETINGS`; a `shop` (or `shopId`) field on `CaseDef` replacing the single `CASE_SHOP_ID`; `web/src/art/shops.ts` and a
  `web/src/art/mjodhallen.ts` front; a `web/src/render3d/shops/mjodhallen.ts` interior (model on `natmarked.ts`);
  `render3d/shops/catalog.ts`, `pages.ts`, `furniture.ts` ids.

## Cultural-sensitivity rules (binding for every art agent)

Sources: ADL hate-symbol entries (Wolfsangel, Sonnenrad, valknot, Thor's hammer, Tyr rune; read in context), Wikipedia on
horned helmets, Vegvisir. Norse paganism (Heathenry, Asatru) is a living religion: playful, respectful, never mocking.

**Never draw:**
- The runes Sowilo (ᛋ), Othala (ᛟ), Tyr (ᛏ), Algiz (ᛉ), including as a letter in a fake inscription or on any item.
- The Wolfsangel (wolf's hook) anywhere: not on the Fenrir pup, a banner, a stamp, a shield.
- The Black Sun / Sonnenrad, or any 12-spoke wheel or radial ring of runes. Rune Gale is a loose stream of single glyphs.
- The valknut (interlocked triangles) on the chest, runestone, furniture, shield or anywhere else.
- Vegvisir (the "Viking compass"): first attested 1860 in an Icelandic manuscript, not Viking, and commercial kitsch.
- Odin himself (no figure of any god as an item). Keeper dialogue may mention him. No hanging, no sacrifice, no blót.
- Wings on the Valkyrie plate (winged helmets are a 19th-century stage convention tied to Wagner).
- Anything Sámi-attributed in the aurora aura; it is Norse-pop only.

**Mjölnir** appears only as the cartoon foam toy "Squeaky Mjölnir", held in the hand. Never a pendant, a necklace, a
tattoo or a wall emblem.

**Safe decorative runes** (Elder Futhark), for the runestone and Rune Gale: ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᛁ ᛃ ᛚ ᛗ. No rune is clean in every
context; never set two of them so they read as a sig-rune pair, and have the finished art looked at by a person. The fake
runestone text is "Gorm made this" in those glyphs or plain pixel texture.

**Other care:** the horned helmet is a myth and Opera horns is the joke about it, so the real helmets (Nasal helm) have no
horns. Drinking horns hold foam gold, ambiguously not-beer (young audience). The aurora's "valkyrie armour" origin is a
modern popular retelling, not an Old Norse source, so the blurb says "they say". Bearskin and fur are cartoon, never gory.

## Art checklist: where Night Market's art is registered, and what to extend

Nothing was stubbed in stage 1; the tables below are simply absent for indices 500 to 599, so the case is incomplete until
they are added. The numbering for the art tables is the look index (500 + n) unless noted.

### 2D (`web/src/art`)

| File | What it holds for Night Market | What to add |
|---|---|---|
| `case.ts` | `CASE_HATS`, `CASE_GLASSES` keyed by item id (`"hat.300"`) | Ragnarok hats `"hat.500"`..`"hat.503"` and glasses `"glasses.500"`..`"glasses.502"` (new file `case-ragnarok.ts`, or extend) |
| `editions.ts` (`artOf`, ~line 164) | looks up `CASE_HATS`/`CASE_GLASSES` after `caseAt` | spread the Ragnarok tables into that lookup |
| `case-body.ts` | `CASE_OUTFITS`, `CASE_HELD`, `CASE_BACKS` keyed by look index (`at(n)` = `CASE_BASE + n`) | Ragnarok outfits 500..505 (six `marks` views each), held 500..504, backs 500..501 |
| `wardrobe.ts` (~line 664) | `Object.assign(OUTFITS, CASE_OUTFITS)` and the held/back equivalents | the same three merges for the new tables |
| `case-pets.ts` | `CASE_PETS`: 12x10 two-frame pets | `RAGNAROK_PETS` in order 500..505 |
| `pet-base.ts` (~line 205) | `PETS[CASE_BASE + i] = pet` | `PETS[RAGNAROK_BASE + i]` for the new array |
| `case-aura.ts` | `DRAWS` keyed `CASE_BASE + 0..3` (28x28, 8 frames) | `RAGNAROK_BASE + 0..3` draws |
| `characters.ts` (~line 483) | `caseAuraIcon(i)` for the bag square | works once `DRAWS` has the indices |
| `case-box.ts` | `caseBoxSprite(kind, frame)`: the lacquer chest and the coin key | a per-case variant (add a `caseId` argument, defaulting to Night Market) and the oak chest and silver key; also update `CaseShop.tsx` and `CaseOpening.tsx` callers |
| `furniture-home.ts` (~line 764) | `CASE_FURNITURE` via `piece(id, name, w, h, price, draw, {frames, placement, rarity})` | a `RAGNAROK_FURNITURE` list with the six `norse-*` ids from the table |
| `furniture-fancy.ts` (~line 1080) | `fancyPiece(id)` searches `CASE_FURNITURE` | also search the new list |
| `objects.ts` | `FANCY` map built from `ALL_CASE_PIECES` (already wired) | nothing, but it needs `fancyPiece(art)` to be non-null |
| `tiles.ts` | wall pieces from `ALL_CASE_PIECES` (already wired) | nothing |
| `natmarked.ts`, `shops.ts` | Natmarked's front and tiles | only for the later Mjødhallen step |

### 3D (`web/src/render3d`)

| File | What it holds for Night Market | What to add |
|---|---|---|
| `case-box3d.ts` | `buildCaseBox(open)`, `buildCaseKey()`, `caseBoxIcon(kind, size)` | oak chest and silver coin key (parameterise by case) |
| `pets/pets3d-night.ts`, `data/pets.ts` | six voxel species; `CASE_PET_BASE = 300`, `CASE_PET_SPECIES`, `speciesAt(n)` | a second base (500) and species list; `speciesAt` currently maps only `n >= 300` to the Night Market list, and an unknown species falls back to `"duck"` in `pets3d.ts` (so Ragnarok pets show as ducks until added); also add each species to the `Species`, `PET_NAME` tables |
| `people/gear3dCase.ts` | outfits via `OUTFIT_BUILDERS[CASE_BASE + n]`; held and back builders keyed by item NAME in `HELD`/`BACKS`, merged with `Object.assign(HELD_BUILDERS, HELD)` | Ragnarok outfits at `RAGNAROK_BASE + n`, held and back by name (`"Drinking horn"`, `"Skíðblaðnir"` ...) |
| `people/gear3d.ts` | `import "./gear3dCase.ts"` registers the builders | import the new file |
| `people/gear3dAura.ts` | `AURA_BUILDERS["Lantern Sky"]` etc. keyed by item NAME | `"Bifröst"`, `"Valkyrie Lights"`, `"Rune Gale"`, `"Ginnungagap"` |
| `people/gear3dHead.ts` | `HAT_BUILDERS`/`FACE_BUILDERS` keyed by NAME, two `// The Night Market case.` blocks (~966 and ~1620) | hats `"Fur hood"`, `"Nasal helm"`, `"Beaded braids"`, `"Opera horns"`; glasses `"Warpaint stripes"`, `"Frosted specs"`, `"Mimir's lens"` |
| `data/gear.ts` | outfit palette `[main, shade, trousers]` keyed by index (300..305) | 500..505 |
| `furniture/night3d.ts` | `NIGHT_ASSETS` (id, name, w, d, build) | a `norse3d.ts` with `NORSE_ASSETS` for the six `norse-*` ids |
| `furniture/furniture3d.ts` | spreads `NIGHT_ASSETS` (~line 766); `WALL_ASSET_IDS` lists `"night-lanterns"` | spread `NORSE_ASSETS`; add `"norse-raven-banner"` to `WALL_ASSET_IDS` |
| `icons.ts` | `pieceAsset(ch)` finds art via `casePieceOf` (already resolves both cases) | nothing, once the assets exist |
| `rooms/room-furnished.ts` | binds `ALL_CASE_PIECES` art ids (already wired) | nothing |
| `shops/natmarked.ts` | the 3D Natmarked | only for Mjødhallen later |

### HUD

`web/src/hud/CaseOpening.tsx` has `CASE_NAME = "Night Market Case"`, a lantern emoji in the title, `PLACEHOLDER_*` odds and a
`CASE_POOL` fallback built from Night Market only; the live path uses `def.items`. For the frost strip, the raven pointer and
the horn blast, give it a per-case theme keyed by `def.id`. `CaseShop.tsx` already lists every `CASES` entry.
