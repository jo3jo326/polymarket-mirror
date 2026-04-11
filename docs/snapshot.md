Good. The **Market Snapshot Engine** is one of the most important parts of your future system.

Without it, your scanner only sees:

```text
market now
```

With it, your scanner sees:

```text
market now
vs
market 1 hour ago
vs
market yesterday
vs
before event
vs
after event
```

That changes everything.

---

# 1. Purpose of the Market Snapshot Engine

It stores market state over time so your algorithms can detect:

* stagnation
* volatility compression
* sudden repricing
* pre-event calm
* post-event distortions
* cross-exchange divergence over time

So this engine gives your system **memory**.

---

# 2. What a snapshot is

A snapshot is just a saved record of a market at a specific time.

Example:

```ts id="3h4j8a"
{
  timestamp: 1781203200000,
  source: "polymarket",
  marketId: "abc123",
  eventGroupId: "opensea_token_2026",
  question: "Will OpenSea launch a token by December 31, 2026?",
  structureType: "TIMING_BUCKET",
  yesPrice: 0.60,
  noPrice: 0.40,
  spread: 0.03,
  volume: 245000
}
```

You save many of these over time.

---

# 3. Why this engine matters

Right now many of your algorithms are forced to guess.

Example:

## Anticipation algorithm

You want to know:

```text
Has this market stayed too calm before an event?
```

Without snapshots, you cannot know.

---

## Volatility compression

You want to know:

```text
Has this market been stuck in a narrow band?
```

Without snapshots, impossible.

---

## Event-driven distortion

You want to know:

```text
Did this market reprice unevenly after news?
```

Without snapshots, impossible.

---

# 4. New folder structure

Add this to your project:

```text id="x1hvzq"
src/storage/
  snapshots/
    saveMarketSnapshot.ts
    loadMarketHistory.ts
    pruneOldSnapshots.ts
    snapshotTypes.ts
    index.ts
```

And create a data folder:

```text id="l35d7d"
data/
  snapshots/
```

That is where snapshot files live.

---

# 5. Stage-1 simple storage approach

For now, do **not** use a database yet.

Start simple:

```text
JSON files
```

Example file layout:

```text id="u2d7r0"
data/
  snapshots/
    polymarket/
      abc123.json
      def456.json
    kalshi/
      xyz111.json
```

Each file stores an array of snapshots for one market.

This is enough for early development.

---

# 6. Snapshot type definition

Create:

```text id="yww3n4"
src/storage/snapshots/snapshotTypes.ts
```

Code:

```ts id="l9u5m5"
export interface MarketSnapshot {
  timestamp: number
  source: string
  marketId: string
  eventGroupId?: string
  question?: string
  structureType?: string
  yesPrice?: number
  noPrice?: number
  spread?: number
  volume?: number
}
```

Simple and enough for now.

---

# 7. Save snapshot function

Create:

```text id="z7q2qb"
src/storage/snapshots/saveMarketSnapshot.ts
```

Code:

```ts id="0owkg8"
import fs from "fs"
import path from "path"
import { MarketSnapshot } from "./snapshotTypes"

export function saveMarketSnapshot(snapshot: MarketSnapshot) {
  const dir = path.join(process.cwd(), "data", "snapshots", snapshot.source)
  const filePath = path.join(dir, `${snapshot.marketId}.json`)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  let history: MarketSnapshot[] = []

  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, "utf-8")
    history = JSON.parse(raw)
  }

  history.push(snapshot)

  fs.writeFileSync(filePath, JSON.stringify(history, null, 2), "utf-8")
}
```

This saves one new snapshot to the market’s history file.

---

# 8. Load market history function

Create:

```text id="qa1cvc"
src/storage/snapshots/loadMarketHistory.ts
```

Code:

```ts id="6c7b6v"
import fs from "fs"
import path from "path"
import { MarketSnapshot } from "./snapshotTypes"

export function loadMarketHistory(source: string, marketId: string): MarketSnapshot[] {
  const filePath = path.join(process.cwd(), "data", "snapshots", source, `${marketId}.json`)

  if (!fs.existsSync(filePath)) {
    return []
  }

  const raw = fs.readFileSync(filePath, "utf-8")
  return JSON.parse(raw) as MarketSnapshot[]
}
```

---

# 9. Prune old snapshots

You do not want files growing forever.

Create:

```text id="n6tcas"
src/storage/snapshots/pruneOldSnapshots.ts
```

Code:

```ts id="v7k0vf"
import { MarketSnapshot } from "./snapshotTypes"

export function pruneOldSnapshots(
  history: MarketSnapshot[],
  maxAgeDays: number = 30
): MarketSnapshot[] {
  const cutoff = Date.now() - maxAgeDays * 86400000
  return history.filter((snap) => snap.timestamp >= cutoff)
}
```

You can apply this before saving.

---

# 10. Snapshot index file

Create:

```text id="u6c06t"
src/storage/snapshots/index.ts
```

Code:

```ts id="qn16c8"
export * from "./snapshotTypes"
export * from "./saveMarketSnapshot"
export * from "./loadMarketHistory"
export * from "./pruneOldSnapshots"
```

---

# 11. How scanner uses it

After fetching and normalizing markets, save a snapshot for each market.

Example inside your scanner flow:

```ts id="moq3ol"
for (const market of normalizedMarkets) {
  saveMarketSnapshot({
    timestamp: Date.now(),
    source: market.source,
    marketId: market.marketId,
    eventGroupId: market.eventGroupId,
    question: market.question,
    structureType: market.structureType,
    yesPrice: market.yesPrice,
    noPrice: market.noPrice,
    spread: market.spread,
    volume: market.volume
  })
}
```

Now every scan builds memory.

---

# 12. What this unlocks immediately

Once you have snapshot history, you can build:

## A. Stagnation detection

Example:

```text
market moved only 1% in 3 days
```

Useful for anticipation algorithm.

---

## B. Volatility compression

Example:

```text
yes price stayed between 0.30 and 0.34 for 5 days
```

This is Algorithm 7 material.

---

## C. Pre-event calm

Example:

```text
CPI tomorrow
market barely moved in 48 hours
```

Great anticipation signal.

---

## D. Post-event imbalance

Example:

```text
after Fed release
one ladder repriced fast
another related ladder stayed stale
```

This helps event-driven and cross-market algorithms.

---

# 13. Example helper: recent movement

You will want helper functions later.

Example:

```ts id="m7u3se"
import { MarketSnapshot } from "./snapshotTypes"

export function calculateRecentMovement(history: MarketSnapshot[]): number {
  if (history.length < 2) return 0

  const oldest = history[0]
  const latest = history[history.length - 1]

  if (
    oldest.yesPrice === undefined ||
    latest.yesPrice === undefined
  ) {
    return 0
  }

  return Math.abs(latest.yesPrice - oldest.yesPrice)
}
```

This becomes a building block for many algorithms.

---

# 14. Example helper: compression range

Another useful helper:

```ts id="6lp0d1"
import { MarketSnapshot } from "./snapshotTypes"

export function calculateCompressionRange(history: MarketSnapshot[]): number {
  const prices = history
    .map(h => h.yesPrice)
    .filter((p): p is number => typeof p === "number")

  if (prices.length === 0) return 0

  return Math.max(...prices) - Math.min(...prices)
}
```

If the range is very small over many snapshots, you may have:

```text
volatility compression
```

---

# 15. How this fits with Algorithm 11

Your anticipation engine can now do:

```text
upcoming event
+
market history shows little movement
=
anticipation watchlist
```

That is much stronger than checking only current prices.

---

# 16. How this fits with future exchanges

This snapshot engine is exchange-agnostic.

Because snapshots store:

```text
source
marketId
prices
spread
volume
```

So it works for:

* Polymarket
* Kalshi
* Manifold
* later options
* later commodities
* later bonds

That is exactly what you want.

---

# 17. Stage-1 vs later database

For now:

```text
JSON files
```

is correct.

Later, when the system grows, move to:

* SQLite
* PostgreSQL
* Timeseries DB

But not now.

Move gradually.

---

# 18. Recommended stage-1 build order

Do this calmly:

## Step 1

Create:

```text
src/storage/snapshots/
data/snapshots/
```

## Step 2

Add the 4 files:

* `snapshotTypes.ts`
* `saveMarketSnapshot.ts`
* `loadMarketHistory.ts`
* `pruneOldSnapshots.ts`

## Step 3

Call `saveMarketSnapshot()` inside the scanner after normalization.

## Step 4

Later add helper functions:

* recent movement
* compression range
* pre-event calm

That is enough to start.

---

# 19. What this means for your whole system

After this, your architecture becomes much more real:

```text
fetch data
↓
normalize
↓
store snapshot
↓
classify structure
↓
run algorithms
↓
score signals
```

Now your engine is no longer only a scanner.

It is becoming a **market memory system**.

---

# 20. Final clean summary

The Market Snapshot Engine gives your scanner:

* memory
* history
* event context
* compression detection
* stagnation detection
* pre-event awareness

And the minimal codebase to start is:

```text
src/storage/snapshots/
  snapshotTypes.ts
  saveMarketSnapshot.ts
  loadMarketHistory.ts
  pruneOldSnapshots.ts
```

with data saved into:

```text
data/snapshots/
```

The next best step is to design the **step-by-step refactor plan** from your current single `scanner.js` into this architecture without breaking what already works.
