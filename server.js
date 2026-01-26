// server.js
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { runAthenaAdvisory } from "./src/main.js"; // Importing your existing logic

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// API Endpoint to trigger the agents
app.post("/api/run-analysis", async (req, res) => {
  try {
    const userInputs = {
      risk_tolerance: req.body.risk_tolerance || "neutral",
      investment_horizon_years: req.body.investment_horizon_years || 5,
      preferred_sectors: req.body.preferred_sectors || [], // e.g. ["AI", "Energy"]
      num_stocks_requested: req.body.num_stocks_requested || 5,
      min_volume: 500000
    };

    console.log("Starting Athena Run with inputs:", userInputs);

    // Call your existing main entry point
    const result = await runAthenaAdvisory(userInputs);

    // Send back the portfolio and the full transcript of agent thoughts
    res.json({
      success: true,
      portfolio: result.final_portfolio,
      transcript: result.transcript,
      savedPath: result.savedPath
    });

  } catch (error) {
    console.error("Agent execution failed:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Athena Advisory API running on http://localhost:${PORT}`);
});