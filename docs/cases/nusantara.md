# Case #2: Nusantara (design brief for the art stages)

Status: stage 1 is in (data, tests, wiring). Not yet drawn: no 2D art, no 3D art, no Pelabuhan building. This file is what the 2D and 3D agents build from.

- Theme: the Indonesian archipelago, loaded off a pinisi (the Sulawesi sailing ship) at a sunny harbour. Every item comes from a different island.
- Mood: **daylight**, saturated and tropical. Night Market is dusk, neon, plum and lantern gold. Nusantara is teak, sea-turquoise, saffron, batik cream, rice green. Do not reuse lanterns, koi, kitsune, neon or ramen as a core motif.
- Case id `nusantara`, name "Nusantara case", blurb "Hats, pets, outfits and instruments from the islands, loaded off the morning boat.", key 100 coins, the Night Market's odds (47.5 / 25 / 15 / 10 / 2.5), a rare or better within 10, one dupe reroll. Sold, for now, in Natmarked (`CASE_SHOP_ID` is unchanged).
- Code: `core/src/case-nusantara.ts` (30 cosmetics, `NUSANTARA_BASE = 400`), `core/src/case-nusantara-furniture.ts` (6 pieces), the `CaseDef` in `core/src/cases.ts`. The pool is **30 cosmetics + 6 pieces = 36 items**, the same shape as the Night Market's.

## 1. Look indices

Look index = `400 + n`, `n` counting up per slot in the file's order. Item id = `<slot>.<index>`. The Night Market owns 300 to 399.

| Slot | n | Index | Item |
|---|---|---|---|
| hat | 0, 1, 2, 3 | 400 to 403 | Blangkon, Peci, Ojek helmet, Little Bromo |
| held | 0 to 3 | 400 to 403 | Es teh, Angklung, Layang-layang, Takraw ball |
| glasses | 0, 1, 2 | 400 to 402 | Kawung specs, Coconut shades, Wayang eyes |
| outfit | 0 to 5 | 400 to 405 | Batik shirt, Deckhand stripes, Kebaya, Silat pangsi, Songket gala, Ondel-ondel |
| back | 0, 1, 2 | 400 to 402 | Fruit bakul, Wayang bundle, Dadak merak |
| pet | 0 to 5 | 400 to 405 | Komodo, Tarsier, Enggang, Rafflesia, Cenderawasih, Orangutan |
| aura | 0 to 3 | 400 to 403 | Mega Mendung, Gamelan Echo, Wayang Shadows, Padi Gold |

## 2. Pool (30 cosmetics)

Draw notes use the repo's usual primitives: 16x16 character grids (hats from row 0, glasses from row 5), 12x10 pet sprites facing right with two hop frames, 28x28 aura frames with the 16x16 character at (6, 6) and eight frames looping. 3D is built from boxes, spheres and cylinders in the existing kit.

### Common (11)

| Slot | Name | Idx | Blurb | How to draw it |
|---|---|---|---|---|
| hat | Blangkon | 400 | A folded batik headcloth with the little knot at the back. | Dome in brown and indigo, cream diamond grid, a tan band, a small bump at the back (the side view shows it). |
| hat | Peci | 401 | Black velvet, worn straight, a touch forward. | Short flat-topped cylinder in near-black with a faint highlight band. |
| hat | Ojek helmet | 402 | Open-face, sticker-scarred, rated for one more shortcut. | Pale-green half-dome, a flip visor, red and yellow sticker pixels. |
| held | Es teh | 400 | Sweet iced tea in a knotted bag, straw in. Don't swing it. | Translucent amber bag, knot on top, white-and-red straw, white ice squares. |
| held | Angklung | 401 | Shake it for one note. Bring friends for a song. | Bamboo frame with 3 tubes of graduated length; a 2-frame shake wiggle. |
| held | Layang-layang | 402 | A diamond kite, its string tied twice round your wrist. | Red and yellow diamond, cross-spar, stepped tail; the string is a 1px line to the hand. |
| held | Takraw ball | 403 | Woven rattan, kicked, never dropped. Mostly. | Tan sphere with a darker hex-weave grid; bounces a pixel. |
| glasses | Kawung specs | 400 | Round frames in batik's four-petal circle pattern. | Two rings in dark brown, a cream four-oval motif on each rim. |
| glasses | Coconut shades | 401 | Half a coconut each. Cooler than they look. | Two hairy brown half-domes, a dark slit "lens", a cream rim. |
| outfit | Batik shirt | 400 | Brown and cream diamonds, ironed for Batik Day. | Brown torso, cream diamond marks, slim placket, short sleeves. |
| outfit | Deckhand stripes | 401 | A salt-stiff striped tee off the pinisi crew. | Navy and cream horizontal stripes, rolled cuffs, a rope belt. |

### Uncommon (6)

| Slot | Name | Idx | Blurb | How to draw it |
|---|---|---|---|---|
| hat | Little Bromo | 403 | A crater on your head. It smokes when you stand still. | Grey-brown cone, red lava rim, 2-frame grey puffs rising. |
| back | Fruit bakul | 400 | A rattan basket of rambutan, mangosteen and salak, balanced just so. | Tan woven cone basket; red fuzzy dots (rambutan), purple balls (mangosteen), brown scaly dots (salak). 3D: basket with a sling. |
| back | Wayang bundle | 401 | A gunungan and a clown puppet in a bamboo case. Not for display. | Dark-brown leather shapes with gold cut-out dots, bamboo sticks poking up. Only the gunungan and a generic long-nosed clown. |
| glasses | Wayang eyes | 402 | Almond eyes cut from leather, gold-painted, always looking sideways. | Two slanted almonds in black with a gold outline and a side-turned pupil. |
| outfit | Kebaya | 402 | Teal lace, a gold brooch, an afternoon's patience. | Teal torso, dotted-lace marks, a gold brooch pixel, cream hem. |
| outfit | Silat pangsi | 403 | Loose black, a red sash, a very calm stare. | Black torso and trousers, red sash across the belly, knot at the hip. |

### Rare (5)

| Slot | Name | Idx | Blurb | How to draw it |
|---|---|---|---|---|
| pet | Komodo | 400 | Tongue first, tail after. Walks like it has all day. | Olive-grey long body, yellow forked tongue that flicks on frame 2, stubby tail. |
| pet | Tarsier | 401 | Eyes bigger than its dinner. Clings to your sleeve. | Tiny tan body, two huge round eyes (white with dark pupil), spindly fingers. |
| pet | Enggang | 402 | A casque the colour of sunset, flapping a beat behind you. | Black body, orange-red casque on a cream bill, white tail with a black band (rhinoceros hornbill). |
| pet | Rafflesia | 403 | A flower bigger than it should be, and it smells worse. | Wide red 5-petal bloom with cream spots on two tiny legs; petals bob. |
| outfit | Songket gala | 404 | Gold thread through crimson silk, one thread at a time. | Crimson torso, gold diagonal lattice marks, bright hem. |

### Epic (4)

| Slot | Name | Idx | Blurb | How to draw it |
|---|---|---|---|---|
| back | Dadak merak | 402 | A fan of peacock eyes the size of a doorway, rising behind you. | Radial fan of blue-green eye-feathers with gold centres around a red face. 3D: a big flat fan with a gentle sway. **Fabric and feather only, never tiger or leopard skin.** |
| pet | Cenderawasih | 404 | Two long plumes trail behind it, still dancing. | Small yellow-and-brown body, emerald throat, two curling tail wires with a bob (bird-of-paradise). |
| pet | Orangutan | 405 | The person of the forest, hanging on to your shoulder. | Round orange shaggy mass, darker face disc, long arms, one hand gripping the edge. |
| outfit | Ondel-ondel | 405 | Two metres of parade, red-faced and cheerful, and you're inside it. | Big red round face with white eyes and a grin on the chest; ruff and leaf skirt in coconut yellow-green; striped bright tunic. Friendly. |

### Legendary auras (4)

| Name | Idx | Blurb | How to draw it |
|---|---|---|---|
| Mega Mendung | 400 | A batik cloud drifts round you, stacked and indigo, and drizzles a little. | Scalloped stacked clouds in 4 indigo-to-pale-blue bands on a ring; 2-3 drops fall each frame. |
| Gamelan Echo | 401 | Bronze ripples spread out from you with every step, as if you were struck. | Expanding concentric gold rings that fade, plus 4 small bronze discs on a ring, each pulsing in turn. |
| Wayang Shadows | 402 | Little cut-out silhouettes circle you in lamplight. | Warm amber ring glow; 4 black cut-out silhouettes (leaf, bird, tree, tall figure) with gold edges orbiting. |
| Padi Gold | 403 | Rice stalks sway round your feet while golden grains float up. | Ring of green stalks with golden heads swaying out of phase at the feet; yellow grain pixels rising and fading. |

## 3. Palette

Nusantara reads as daylight. Use these, not the Night Market's plum/crimson/neon.

| Name | Hex | Used for |
|---|---|---|
| teak | `#8a5a2b` | wood, crates, basket weave |
| teak dark | `#5a3a1c` | outlines, shadows |
| sea turquoise | `#1fb5b0` | rope handles, hull trim, shop roof |
| deep sea | `#0f6e86` | water, shade of turquoise |
| saffron | `#f2b632` | highlights, brass, gold thread |
| hibiscus red | `#d6343a` | ondel-ondel face, sash, kite |
| batik cream | `#f1e3c2` | batik lines, sail, shirt motifs |
| batik indigo | `#243a73` | cloth base, mega mendung |
| soga brown | `#6b4226` | batik base |
| rice green | `#6fbf4a` | padi, sawah |
| leaf green | `#2f7f3a` | canopy, stalks |
| bronze | `#b9803a` | gamelan |
| ink | the existing `C.ink` | outlines |

## 4. Furniture (6 pieces)

Characters are Cyrillic and checked by `core/test/case-furniture.test.ts` against every map row, legend tile and catalogue. The Night Market owns Ж Щ Я Ф Д Ц. Item id `furn.<ch>`. They go down only in the owner's own office, are tradeable and free.

| Ch | Art id | Name | Rarity | Width | Placement | Blurb | Draw |
|---|---|---|---|---|---|---|---|
| Б | `nus-batik-hanging` | Batik hanging | common | 2 | wall | A length of hand-waxed batik on a bamboo pole. | Wide cloth in indigo, brown and cream with a repeating diamond/kawung grid, bamboo bar on top. Height one tile (wall pieces fit one row). |
| Г | `nus-sawah-rug` | Sawah rug | common | 2 | flat | Rice terraces woven in steps, with one patient buffalo. | Stepped green bands with water-blue lines and a tiny buffalo silhouette. |
| Ш | `nus-warung-stool` | Warung stool | common | 1 | floor | Low, red, plastic, and the only seat that matters. | Red mono-block stool, a glass of tea on top. |
| Э | `nus-angkringan-cart` | Angkringan cart | uncommon | 2 | floor | A glass-front cart, a hissing kettle, and fried snacks in neat rows. | Wooden cart, glass cabinet with brown fried shapes, red tarp, a lamp; 2 frames (steam). |
| Ю | `nus-bonang-rack` | Bonang rack | uncommon | 2 | floor | A dozen bronze pots on a rope bed, mallets left in the middle. | Carved red-gold wood frame, two rows of bronze knobbed pots, two mallets. |
| Й | `nus-pinisi` | Pinisi on the stand | rare | 3 | floor | A pinisi under full sail, ready to be unloaded. | Teak hull, two masts, 6 to 7 white and cream sails, pennant, wooden cradle. 2 frames (pennant). |

2D art is registered by art id in `web/src/art/furniture-home.ts` (see section 9); 3D by the same id. Names and widths must match core exactly (`web/test/item-parity.test.ts` and `furniture-home.test.ts` compare them once the pieces are added to their lists).

## 5. The case box and the key

Night Market: a plum-to-crimson lacquered crate with a lantern emblem, gold straps, and a gold coin with a square hole on a red tassel. Nusantara must be a different silhouette and a different colour world.

- **Box (24x28, same canvas as `art/case-box.ts`):** a teak sea chest. Warm teak planks with dark seams, rattan-wrapped corners, **turquoise rope handles** on both sides, a **batik kawung band** (cream four-oval motifs on indigo) across the lid, a white sail emblem on the front.
- **Open frame:** the lid pops, **daylight** (cream-white and warm gold, not the lantern glow) bursts out, **white jasmine (melati) petals** sparkle upward. Two sparkle frames as before.
- **Key (16x24):** a brass key with an **anchor-shaped bow**, hung from a knotted batik ribbon. Not a coin with a hole.
- 3D versions (`case-box3d.ts`): the same chest, lid hinged, the petals as a small particle burst.
- The box and key are currently a single Night Market sprite with no case parameter (`caseBoxSprite(kind, frame)`, icon `{ kind: "case", what }`), so the 2D and 3D stages must add a case id (or a second set of sprites) and pass `def.id` from `CaseShop.tsx` and `CaseOpening.tsx`.

## 6. The opening

- **Gunungan pointer.** The reel's marker is a gunungan outline (the leaf/mountain shape, "tree of life", that opens and closes a wayang show) instead of a plain line. Draw it as a small gold-edged teardrop with a tree inside; it sways once as the reel lands and settles. Keep it clean: no deformation, no comedy.
- **Kelir.** Frame the strip like a warm lit cloth screen (the kelir), cream with a soft amber glow from below.
- **Landing.** The strip lands on a bronze gong stroke: one expanding ring pulse in gold, the winning tile lit.
- **Ticks.** Reel ticks step up a five-note scale (slendro-like, bamboo/angklung timbre) using the existing `tone` helper; the final tick is a low gong.
- Respect `prefers-reduced-motion` as the current opening does.

## 7. Pelabuhan (the shop) and Budi (the keeper) -- LATER STEP, NOT BUILT

For now the case is sold in Natmarked. When the building is made:

- **Shop:** "Pelabuhan" (Indonesian for harbour), sign `PELABUHAN`. A sun-bleached dockside warehouse: corrugated turquoise roof, hand-painted sign, ceiling fans, rolled-up shutters, a pinisi hull moored outside the side door and visible through it. Lit and open, the opposite of Natmarked's dusk.
- **Plan:** reuse Natmarked's 18x12 plan. Back-wall displays are teak and rattan crates on pallets (`case` displays). The counter is a warung cart with a glass cabinet. Seats (`c`) are red plastic stools. Fixtures (`‡`) are rice sacks, rattan baskets and a hanging batik.
- **Code needed:** `CASE_SHOP_ID` is one constant and `ShopId` has six entries, so this means a `shop` field on `CaseDef`, a new `ShopId`, `SHOP_ROOM`, `SHOP_DOOR_CHAR` and `SHOP_DISPLAY_CHAR`, plus `SHOP_SELLS`, `SHOP_TABS`, `GREETINGS`, a keeper in `shopkeepers.ts`, the door rule `inCaseShop` in `server/src/actors/town.ts` (it checks the one `CASE_SHOP_ID`, and its error text says "Night Market"), and `web/src/render3d/shops/` plus the 2D front. The alternative is a second row of stalls inside Natmarked.
- **Keeper:** Budi, a friendly man in sandals who runs the warehouse and the tea. Running gag: *jam karet* ("rubber time"), meaning the boat comes when it comes.
  - Bio: "Runs Pelabuhan, the harbour warehouse where the crates come ashore. Sells you a case and a glass of tea, in that order, and never says which island it came from."
  - Greeting: "Selamat datang! Mind the crates, they came a long way."
  - Lines: "Selamat datang! Sit, sit. The tea is free. The case is not." / "Every crate came in on the morning tide. I haven't opened one. Not once." / "Jam karet, my friend. The boat arrives when it arrives. So does your luck." / "Batik on the left, bamboo on the right, and something with feathers in the back." / "Doubles? Bring them to the counter. Someone on the next island wants a spare." / "Hot today. Come in, the fan works. Sometimes."

## 8. Cultural-sensitivity rules (hard rules for every stage)

Indonesia is majority Muslim and very proud of these things. Follow these, and flag a doubt rather than guessing.

- No pork, no alcohol, no tobacco or kretek, no babirusa (a pig-deer).
- No kris (a sacred weapon).
- No Barong or Rangda, no Balinese temple gates (candi bentar), no canang offerings. Sacred.
- No Garuda emblem or national coat of arms. The Javan hawk-eagle may be drawn as itself, as a bird.
- No frangipani/kamboja (a grave flower in Java). Jasmine (melati) is the flower.
- Dadak merak is a **fabric and feather peacock fan only**: no tiger or leopard skin, no trance, no gemblak/warok story.
- Ondel-ondel is a friendly parade figure. **Never call it a spirit** in copy or tooltips.
- Wayang: only the **gunungan** and a **generic long-nosed clown puppet**. No Semar (a god-figure), no epic heroes or deities.
- Peci is the national cap; fine as secular dress. Drop it if anyone objects.
- Do not use the Indonesian flag as decoration or the red-and-white as a motif; no real brands (no ride-hailing or soda logos).
- Keep Toraja houses (tongkonan) out: they are tied to funerals and ancestors.
- Mega mendung's origin is disputed (Chinese influence or native Cirebon): describe the look, not the origin.
- "Nusantara" is also the name of the new capital city. If that is a problem, the fallback name is "Archipelago case".
- Nothing is mocking: the blurbs tease the objects, never the people.

## 9. File-by-file checklist for the art stages

Each Night Market table is listed with the Nusantara change. Index key: `400 + n` (see section 1).

### Done in stage 1 (data and wiring)

- `core/src/case-nusantara.ts`, `core/src/case-nusantara-furniture.ts`: the data.
- `core/src/case.ts`: `ALL_CASE_ITEMS`, and `caseAt` resolves both cases.
- `core/src/case-furniture.ts`: `ALL_CASE_PIECES`, and `casePieceOf` / `isCasePiece` cover both.
- `core/src/shop.ts`: the item catalogue spreads `ALL_CASE_ITEMS` and `ALL_CASE_PIECES`.
- `core/src/cases.ts`: the `nusantara` `CaseDef`.
- `core/src/maps.ts`, `core/src/office.ts`: the tile kinds and `pieceOf` use `ALL_CASE_PIECES`.
- `web/src/art/objects.ts`, `web/src/art/tiles.ts`, `web/src/render3d/rooms/room-furnished.ts`: use `ALL_CASE_PIECES`. In `objects.ts`, case pieces with no art yet are filtered out of the `FANCY` map, so they draw nothing instead of throwing.
- `web/src/render3d/icons.ts`, `web/src/hud/Shop.tsx`: use `casePieceOf`, which covers both cases already; no change needed.

### 2D art (all keyed by index `400 + n`, or by item id `slot.4nn`)

| File | Night Market has | Nusantara needs |
|---|---|---|
| `web/src/art/case.ts` | `CASE_HATS`, `CASE_GLASSES`, keyed by item id (`hat.300`) | New tables for `hat.400..403`, `glasses.400..402`. `art/editions.ts` `artOf` looks the id up in `CASE_HATS` / `CASE_GLASSES`: add the new tables there. |
| `web/src/art/case-body.ts` | `CASE_OUTFITS`, `CASE_HELD`, `CASE_BACKS`, keyed by `CASE_BASE + n` | New tables keyed `NUSANTARA_BASE + n` (outfit 400..405, held 400..403, back 400..402). `art/wardrobe.ts` merges them with `Object.assign(OUTFITS/HELD/BACKS, ...)`. |
| `web/src/art/case-pets.ts` | `CASE_PETS`, 12x10, two hop frames | A second list of 6; `art/pet-base.ts` files them with `PETS[CASE_BASE + i]`, so add `PETS[NUSANTARA_BASE + i]`. |
| `web/src/art/case-aura.ts` | `AURAS` keyed `CASE_BASE + n`, 28x28, 8 frames, `CA_MS` | Four new drawers keyed `NUSANTARA_BASE + n`; `caseAuraFrame` and `caseAuraIcon` (used by `art/characters.ts` and `game/legendary.ts`) must look both up. |
| `web/src/art/case-box.ts` | `caseBoxSprite("closed" | "open" | "key")` | Teak sea chest, open frame, brass anchor key (section 5), with a case parameter. |
| `web/src/art/furniture-home.ts` | `CASE_FURNITURE`, `piece(id, name, w, h, price, draw, opts)` | Six pieces with the art ids in section 4 (`placement: "wall"` for Б, `"flat"` for Г; `rarity` set). `art/furniture-fancy.ts` `fancyPiece` reads `CASE_FURNITURE`: add the new list there. |
| `web/src/art/natmarked.ts` | The Natmarked hall front and tiles | Nothing now. The Pelabuhan front and tiles come with that building. |
| `web/src/art/editions.ts` | Merges case hats/glasses (see above) | Extend `artOf`. |
| `web/src/art/wardrobe.ts` | `Object.assign` of the case tables | Add the Nusantara tables. |
| `web/src/art/characters.ts` | `caseAuraIcon` for the aura slot | Works once `case-aura.ts` handles 400+. |
| `web/src/art/pet-base.ts` | `CASE_PETS.forEach(... PETS[CASE_BASE + i])` | Add the Nusantara list. |

### 3D art (`web/src/render3d/`)

| File | Night Market has | Nusantara needs |
|---|---|---|
| `people/gear3dHead.ts` | hat and glasses builders keyed by **name** ("Straw kasa", "Fox half-mask"), plus a name list near line 1721 | Builders for the 4 hats and 3 glasses, and the same name-list entries. |
| `people/gear3dCase.ts` | outfit builders (`OUTFIT_BUILDERS[CASE_BASE + n]`), held and back builders by name | Outfit builders under `NUSANTARA_BASE + n`; held and back builders by name. |
| `data/gear.ts` | outfit colour table keyed by look index (300..305) | Add 400..405 colours: `[main, shade, trousers]`. |
| `people/gear3dAura.ts` / `people/aura3d.ts` | `AURA_BUILDERS["Lantern Sky"]` etc., by name | Four builders: "Mega Mendung", "Gamelan Echo", "Wayang Shadows", "Padi Gold". |
| `people/gear3d.ts` | tables the case modules add to | Nothing if the above register themselves; keep the load order. |
| `pets/pets3d-night.ts` and `pets/pets3d.ts` | `koi, crane, ...` builders, imported into `pets3d.ts` | A `pets3d-nusantara.ts` with the six, imported into `pets3d.ts`. |
| `data/pets.ts` | `CASE_PET_BASE = 300`, `CASE_PET_SPECIES`, `speciesAt(n)` and `PET_NAME` | **`speciesAt` assumes every n >= 300 is the Night Market: `n - 300` is wrong for 400+.** Add a base of 400 and the six species (and `PET_NAME`). |
| `furniture/night3d.ts`, `furniture/furniture3d.ts` | `NIGHT_ASSETS`, imported into the main asset list; id list near line 777 | A `nusantara3d.ts` with the six assets (`id`, `name`, `w`, `d`, `build`), `w` matching core; wall pieces must be in `WALL_ASSET_IDS`. |
| `case-box3d.ts` | the lacquered crate and coin, `animateCaseModel` | The teak chest, petals, and the key. |
| `icons.ts` | `{ kind: "case", what }` icon, `pieceAsset` (uses `casePieceOf`) | A case id in the icon key, and the new models. |

### HUD

| File | Note |
|---|---|
| `web/src/hud/CaseShop.tsx` | Already lists `CASES.map`, so Nusantara shows as a second card; the card art needs the new box. |
| `web/src/hud/CaseOpening.tsx` | The opening is driven by `def`; the pointer and kelir are shared UI (section 6). Its mock-roll pool (`CASE_POOL`, `CASE_NAME`) stays Night Market and is dev-preview only. |
| `web/test/item-parity.test.ts`, `web/test/furniture-home.test.ts` | Neither includes case pieces today. Add `ALL_CASE_PIECES` to the lists once the art exists, so a missing sprite or model fails. |

### Not to be shipped before the art lands

The server will already roll, sell and equip these items. Until the art stages are in, a worn Nusantara item draws as nothing/default (2D falls back to the base character, `speciesAt` falls back to the duck), and a placed piece draws nothing. So do not merge to main for players until the 2D and 3D art are done.
