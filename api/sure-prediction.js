export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({
      error:
        "Prediction service is not configured. Add OPENAI_API_KEY to Vercel Environment Variables.",
    });
  }

  try {
    const { image } = req.body || {};

    if (
      !image ||
      typeof image !== "string" ||
      !image.startsWith("data:image/")
    ) {
      return res.status(400).json({
        error: "Please upload a valid match screenshot.",
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },

      body: JSON.stringify({
        model: "gpt-5.6-luna",

        input: [
          {
            role: "user",

            content: [
              {
                type: "input_text",

                text: `
Analyze this football betting screenshot for SURE PREDICTION.

Read the visible team names, match information and odds carefully.

Identify the two teams if possible.

Use the displayed odds as an important signal, together with any other readable match information.

Give ONE predicted winner only when the screenshot contains enough information to make a reasonable analysis.

Do NOT claim certainty.

Do NOT invent team names.

Do NOT invent odds.

If the screenshot is too unclear to reliably identify the teams or odds, return "Unable to determine".

Return ONLY valid JSON with exactly these fields:

{
  "home_team": "string",
  "away_team": "string",
  "predicted_winner": "string",
  "market": "1X2",
  "confidence": "Low|Medium|High",
  "odds": "string",
  "reason": "short explanation"
}

The prediction must be based on the actual screenshot uploaded by the user.
`,

              },

              {
                type: "input_image",
                image_url: image,
                detail: "high",
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error?.message ||
          "The prediction service returned an error.",
      });
    }

    const text = data?.output_text || "";

    const cleaned = text
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    let prediction;

    try {
      prediction = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({
        error:
          "The prediction service returned an invalid result.",
      });
    }

    return res.status(200).json({
      prediction,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error:
        "Unable to analyze the screenshot right now.",
    });
  }
}