// ============================================================
//  POLYMARKET STRUCTURAL SCANNER — STRICT VERSION
//  Save as: scanner.js
//  Run with: node scanner.js
//
//  WHAT THIS VERSION FIXES
//  1. Stage 4 can no longer create trades by itself
//  2. DDS is only applied to exact-bucket style markets
//  3. Binary/categorical markets default to avoid
//  4. Extreme prices are vetoed
//  5. Execution logic is direction-aware
//  6. Adds WATCHLIST state
//
//  NOTE
//  This is intentionally strict.
//  Expect many AVOIDs, few WATCHLISTS, and only a small number of TRADEs.
// ============================================================

import fetch from "node-fetch";

const GAMMA_API = "https://gamma-api.polymarket.com";
const TAG_ID_CRYPTO = 21;
const EVENT_LIMIT = 40;

// ============================================================
//  HELPERS
// ============================================================

function parseArr(str) {
  try {
    return JSON.parse(str || "[]");
  } catch {
    return [];
  }
}

function toNum(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function pct(n) {
  return `${(toNum(n) * 100).toFixed(0)}%`;
}

function money(n) {
  return `$${toNum(n).toFixed(2)}`;
}

function line(char = "─", len = 60) {
  return char.repeat(len);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeQuestion(q) {
  return (q || "").replace(/\s+/g, " ").trim();
}

function shortQuestion(q, len = 42) {
  const s = safeQuestion(q);
  return s.length <= len ? s.padEnd(len) : `${s.slice(0, len - 3)}...`;
}

function hasAny(str, terms) {
  const s = (str || "").toLowerCase();
  return terms.some((t) => s.includes(t));
}

function dedupeByQuestion(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = safeQuestion(item.question).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function buildProbRows(markets) {
  return dedupeByQuestion(
    markets.map((m) => {
      const prices = parseArr(m.outcomePrices);
      return {
        question: safeQuestion(m.question),
        yes: toNum(prices[0]),
        no: toNum(prices[1]),
        volume: toNum(m.volume),
      };
    })
  ).filter((row) => row.yes > 0 || row.no > 0);
}

function sortRowsAscending(rows) {
  // Preserve API order by default.
  // If you later want advanced sorting by extracted numeric threshold,
  // that can be added separately.
  return rows;
}

function getEventTitle(event) {
  return safeQuestion(event.title || event.slug || "Untitled");
}

function getEventVolume(event) {
  const direct = toNum(event.volume, NaN);
  if (Number.isFinite(direct)) return direct;

  const markets = Array.isArray(event.markets) ? event.markets : [];
  return markets.reduce((sum, m) => sum + toNum(m.volume), 0);
}

function isExtremePrice(yes) {
  return yes <= 0.03 || yes >= 0.97;
}

function formatActionLabel(action) {
  if (action === "TRADE") return "\x1b[32m[⚡ TRADE]\x1b[0m";
  if (action === "WATCHLIST") return "\x1b[33m[ WATCH ]\x1b[0m";
  return "\x1b[90m[ AVOID ]\x1b[0m";
}

// ============================================================
//  STAGE 1 — MARKET FILTER
// ============================================================

function stage1(markets) {
  const first = markets[0];
  if (!first) {
    return { pass: false, reason: "No markets found in event" };
  }

  const activeMarkets = markets.filter((m) => m.active === true && m.closed === false);
  if (activeMarkets.length === 0) {
    return { pass: false, reason: "Market is not active / already closed" };
  }

  const priced = activeMarkets.filter((m) => {
    const prices = parseArr(m.outcomePrices);
    return prices.length >= 2 && prices.some((p) => toNum(p) > 0);
  });

  if (priced.length === 0) {
    return { pass: false, reason: "No outcome prices available" };
  }

  const hasCatalyst = activeMarkets.some(
    (m) => !!(m.endDate || m.endDateIso || m.endTime)
  );

  if (!hasCatalyst) {
    return { pass: false, reason: "No resolution date found" };
  }

  return {
    pass: true,
    reason: `Active · priced · has resolution date (${priced.length} market(s))`,
    markets: priced,
  };
}

// ============================================================
//  STAGE 2 — MARKET STRUCTURE
// ============================================================

function stage2(markets, title) {
  const rows = buildProbRows(markets);
  const questions = rows.map((r) => r.question.toLowerCase());
  const joined = `${title} ${questions.join(" | ")}`.toLowerCase();

  const thresholdHints = [
    "above",
    "below",
    "reach",
    "hit",
    "over",
    "under",
    "dip to",
    "launch by",
    "fdv above",
    "by december",
    "by 2026",
    "by 2027",
    "before 2027",
    "before 2026",
  ];

  const exactHints = [
    "temperature",
    "highest temperature",
    "rainfall",
    "snowfall",
    "wind speed",
    "price on",
    "price april",
    "price on april",
    "what price on",
    "between",
    "from",
    "to",
    "one day after launch",
  ];

  const categoricalHints = [
    "best performance",
    "vs.",
    "vs ",
    "which",
    "who will",
    "winner",
    "best month",
    "first",
    "second",
    "third",
  ];

  const thresholdScore = questions.filter((q) => hasAny(q, thresholdHints)).length;
  const exactScore = questions.filter((q) => hasAny(q, exactHints)).length;
  const categoricalScore = questions.filter((q) => hasAny(q, categoricalHints)).length;

  if (rows.length === 1) {
    return {
      type: "BINARY",
      label: "Binary decision",
      markets,
      rows,
    };
  }

  if (categoricalScore >= Math.ceil(rows.length * 0.5) || hasAny(joined, categoricalHints)) {
    return {
      type: "CATEGORICAL",
      label: "Categorical multi-outcome",
      markets,
      rows,
    };
  }

  if (rows.length >= 3 && thresholdScore >= Math.ceil(rows.length * 0.5)) {
    return {
      type: "THRESHOLD_LADDER",
      label: "Threshold ladder (cumulative)",
      markets,
      rows,
    };
  }

  if (rows.length >= 3 && exactScore >= Math.ceil(rows.length * 0.3)) {
    return {
      type: "EXACT_BUCKET",
      label: "Exact bucket / range ladder",
      markets,
      rows: sortRowsAscending(rows),
    };
  }

  if (rows.length >= 3) {
    return {
      type: "CATEGORICAL",
      label: "Categorical / unclear multi-outcome",
      markets,
      rows,
    };
  }

  return {
    type: "BINARY",
    label: "Binary decision",
    markets,
    rows,
  };
}

// ============================================================
//  STAGE 3 — STRUCTURAL EDGE CHECK
//  DDS only for EXACT_BUCKET
// ============================================================

function stage3(structure) {
  const { type, rows } = structure;

  if (type === "BINARY") {
    return {
      distortion: false,
      veto: true,
      rows,
      reason: "Binary market — default avoid",
    };
  }

  if (type === "CATEGORICAL") {
    return {
      distortion: false,
      veto: true,
      rows,
      reason: "Categorical market — DDS not reliable here",
    };
  }

  if (type === "THRESHOLD_LADDER") {
    return {
      distortion: false,
      veto: false,
      rows,
      reason: "DDS skipped — threshold ladders are cumulative, not exact buckets",
    };
  }

  if (type !== "EXACT_BUCKET") {
    return {
      distortion: false,
      veto: true,
      rows,
      reason: "Unknown structure — avoid",
    };
  }

  if (rows.length < 3) {
    return {
      distortion: false,
      veto: false,
      rows,
      reason: `Only ${rows.length} bracket(s) — need 3+ for DDS`,
    };
  }

  const yesVals = rows.map((r) => r.yes);
  const maxVal = Math.max(...yesVals);
  const maxIdx = yesVals.indexOf(maxVal);

  const neighbors = [];
  if (maxIdx > 0) neighbors.push(yesVals[maxIdx - 1]);
  if (maxIdx < yesVals.length - 1) neighbors.push(yesVals[maxIdx + 1]);

  const avgNeighbor =
    neighbors.length > 0
      ? neighbors.reduce((a, b) => a + b, 0) / neighbors.length
      : 0;

  if (maxVal < 0.35) {
    return {
      distortion: false,
      veto: false,
      rows,
      reason: `Peak too low for robust DDS (${pct(maxVal)} < 35%)`,
    };
  }

  if (avgNeighbor <= 0) {
    return {
      distortion: false,
      veto: false,
      rows,
      reason: "Neighbor average invalid for DDS",
    };
  }

  const dds = maxVal / avgNeighbor;

  if (dds >= 2.5) {
    return {
      distortion: true,
      veto: false,
      type: "DDS spike",
      dds,
      spike: rows[maxIdx],
      rows,
      reason:
        `DDS spike detected — "${rows[maxIdx].question}" at ${pct(maxVal)} ` +
        `vs avg neighbors ${pct(avgNeighbor)} (${dds.toFixed(2)}x)`,
    };
  }

  return {
    distortion: false,
    veto: false,
    dds,
    rows,
    reason: `No structural distortion — DDS ${dds.toFixed(2)} below 2.50`,
  };
}

// ============================================================
//  STAGE 4 — ZONE / SECONDARY FILTER
//  Cannot create trades. Only WATCHLIST or REJECT.
// ============================================================

function stage4(structure) {
  const { type, rows } = structure;

  if (type === "BINARY" || type === "CATEGORICAL") {
    return {
      candidate: false,
      watchlist: false,
      reason: "Binary/categorical markets default to avoid",
    };
  }

  const extreme = rows.find((r) => isExtremePrice(r.yes));
  if (extreme) {
    return {
      candidate: false,
      watchlist: false,
      reason: `Extreme price detected at ${pct(extreme.yes)} — auto avoid`,
    };
  }

  const sweetSpot = rows.find((r) => r.yes >= 0.3 && r.yes <= 0.6);
  if (sweetSpot) {
    return {
      candidate: false,
      watchlist: true,
      question: sweetSpot.question,
      yes: sweetSpot.yes,
      reason:
        `Watchlist only — "${sweetSpot.question}" at ${pct(sweetSpot.yes)} ` +
        `is in 30–60% zone but lacks confirmed structural edge`,
    };
  }

  return {
    candidate: false,
    watchlist: false,
    reason: "No valid secondary confirmation",
  };
}

// ============================================================
//  STAGE 5 — EXECUTION
//  Only Stage 3 distortion can create a trade.
//  DDS spike => BUY NO on spike outcome.
// ============================================================

function stage5(s3Result) {
  if (!s3Result || !s3Result.distortion) {
    return {
      action: "AVOID",
      reason: "No structural edge to execute",
    };
  }

  // DDS spike (EXACT_BUCKET)
  if (s3Result.spike) {
    const yes = s3Result.spike.yes;
    if (isExtremePrice(yes)) {
      return {
        action: "AVOID",
        reason: `Extreme entry price at ${pct(yes)} — execution veto`,
      };
    }
    const direction = "BUY NO";
    const noEntry = 1 - yes;
    const tpNo = clamp(noEntry * 1.8, noEntry + 0.03, 0.85);
    const slNo = clamp(noEntry * 0.55, 0.02, noEntry - 0.02);
    if (!(tpNo > noEntry && slNo < noEntry)) {
      return {
        action: "AVOID",
        reason: "Execution sanity check failed",
      };
    }
    return {
      action: "TRADE",
      direction,
      entry: money(noEntry),
      tp: money(tpNo),
      sl: money(slNo),
      entryRaw: noEntry,
      tpRaw: tpNo,
      slRaw: slNo,
      note: s3Result.spike.question,
      source: "Stage 3 — DDS structural distortion",
    };
  }

  // Threshold ladder kink/gap/outlier
  if (s3Result.kink) {
    // Direction: BUY YES if kink/gap is a sharp drop (step << mean), BUY NO if sharp rise (step >> mean)
    const { from, to, step, mean } = s3Result.kink;
    let direction = "BUY YES";
    if (step > mean) direction = "BUY NO";
    const entry = direction === "BUY YES" ? from.yes : to.yes;
    if (isExtremePrice(entry)) {
      return {
        action: "AVOID",
        reason: `Extreme entry price at ${pct(entry)} — execution veto`,
      };
    }
    const tp = clamp(entry * 1.7, entry + 0.03, 0.85);
    const sl = clamp(entry * 0.55, 0.02, entry - 0.02);
    if (!(tp > entry && sl < entry)) {
      return {
        action: "AVOID",
        reason: "Execution sanity check failed",
      };
    }
    return {
      action: "TRADE",
      direction,
      entry: money(entry),
      tp: money(tp),
      sl: money(sl),
      entryRaw: entry,
      tpRaw: tp,
      slRaw: sl,
      note: direction === "BUY YES" ? from.question : to.question,
      source: "Stage 3 — Threshold ladder kink/gap/outlier",
    };
  }

  return {
    action: "AVOID",
    reason: "No structural edge to execute",
  };
}

// ============================================================
//  ENGINE
// ============================================================

function runEngine(event) {
  const title = getEventTitle(event);
  const rawMarkets = Array.isArray(event.markets) ? event.markets : [];

  const s1 = stage1(rawMarkets);
  if (!s1.pass) {
    return {
      title,
      action: "AVOID",
      stopStage: 1,
      trail: [
        { stage: "S1", label: "Market filter", pass: false, reason: s1.reason },
      ],
    };
  }

  const s2 = stage2(s1.markets, title);
  const s3 = stage3(s2);

  if (s3.veto) {
    return {
      title,
      action: "AVOID",
      stopStage: 3,
      s3,
      trail: [
        { stage: "S1", label: "Market filter", pass: true, reason: s1.reason },
        { stage: "S2", label: "Market structure", pass: true, reason: s2.label },
        { stage: "S3", label: "Structural edge", pass: false, reason: s3.reason },
      ],
    };
  }

  if (s3.distortion) {
    const s5 = stage5(s3);
    const isTrade = s5.action === "TRADE";

    return {
      title,
      action: isTrade ? "TRADE" : "AVOID",
      stopStage: 5,
      s3,
      execution: s5,
      trail: [
        { stage: "S1", label: "Market filter", pass: true, reason: s1.reason },
        { stage: "S2", label: "Market structure", pass: true, reason: s2.label },
        { stage: "S3", label: "Structural edge", pass: true, reason: s3.reason },
        {
          stage: "S5",
          label: "Execution",
          pass: isTrade,
          reason: isTrade
            ? `${s5.direction} | Entry ${s5.entry} | TP ${s5.tp} | SL ${s5.sl}`
            : s5.reason,
        },
      ],
    };
  }

  const s4 = stage4(s2);

  if (s4.watchlist) {
    return {
      title,
      action: "WATCHLIST",
      stopStage: 4,
      s3,
      trail: [
        { stage: "S1", label: "Market filter", pass: true, reason: s1.reason },
        { stage: "S2", label: "Market structure", pass: true, reason: s2.label },
        { stage: "S3", label: "Structural edge", pass: false, reason: s3.reason },
        { stage: "S4", label: "Secondary filter", pass: null, reason: s4.reason },
      ],
    };
  }

  return {
    title,
    action: "AVOID",
    stopStage: 4,
    s3,
    trail: [
      { stage: "S1", label: "Market filter", pass: true, reason: s1.reason },
      { stage: "S2", label: "Market structure", pass: true, reason: s2.label },
      { stage: "S3", label: "Structural edge", pass: false, reason: s3.reason },
      { stage: "S4", label: "Secondary filter", pass: false, reason: s4.reason },
    ],
  };
}

// ============================================================
//  PRINTING
// ============================================================

function printProbabilityTable(s3) {
  if (!s3 || !Array.isArray(s3.rows) || s3.rows.length === 0) return;

  console.log("         \x1b[90mProbability table:\x1b[0m");

  for (const row of s3.rows) {
    const isSpike = s3.spike && row.question === s3.spike.question;
    const bar = "█".repeat(Math.round(row.yes * 20));
    const flag = isSpike ? " \x1b[33m← DDS spike\x1b[0m" : "";
    console.log(
      `           ${shortQuestion(row.question)} ${pct(row.yes).padStart(4)}  ${bar}${flag}`
    );
  }
}

function printResult(result) {
  console.log(`${formatActionLabel(result.action)} ${result.title}`);

  for (const step of result.trail) {
    const tick =
      step.pass === true
        ? "\x1b[32m✓\x1b[0m"
        : step.pass === false
        ? "\x1b[31m✗\x1b[0m"
        : "\x1b[90m—\x1b[0m";

    console.log(`         ${tick} ${step.stage} ${step.label}: ${step.reason}`);
  }

  if (result.s3) {
    printProbabilityTable(result.s3);
  }

  console.log("");
}

// ============================================================
//  FETCH
// ============================================================

async function fetchMarkets() {
  const url =
    `${GAMMA_API}/events?active=true&closed=false` +
    `&tag_id=${TAG_ID_CRYPTO}&limit=${EVENT_LIMIT}&order=volume&ascending=false`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gamma API returned ${res.status}`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

// ============================================================
//  MAIN
// ============================================================

async function main() {
  console.log("");
  console.log(line("═"));
  console.log("  POLYMARKET STRUCTURAL SCANNER — STRICT VERSION");
  console.log("  Crypto markets · sorted by volume");
  console.log(line("═"));
  console.log("");

  console.log("Fetching live markets from Polymarket...");

  let events;
  try {
    events = await fetchMarkets();
  } catch (err) {
    console.error("\x1b[31mFailed to fetch markets:\x1b[0m", err.message);
    console.error("Check your internet connection and try again.");
    process.exit(1);
  }

  console.log(`Fetched ${events.length} events. Running strict engine...\n`);
  console.log(line());
  console.log("");

  const results = events.map(runEngine);

  const trades = results.filter((r) => r.action === "TRADE");
  const watchlist = results.filter((r) => r.action === "WATCHLIST");
  const avoids = results.filter((r) => r.action === "AVOID");

  if (trades.length > 0) {
    console.log("\x1b[32mTRADE SIGNALS\x1b[0m");
    console.log(line());
    console.log("");
    trades.forEach(printResult);
  } else {
    console.log("\x1b[90mNo TRADE signals found in this scan.\x1b[0m\n");
  }

  if (watchlist.length > 0) {
    console.log("\x1b[33mWATCHLIST\x1b[0m");
    console.log(line());
    console.log("");
    watchlist.forEach(printResult);
  } else {
    console.log("\x1b[90mNo WATCHLIST markets found in this scan.\x1b[0m\n");
  }

  console.log("\x1b[90mAVOID\x1b[0m");
  console.log(line());
  console.log("");
  avoids.forEach(printResult);

  console.log(line("═"));
  console.log(
    `  SCAN COMPLETE — ${trades.length} TRADE · ${watchlist.length} WATCHLIST · ${avoids.length} AVOID across ${results.length} markets`
  );
  console.log(line("═"));
  console.log("");
}

main().catch((err) => {
  console.error("\x1b[31mUnhandled error:\x1b[0m", err);
  process.exit(1);
});