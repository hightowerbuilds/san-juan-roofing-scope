# Build log

What changed, why, and what's still open. Newest day first.

---

## 2026-10-19

### Setup
- Cloned `hightowerbuilds/san-juan-roofing-scope` into `~/Desktop/websites`.
- Ran `bun install` and `bun run dev`: the API is on `:3001` and Vite on `http://127.0.0.1:5173`.

### Pixel-art island map (`/map`)
The plan, decisions and per-phase notes are in [`pixel-map-plan.md`](pixel-map-plan.md).

- **Coverage:** Haro Strait to Burlington, and Patos Island to the south tip of Whidbey.
- **Grid:** 2032 × 2613 cells of 40 m.
- **Style:** SNES overworld, chosen with the user.

**Phase 1, data pipeline** (`b214bc1`)
- `scripts/build-pixel-map.ts` rasterizes OpenFreeMap vector tiles and AWS Terrarium elevation
  into `public/pixel-map/cells.bin` (1.25 MB) and `meta.json`.
  - The vector tiles give coastline, land cover, towns, places, peaks, ferries and roads.
  - Tiles are cached in `scripts/.cache/`.
- The terrain tiles' bathymetry was too smoothed to give a coastline, so the coastline comes from
  OSM water polygons.
- Elevation is square-root encoded up to 2,400 m. A linear byte had clipped the Olympics.
- Coastline checks passed: Deception Pass, the Swinomish Channel, Mosquito Pass.

**Phase 2, viewer** (also `b214bc1`)
- Full-bleed canvas page.
- Zoom stops land on whole device pixels.
- Wheel and pinch zoom around the cursor, drag pan with glide, keyboard controls.

**Phase 3, art pass** (`590f144`)
- 5-shade ramps with NW hillshade and Bayer dithering.
- Sea depth from distance to shore, with foam and waves.
- Tree canopy, patchwork farmland, towns, alpine rock and snow.
- Painted in parallel Web Workers by band. The output is byte-identical to a single pass.

**Phase 4, overlays** (`0b5877e`)
- Highways and ferry dashes baked into the terrain.
  - Ferries are named from OpenMapTiles.
  - Long-haul routes are dropped.
  - The Guemes and Lummi Island ferries are matched by terminal.
- Labels in Pixelify Sans, tiered by zoom.
- SNES menu-window HUD with a compass and km/mi scale bars.

**Dropped:** water shimmer.

**Merged:** the `pixel-map` branch via PR #1 (`ec2c5c4`).

### Repo
- Renamed the default branch from `master` to `main` on GitHub and locally.

### Site
- **Font** (`dbd4e0c`): switched to Lato. The map keeps Pixelify Sans.
- **Service area page** (`be6ce90`): removed `/areas` and its MapLibre 3D map, including the
  `maplibre-gl` dependency. `/map` is the only map, and the app bundle is now about 170 KB.

### Challenges (home page)
Three roofing jobs, each written as costed steps to scope what the job really costs.

| # | Job | Location |
|---|---|---|
| 1 | 40-square metal roof on new construction | Orcas Island |
| 2 | 40-square composite roof with tear-off | Friday Harbor, San Juan Island |
| 3 | 60-square TPO flat roof with tear-off | Orcas Island |

- **First draft** (`dbd4e0c`): I wrote specs, takeoffs and phases for all three.
- **Clean slate** (`be6ce90`): the user asked to start over. All three were reset to title and
  location, and we're building them up together. Challenge 3 moved from Lopez to Orcas.
- **How the costing works:**
  - Each plan is a list of timed steps carrying direct costs only (fuel, ferry, meals, lodging,
    rentals).
  - Labor is added once at the end, from the paid hours on the steps.
  - Alternatives are options with a comparison table.
  - Each part of a phase collapses to its heading and total (`5802017`).

### Challenge 1 plan (metal roof, Orcas)

**Phase 1, part 1: Bid from the plans.** Office work by the owner, $0.
- Get the plan set.
- Call Nu-Ray.
- Get a takeoff and material quote.
- Price the job and send the bid.
- Sign the contract and collect a deposit before ordering anything.

**Phase 1, part 2: Confirm the measurements.**

| Option | Total |
|---|---|
| A: Built to plans: order from the plans, no trip | $0 |
| B: Plans changed: field measure on a day trip (F-150; 8:40 AM out, 4:35 PM back; 4.4 h on site) | $595.20 |
| C: Plans changed: field measure with an overnight on Orcas (6:05 PM out the night before; 7 h on site) | $821.70 |

**Phase 1, part 3: Order the metal.**
- Panels and trim from Nu-Ray (placeholder $26,400).
- 23 rolls of CertainTeed WinterGuard HT ice and water (40 sq plus laps; placeholder $175 a roll)
  from the Northwest supplier Nu-Ray recommends.
- Order total about **$30,425** (placeholders).

**Phase 2: Dry-in and metal delivery.** About **$5,458**.
- Starts when the general contractor says the roof is sheathed.
- Four-day trip with two paid crew members and no owner. The crew lead makes the calls.
- F-550 with a 30 ft trailer rented near Nu-Ray; pickup at Nu-Ray, then the ice and water
  supplier.
- I-5 to the 3:20 PM Anacortes ferry; the load sits on site overnight.
- Unload by hand, then a day and a half of dry-in.
- Return the trailer on day 4.

**How the plan got here** (decisions with the user, in order):
1. Rates: one crew member at $40/h with the owner along unpaid. Labor goes at the end of each plan,
   not in each step.
2. The day trip leaves too little time on site, so we added the overnight option. Travel the night
   before is unpaid.
3. Truck: an F-550 tows the metal. A 30 ft trailer is rented near Nu-Ray. The route is I-5 to the
   Anacortes ferry, not the Mukilteo ferry.
4. Delivery goes straight to Orcas, and the crew unloads by hand.
5. We poked holes in the plan. Real practice is to bid from plans, sign a contract, collect a
   deposit, field-verify, then order. That led to the bid/confirm/order restructure.
6. Delivery and dry-in moved to Phase 2, without the owner.
7. Added 40 sq of ice and water, now CertainTeed WinterGuard HT. ("Vycor" is a Grace brand, so we
   confirmed WinterGuard HT with the user.)

**Sources cited on the page:**
- WSF fares and the fall 2026 schedule: San Juan routes collect fares westbound only, 3% card fee,
  rigs under 60 ft pay $319.80 to Orcas.
- AAA fuel prices: gas $5.49, diesel $7.37.
- Nu-Ray's site: Puyallup office, Auburn and Kent pickup, profiles.
- Supplier takeoff and on-site roll-forming practice.

### Open items
- **Placeholders to replace with quotes:**
  - Nu-Ray panels and trim.
  - WinterGuard HT price and supplier name.
  - Trailer rental near Nu-Ray ($150/day).
  - Motel ($150 plus tax).
- **Labor rate:** $40 is the wage only. A loaded rate with WA roofing workers' comp and payroll
  taxes is likely $55–60 or more.
- **Questions for Nu-Ray:**
  - Do they sell direct or through dealers?
  - Do they do takeoffs from plans?
  - Do they deliver to the islands?
  - Who is the recommended ice and water supplier?
  - Do they sell coil for on-site roll forming?
- **Check:** the F-550 and trailer length (under 60 ft vs under 70 ft fares), the CDL class for the
  combination, and WSF reservations for long vehicles.
- **Timing:** with field measure (options B and C), the metal lead time may lag the general
  contractor's dry-in date. A separate dry-in trip may be needed.
- **Compare against our own pickup:** supplier delivery, island freight (Orcas Island Freight
  Lines), and the general contractor's telehandler on site.
- **Next:** Challenge 1 install phases. Challenges 2 and 3 haven't been started.
- **Pixel map:** a real-phone and touch test is still pending.
