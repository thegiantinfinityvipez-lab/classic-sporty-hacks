function clean(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTeams(text) {
  const match = text.match(
    /([A-Za-z][A-Za-z .'-]{1,35}?)\s+(?:vs?\.?|versus)\s+([A-Za-z][A-Za-z .'-]{1,35}?)(?=\s+(?:1\s*[:.]?\s*\d|\d{1,3}[.,]\d{1,2}\b|odds\b)|$)/i
  );

  if (match) {
    return [
      match[1].trim(),
      match[2].trim()
    ];
  }

  const simpleMatch = text.match(
    /([A-Za-z][A-Za-z .'-]{1,35})\s+(?:vs?\.?|versus)\s+([A-Za-z][A-Za-z .'-]{1,35})/i
  );

  return simpleMatch
    ? [simpleMatch[1].trim(), simpleMatch[2].trim()]
    : ["Home Team", "Away Team"];
}

function extractOdds(text) {
  const normalized = text
    .replace(/[|]/g, " ")
    .replace(/,/g, ".");

  // Prefer odds written beside 1, X and 2.
  const labeled = normalized.match(
    /\b1\s*[:.]?\s*(\d{1,3}\.\d{1,2})\s+X\s*[:.]?\s*(\d{1,3}\.\d{1,2})\s+2\s*[:.]?\s*(\d{1,3}\.\d{1,2})/i
  );

  if (labeled) {
    const odds = labeled.slice(1).map(Number);

    if (odds.every(value => value >= 1.01 && value <= 100)) {
      return {
        home: odds[0],
        draw: odds[1],
        away: odds[2]
      };
    }
  }

  // Support layouts such as: 1 1.35 X 4.50 2 8.00.
  const compact = normalized.match(
    /\b1\s+(\d{1,3}\.\d{1,2})\s+X\s+(\d{1,3}\.\d{1,2})\s+2\s+(\d{1,3}\.\d{1,2})/i
  );

  if (compact) {
    const odds = compact.slice(1).map(Number);

    if (odds.every(value => value >= 1.01 && value <= 100)) {
      return {
        home: odds[0],
        draw: odds[1],
        away: odds[2]
      };
    }
  }

  // Fall back to three consecutive decimal odds.
  // Only use this when the OCR did not preserve the labels.
  const numbers = [
    ...normalized.matchAll(/\b(\d{1,3}\.\d{1,2})\b/g)
  ]
    .map(match => Number(match[1]))
    .filter(value => value >= 1.01 && value <= 100);

  if (numbers.length >= 3) {
    return {
      home: numbers[0],
      draw: numbers[1],
      away: numbers[2]
    };
  }

  if (numbers.length === 2) {
    return {
      home: numbers[0],
      draw: null,
      away: numbers[1]
    };
  }

  return null;
}

function calculateProbability(odds) {
  const outcomes = [
    { key: "home", odds: odds.home },
    ...(odds.draw !== null
      ? [{ key: "draw", odds: odds.draw }]
      : []),
    { key: "away", odds: odds.away }
  ];

  // Raw implied probabilities include the bookmaker's margin.
  const totalImplied = outcomes.reduce(
    (sum, outcome) => sum + 1 / outcome.odds,
    0
  );

  // Normalize them so the estimated percentages add up to 100%.
  return outcomes.map(outcome => ({
    ...outcome,
    probability: (1 / outcome.odds / totalImplied) * 100
  }));
}

function makePrediction(text) {
  const [home, away] = extractTeams(text);
  const odds = extractOdds(text);

  if (!odds) {
    return {
      home_team: home,
      away_team: away,
      predicted_winner: "Unable to determine",
      goal_prediction: "Unavailable",
      over_under: "Unavailable",
      btts: "Unavailable",
      possible_score: "Unavailable",
      confidence: "Unavailable",
      estimated_probability: "Unavailable",
      odds: "Not reliably detected",
      reason:
        "The screenshot did not contain clearly readable match odds. Upload a clearer screenshot showing the teams and their 1X2 odds."
    };
  }

  const probabilities = calculateProbability(odds);

  const favourite = probabilities.reduce(
    (lowest, outcome) =>
      outcome.odds < lowest.odds ? outcome : lowest,
    probabilities[0]
  );

  let winner;
  let score;

  if (favourite.key === "home") {
    winner = home;
    score = odds.home < 1.5 ? "2-0 (estimate)" : "2-1 (estimate)";
  } else if (favourite.key === "away") {
    winner = away;
    score = odds.away < 1.5 ? "0-2 (estimate)" : "1-2 (estimate)";
  } else {
    winner = "Draw";
    score = "1-1 (estimate)";
  }

  const probability = favourite.probability;

  let confidence;

  if (probability >= 65) {
    confidence = "Strongest market favourite";
  } else if (probability >= 45) {
    confidence = "Moderate market favourite";
  } else {
    confidence = "No strong favourite";
  }

  const goalMarket = text.match(
    /\b(over|under)\s*(\d+(?:[.,]\d+)?)/i
  );

  const oddsText =
    `1 (Home): ${odds.home}` +
    (odds.draw !== null ? ` | X (Draw): ${odds.draw}` : "") +
    ` | 2 (Away): ${odds.away}`;

  const probabilityText = probabilities
    .map(outcome => {
      const label =
        outcome.key === "home" ? home :
        outcome.key === "away" ? away :
        "Draw";

      return `${label}: ${outcome.probability.toFixed(1)}%`;
    })
    .join(" | ");

  return {
    home_team: home,
    away_team: away,
    predicted_winner: winner,
    goal_prediction: "Not reliably determined from 1X2 odds",
    over_under: goalMarket
      ? `${goalMarket[1].toUpperCase()} ${goalMarket[2].replace(",", ".")}`
      : "Not reliably determined from 1X2 odds",
    btts: "Not reliably determined from 1X2 odds",
    possible_score: score,
    confidence,
    estimated_probability: `${probability.toFixed(1)}% (market-based estimate)`,
    odds: oddsText,
    outcome_probabilities: probabilityText,
    reason:
      `${winner} has the lowest detected odds and is the market favourite. ` +
      `Estimated probabilities: ${probabilityText}. ` +
      "These figures are derived from the detected odds, not live team statistics. " +
      "A favourite can still lose; no outcome is guaranteed."
  };
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const text = clean(req.body?.text);

    if (!text) {
      return res.status(400).json({
        error: "No screenshot text was received."
      });
    }

    return res.status(200).json({
      success: true,
      prediction: makePrediction(text)
    });
  } catch (error) {
    console.error("Sure Prediction error:", error);

    return res.status(500).json({
      error: "Unable to analyze the screenshot."
    });
  }
}