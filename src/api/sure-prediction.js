function cleanText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function titleCase(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/*
  OCR sometimes changes decimal odds.

  Examples:
  11.89  -> 11.89
  1.24   -> 1.24
  7.75   -> 7.75
  7758   -> 7.75
  775    -> 7.75
*/
function normalizeOdd(raw) {
  if (raw === null || raw === undefined) return null;

  let value = String(raw)
    .trim()
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  if (!value) return null;

  // Normal decimal number
  if (value.includes(".")) {
    const number = Number(value);

    if (
      Number.isFinite(number) &&
      number >= 1.01 &&
      number <= 100
    ) {
      return Number(number.toFixed(2));
    }
  }

  // OCR may remove the decimal point.
  // 7758 -> 7.75
  // 775  -> 7.75
  const digits = value.replace(/\D/g, "");

  if (digits.length === 4) {
    const possible = Number(
      `${digits.slice(0, -2)}.${digits.slice(-2)}`
    );

    if (
      Number.isFinite(possible) &&
      possible >= 1.01 &&
      possible <= 100
    ) {
      return Number(possible.toFixed(2));
    }
  }

  if (digits.length === 3) {
    const possible = Number(
      `${digits.slice(0, 1)}.${digits.slice(1)}`
    );

    if (
      Number.isFinite(possible) &&
      possible >= 1.01 &&
      possible <= 100
    ) {
      return Number(possible.toFixed(2));
    }
  }

  const number = Number(digits);

  if (
    Number.isFinite(number) &&
    number >= 1.01 &&
    number <= 100
  ) {
    return Number(number.toFixed(2));
  }

  return null;
}

/*
  Extract decimal odds and common OCR versions.
*/
function extractOdds(text) {
  const source = String(text || "");
  const results = [];

  // Normal decimal odds.
  const decimalRegex = /\b\d{1,3}[.,]\d{1,2}\b/g;

  let match;

  while ((match = decimalRegex.exec(source))) {
    const value = normalizeOdd(match[0]);

    if (value !== null) {
      results.push({
        value,
        index: match.index,
      });
    }
  }

  /*
    OCR version such as:

    1 11.89 X 7758 2 1.24

    We specifically look around X / 2 so that
    ordinary four-digit numbers are not treated as odds.
  */
  const xPattern =
    /\bX\b\s*[:.)-]?\s*(\d{3,4})\b/i;

  const xMatch = source.match(xPattern);

  if (xMatch) {
    const value = normalizeOdd(xMatch[1]);

    if (value !== null) {
      results.push({
        value,
        index: xMatch.index,
        isDraw: true,
      });
    }
  }

  /*
    Also recognize an OCR sequence after the 1/X/2 labels.
  */
  const labelledPattern =
    /\b1\b\s*[:.)-]?\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:X|x)\s*[:.)-]?\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:2)\s*[:.)-]?\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)/;

  const labelled = source.match(labelledPattern);

  if (labelled) {
    const home = normalizeOdd(labelled[1]);
    const draw = normalizeOdd(labelled[2]);
    const away = normalizeOdd(labelled[3]);

    if (home !== null) {
      results.push({ value: home, label: "home" });
    }

    if (draw !== null) {
      results.push({ value: draw, label: "draw" });
    }

    if (away !== null) {
      results.push({ value: away, label: "away" });
    }
  }

  /*
    Remove duplicates while preserving useful order.
  */
  const final = [];
  const seen = new Set();

  for (const item of results) {
    const key = `${item.value}`;

    if (!seen.has(key)) {
      seen.add(key);
      final.push(item);
    }
  }

  return final;
}

function extractTeams(text) {
  const rawLines = String(text || "")
    .split("\n")
    .map((line) =>
      line
        .replace(/[^A-Za-zÀ-ÿ0-9 .&'’_-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);

  const bad = /^(home|away|draw|market|odds|1|x|2|over|under|yes|no|btts|football|soccer|prediction|today|live|premier|league|vs|v)$/i;

  const candidates = [];

  for (const line of rawLines) {
    const cleaned = line
      .replace(/\b\d{1,4}(?:[.,]\d{1,2})?\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleaned) continue;
    if (bad.test(cleaned)) continue;
    if (cleaned.length < 3 || cleaned.length > 50) continue;

    const parts = cleaned.split(/\s+(?:vs?|versus)\s+/i);

    if (parts.length === 2) {
      const a = titleCase(parts[0]);
      const b = titleCase(parts[1]);

      if (a && b) {
        return [a, b];
      }
    }

    if (!/\d/.test(cleaned)) {
      candidates.push(titleCase(cleaned));
    }
  }

  const compact = cleanText(text);

  const vs = compact.match(
    /(.{2,40})\s+(?:vs?|versus)\s+(.{2,40})/i
  );

  if (vs) {
    return [
      titleCase(vs[1]),
      titleCase(vs[2]),
    ];
  }

  /*
    Specific fallback for common betting screenshot format:

    Elche CF 1X2 Real Madrid
  */
  const marketMatch = compact.match(
    /^(.{2,35}?)\s+1X2\s+(.{2,35}?)(?:\s+1\s|$)/i
  );

  if (marketMatch) {
    return [
      titleCase(marketMatch[1]),
      titleCase(marketMatch[2]),
    ];
  }

  const usable = unique(candidates).filter(
    (team) => team.split(" ").length <= 8
  );

  if (usable.length >= 2) {
    return [usable[0], usable[1]];
  }

  return [
    "Unable to read home team",
    "Unable to read away team",
  ];
}

function extractGoalMarket(text) {
  for (const line of String(text || "").split("\n")) {
    const match = line.match(
      /(?:over|under)\s*(\d+(?:[.,]\d+)?)/i
    );

    if (match) {
      return {
        line: Number(match[1].replace(",", ".")),
        side: /over/i.test(line)
          ? "Over"
          : "Under",
      };
    }
  }

  return null;
}

function buildPrediction(text) {
  const source = String(text || "");

  const odds = extractOdds(source);

  const [homeTeam, awayTeam] =
    extractTeams(source);

  /*
    We need at least two usable odds.
  */
  if (odds.length < 2) {
    return {
      home_team: homeTeam,
      away_team: awayTeam,
      predicted_winner: "Unable to determine",
      market: "1X2",
      confidence: "Low",
      odds: "",
      goal_prediction: "Unavailable",
      over_under: "Unavailable",
      btts: "Unavailable",
      possible_score: "Unavailable",
      reason:
        "The screenshot did not contain enough readable betting odds. Please upload a clearer screenshot showing the teams and 1X2 odds.",
    };
  }

  /*
    First try to identify the standard 1X2 order.

    Home = 1
    Draw = X
    Away = 2
  */
  const labelledHome = odds.find(
    (item) => item.label === "home"
  );

  const labelledDraw = odds.find(
    (item) => item.label === "draw"
  );

  const labelledAway = odds.find(
    (item) => item.label === "away"
  );

  let homeOdds;
  let drawOdds;
  let awayOdds;

  if (
    labelledHome &&
    labelledDraw &&
    labelledAway
  ) {
    homeOdds = labelledHome.value;
    drawOdds = labelledDraw.value;
    awayOdds = labelledAway.value;
  } else {
    /*
      Normal screenshot sequence:

      11.89
      7.75
      1.24
    */

    const values = [];

    for (const item of odds) {
      if (!values.includes(item.value)) {
        values.push(item.value);
      }
    }

    homeOdds = values[0];
    drawOdds =
      values.length >= 3 ? values[1] : null;
    awayOdds =
      values.length >= 3 ? values[2] : values[1];
  }

  /*
    Safety check.
  */
  if (
    !Number.isFinite(homeOdds) ||
    !Number.isFinite(awayOdds)
  ) {
    return {
      home_team: homeTeam,
      away_team: awayTeam,
      predicted_winner: "Unable to determine",
      market: "1X2",
      confidence: "Low",
      odds: "",
      goal_prediction: "Unavailable",
      over_under: "Unavailable",
      btts: "Unavailable",
      possible_score: "Unavailable",
      reason:
        "The betting odds could not be read reliably from the screenshot.",
    };
  }

  let winner = "Draw";
  let selectedOdds =
    drawOdds !== null
      ? drawOdds
      : homeOdds;

  let winnerSide = "draw";

  if (
    homeOdds < awayOdds &&
    (!drawOdds || homeOdds < drawOdds)
  ) {
    winner = homeTeam;
    selectedOdds = homeOdds;
    winnerSide = "home";
  } else if (
    awayOdds < homeOdds &&
    (!drawOdds || awayOdds < drawOdds)
  ) {
    winner = awayTeam;
    selectedOdds = awayOdds;
    winnerSide = "away";
  }

  const outcomes =
    drawOdds !== null
      ? [homeOdds, drawOdds, awayOdds]
      : [homeOdds, awayOdds];

  const sorted = [...outcomes].sort(
    (a, b) => a - b
  );

  const gap =
    sorted[1] && sorted[1] > 0
      ? sorted[0] / sorted[1]
      : 1;

  let confidence = "Low";

  if (gap < 0.62) {
    confidence = "High";
  } else if (gap < 0.8) {
    confidence = "Medium";
  }

  /*
    Goal prediction.
    If an actual goal market is visible,
    use it. Otherwise provide a clearly
    labelled heuristic estimate.
  */
  const goalMarket =
    extractGoalMarket(source);

  let goalPrediction;
  let overUnder;

  if (goalMarket) {
    goalPrediction =
      `${goalMarket.line} Goals`;

    overUnder =
      `${goalMarket.side} ${goalMarket.line}`;
  } else {
    if (selectedOdds <= 1.3) {
      goalPrediction = "2–4 Goals";
      overUnder = "Over 2.5";
    } else if (selectedOdds <= 1.7) {
      goalPrediction = "2–3 Goals";
      overUnder = "Over 2.5";
    } else {
      goalPrediction = "1–3 Goals";
      overUnder = "Under 3.5";
    }
  }

  /*
    BTTS is only a heuristic when the market
    isn't visible.
  */
  let btts = "Yes";

  if (
    selectedOdds <= 1.3 &&
    (
      (winnerSide === "away" &&
        homeOdds >= 7) ||
      (winnerSide === "home" &&
        awayOdds >= 7)
    )
  ) {
    btts = "No";
  }

  /*
    Possible score.
  */
  let possibleScore = "1–1";

  if (winnerSide === "away") {
    possibleScore =
      selectedOdds <= 1.3
        ? "0–2"
        : "1–2";
  }

  if (winnerSide === "home") {
    possibleScore =
      selectedOdds <= 1.3
        ? "2–0"
        : "2–1";
  }

  const formattedOdds =
    drawOdds !== null
      ? `1: ${homeOdds.toFixed(2)} | X: ${drawOdds.toFixed(2)} | 2: ${awayOdds.toFixed(2)}`
      : `1: ${homeOdds.toFixed(2)} | 2: ${awayOdds.toFixed(2)}`;

  return {
    home_team: homeTeam,
    away_team: awayTeam,
    predicted_winner: winner,
    market: "1X2",
    confidence,
    odds: formattedOdds,
    goal_prediction: goalPrediction,
    over_under: overUnder,
    btts,
    possible_score: possibleScore,
    reason: goalMarket
      ? `${winner} has the strongest 1X2 market signal, and the visible goal market was also considered.`
      : `${winner} has the strongest 1X2 market signal. Goal, Over/Under and BTTS are heuristic estimates because those markets were not clearly visible in the screenshot.`,
  };
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { text } = req.body || {};

    if (
      !text ||
      typeof text !== "string"
    ) {
      return res.status(400).json({
        error: "No OCR text was provided.",
      });
    }

    const prediction =
      buildPrediction(text);

    return res.status(200).json({
      prediction,
    });
  } catch (error) {
    console.error(
      "Sure Prediction error:",
      error
    );

    return res.status(500).json({
      error:
        "Unable to process the prediction.",
    });
  }
}