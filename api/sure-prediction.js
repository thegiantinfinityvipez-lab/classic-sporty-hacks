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

// Convert OCR odds into usable decimal odds.
function normalizeOdd(raw, isDraw = false) {
  if (raw === null || raw === undefined) return null;

  let value = String(raw)
    .trim()
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  if (!value) return null;

  // Normal decimal odds: 11.89, 1.24, 7.75
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

  const digits = value.replace(/\D/g, "");

  /*
    OCR can turn:

    7.75 -> 7758

    The final 8 is commonly an OCR artifact.
    In the X/draw position, try the first 3 digits first.
  */
  if (isDraw && digits.length === 4) {
    const firstThree = Number(
      `${digits[0]}.${digits.slice(1, 3)}`
    );

    if (
      Number.isFinite(firstThree) &&
      firstThree >= 1.01 &&
      firstThree <= 30
    ) {
      return Number(firstThree.toFixed(2));
    }
  }

  // 775 -> 7.75
  if (digits.length === 3) {
    const possible = Number(
      `${digits[0]}.${digits.slice(1)}`
    );

    if (
      Number.isFinite(possible) &&
      possible >= 1.01 &&
      possible <= 100
    ) {
      return Number(possible.toFixed(2));
    }
  }

  // Four digit OCR fallback.
  if (digits.length === 4) {
    const possible = Number(
      `${digits.slice(0, 2)}.${digits.slice(2)}`
    );

    if (
      Number.isFinite(possible) &&
      possible >= 1.01 &&
      possible <= 100
    ) {
      return Number(possible.toFixed(2));
    }
  }

  return null;
}

function extractOdds(text) {
  const source = String(text || "");
  const results = [];

  // First capture normal decimal odds.
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
    Capture the draw/X odd.

    Example:
    X 7758

    7758 -> 7.75
  */
  const xPattern =
    /\bX\b\s*[:.)-]?\s*(\d{3,4})\b/i;

  const xMatch = source.match(xPattern);

  if (xMatch) {
    const value = normalizeOdd(xMatch[1], true);

    if (value !== null) {
      results.push({
        value,
        index: xMatch.index,
        isDraw: true,
      });
    }
  }

  /*
    Capture a standard:

    1 11.89 X 7758 2 1.24
  */
  const labelledPattern =
    /\b1\b\s*[:.)-]?\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:X|x)\s*[:.)-]?\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)\s*(?:2)\s*[:.)-]?\s*([0-9]{1,4}(?:[.,][0-9]{1,2})?)/;

  const labelled = source.match(labelledPattern);

  if (labelled) {
    const home = normalizeOdd(labelled[1]);
    const draw = normalizeOdd(labelled[2], true);
    const away = normalizeOdd(labelled[3]);

    if (home !== null) {
      results.push({
        value: home,
        label: "home",
      });
    }

    if (draw !== null) {
      results.push({
        value: draw,
        label: "draw",
      });
    }

    if (away !== null) {
      results.push({
        value: away,
        label: "away",
      });
    }
  }

  // Remove duplicate odds.
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
  const source = String(text || "");

  /*
    Most important format:

    Elche CF 1X2 Real Madrid
  */
  const direct = source.match(
    /([A-Za-zÀ-ÿ0-9 .&'’_-]{2,40})\s+1\s*X\s*2\s+([A-Za-zÀ-ÿ0-9 .&'’_-]{2,40})/i
  );

  if (direct) {
    return [
      titleCase(direct[1]),
      titleCase(direct[2]),
    ];
  }

  const rawLines = source
    .split("\n")
    .map((line) =>
      line
        .replace(/[^A-Za-zÀ-ÿ0-9 .&'’_-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);

  const candidates = [];

  for (const line of rawLines) {
    const parts = line.split(
      /\s+(?:vs?|versus)\s+/i
    );

    if (parts.length === 2) {
      return [
        titleCase(parts[0]),
        titleCase(parts[1]),
      ];
    }

    if (
      line.length >= 3 &&
      line.length <= 45 &&
      !/\d/.test(line)
    ) {
      candidates.push(titleCase(line));
    }
  }

  const compact = cleanText(source);

  const vs = compact.match(
    /(.{2,40})\s+(?:vs?|versus)\s+(.{2,40})/i
  );

  if (vs) {
    return [
      titleCase(vs[1]),
      titleCase(vs[2]),
    ];
  }

  const usable = unique(candidates);

  if (usable.length >= 2) {
    return [
      usable[0],
      usable[1],
    ];
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
        line: Number(
          match[1].replace(",", ".")
        ),
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

  const homeItem = odds.find(
    (item) => item.label === "home"
  );

  const drawItem = odds.find(
    (item) => item.label === "draw"
  );

  const awayItem = odds.find(
    (item) => item.label === "away"
  );

  let homeOdds;
  let drawOdds;
  let awayOdds;

  if (
    homeItem &&
    drawItem &&
    awayItem
  ) {
    homeOdds = homeItem.value;
    drawOdds = drawItem.value;
    awayOdds = awayItem.value;
  } else {
    const values = [];

    for (const item of odds) {
      if (!values.includes(item.value)) {
        values.push(item.value);
      }
    }

    homeOdds = values[0];

    drawOdds =
      values.length >= 3
        ? values[1]
        : null;

    awayOdds =
      values.length >= 3
        ? values[2]
        : values[1];
  }

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
    (!drawOdds ||
      homeOdds < drawOdds)
  ) {
    winner = homeTeam;
    selectedOdds = homeOdds;
    winnerSide = "home";
  } else if (
    awayOdds < homeOdds &&
    (!drawOdds ||
      awayOdds < drawOdds)
  ) {
    winner = awayTeam;
    selectedOdds = awayOdds;
    winnerSide = "away";
  }

  const outcomes =
    drawOdds !== null
      ? [
          homeOdds,
          drawOdds,
          awayOdds,
        ]
      : [
          homeOdds,
          awayOdds,
        ];

  const sorted = [...outcomes].sort(
    (a, b) => a - b
  );

  const gap =
    sorted[1] > 0
      ? sorted[0] / sorted[1]
      : 1;

  let confidence = "Low";

  if (gap < 0.62) {
    confidence = "High";
  } else if (gap < 0.8) {
    confidence = "Medium";
  }

  const goalMarket =
    extractGoalMarket(source);

  let goalPrediction;
  let overUnder;

  if (goalMarket) {
    goalPrediction =
      `${goalMarket.line} Goals`;

    overUnder =
      `${goalMarket.side} ${goalMarket.line}`;
  } else if (selectedOdds <= 1.3) {
    goalPrediction = "2–4 Goals";
    overUnder = "Over 2.5";
  } else if (selectedOdds <= 1.7) {
    goalPrediction = "2–3 Goals";
    overUnder = "Over 2.5";
  } else {
    goalPrediction = "1–3 Goals";
    overUnder = "Under 3.5";
  }

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

    return res.status(200).json({
      prediction: buildPrediction(text),
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