function cleanText(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractOdds(text) {
  const matches = [];
  const re = /\b(?:[1I]\s*[:.)-]?\s*)?([0-9]{1,3}(?:[.,][0-9]{1,2}))\b/g;

  let m;

  while ((m = re.exec(String(text || "")))) {
    const value = Number(String(m[1]).replace(",", "."));

    if (value >= 1.01 && value <= 100) {
      matches.push({
        value,
        index: m.index,
      });
    }
  }

  return matches;
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

  const bad =
    /^(home|away|draw|market|odds|1|x|2|over|under|yes|no|btts|football|soccer|prediction|today|live|premier|league|vs|v)$/i;

  const candidates = [];

  for (const line of rawLines) {
    const cleaned = line
      .replace(/\b\d{1,3}(?:[.,]\d{1,2})\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (
      !cleaned ||
      bad.test(cleaned) ||
      cleaned.length < 3 ||
      cleaned.length > 45
    ) {
      continue;
    }

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
    /(.{2,35})\s+(?:vs?|versus)\s+(.{2,35})/i
  );

  if (vs) {
    return [titleCase(vs[1]), titleCase(vs[2])];
  }

  const usable = unique(candidates).filter(
    (x) => x.split(" ").length <= 7
  );

  return usable.length >= 2
    ? [usable[0], usable[1]]
    : ["Unable to read home team", "Unable to read away team"];
}

function extractGoalMarket(text) {
  for (const line of String(text || "").split("\n")) {
    const m = line.match(/(?:over|under)\s*(\d+(?:[.,]\d+)?)/i);

    if (m) {
      return {
        line: Number(m[1].replace(",", ".")),
        side: /over/i.test(line) ? "Over" : "Under",
      };
    }
  }

  return null;
}

function buildPrediction(text) {
  const source = String(text || "");

  const odds = extractOdds(source);

  const [homeTeam, awayTeam] = extractTeams(source);

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
        "The screenshot did not contain enough readable decimal odds. Please upload a clearer betting screenshot showing the teams and odds.",
    };
  }

  const first = odds.slice(0, 3).map((x) => x.value);

  const homeOdds = first[0];

  const drawOdds = first.length >= 3 ? first[1] : null;

  const awayOdds = first.length >= 3 ? first[2] : first[1];

  let winner = "Draw";

  let selectedOdds = drawOdds ?? homeOdds;

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

  const outcomes = drawOdds
    ? [homeOdds, drawOdds, awayOdds]
    : [homeOdds, awayOdds];

  const sorted = [...outcomes].sort((a, b) => a - b);

  const gap = sorted[1] ? sorted[0] / sorted[1] : 1;

  const confidence =
    gap < 0.62
      ? "High"
      : gap < 0.8
      ? "Medium"
      : "Low";

  const goalMarket = extractGoalMarket(source);

  let goalPrediction = goalMarket
    ? `${goalMarket.line} Goals`
    : "2–3 Goals";

  let overUnder = goalMarket
    ? `${goalMarket.side} ${goalMarket.line}`
    : "Over 2.5";

  if (!goalMarket) {
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

  const btts =
    selectedOdds <= 1.3 &&
    ((winnerSide === "away" && homeOdds >= 7) ||
      (winnerSide === "home" && awayOdds >= 7))
      ? "No"
      : "Yes";

  let possibleScore = "1–1";

  if (winnerSide === "away") {
    possibleScore = selectedOdds <= 1.3 ? "0–2" : "1–2";
  }

  if (winnerSide === "home") {
    possibleScore = selectedOdds <= 1.3 ? "2–0" : "2–1";
  }

  return {
    home_team: homeTeam,
    away_team: awayTeam,
    predicted_winner: winner,
    market: "1X2",
    confidence,

    odds:
      drawOdds !== null
        ? `1: ${homeOdds} | X: ${drawOdds} | 2: ${awayOdds}`
        : `1: ${homeOdds} | 2: ${awayOdds}`,

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

    if (!text || typeof text !== "string") {
      return res.status(400).json({
        error: "No OCR text was provided.",
      });
    }

    return res.status(200).json({
      prediction: buildPrediction(text),
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Unable to process the prediction.",
    });
  }
}