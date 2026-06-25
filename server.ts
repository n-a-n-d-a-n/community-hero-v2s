import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

// Helper function to call Gemini with robust model fallbacks (prevents 429/503 issues on individual models)
async function callGeminiWithModels(ai: any, params: {
  contents: any,
  config?: any
}) {
  const models = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-2.5-flash"];
  let lastError: any = null;
  
  for (const model of models) {
    try {
      console.log(`Attempting Gemini API with model: ${model}`);
      const response = await ai.models.generateContent({
        ...params,
        model: model
      });
      if (response && response.text) {
        console.log(`Success with Gemini model: ${model}`);
        return response.text;
      }
    } catch (e: any) {
      lastError = e;
      const errStr = String(e.message || e || "").toLowerCase();
      // If we are hit with a global developer quota/rate limit, abort the loop immediately
      // as trying other flash models on the same project will also hit the exact same quota.
      if (errStr.includes("quota") || errStr.includes("429") || errStr.includes("resource_exhausted") || errStr.includes("exhausted")) {
        console.warn(`Global Gemini API rate-limitation/quota limit reached (RESOURCE_EXHAUSTED). Skipping other models to prevent latency.`);
        break;
      }
      console.warn(`Model ${model} failed, testing next option.`);
    }
  }
  
  throw lastError || new Error("All Gemini models failed to generate content.");
}

// Helper to retry Gemini call exactly once on failure
async function callGeminiWithRetry(ai: any, params: {
  contents: any,
  config?: any
}) {
  try {
    return await callGeminiWithModels(ai, params);
  } catch (error: any) {
    console.warn("First Gemini attempt failed. Retrying once... Error:", error.message || error);
    // Wait 1 second before retrying to give the system/quota a small break
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return await callGeminiWithModels(ai, params);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase body size limit to handle base64 image uploads
  app.use(express.json({ limit: "15mb" }));
  app.use(express.urlencoded({ limit: "15mb", extended: true }));

  // Basic health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Triage / Classification Endpoint using Gemini
  app.post("/api/classify", async (req, res) => {
    try {
      const { image, video, mimeType } = req.body;
      const mediaData = image || video;
      if (!mediaData || !mimeType) {
        return res.status(400).json({ error: "Missing 'image' or 'video' base64 data, or 'mimeType'" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server environment" });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Prepare payload for GenAI
      const mediaPart = {
        inlineData: {
          mimeType: mimeType,
          data: mediaData, // expects base64 encoded string only
        },
      };

      // Exact prompt requested by user (updated to handle both images and videos)
      const promptText = `You are a civic issue triage assistant. Analyze the image or video clip and respond ONLY in this exact JSON format, no markdown, no preamble:
{
  "category": "Pothole | Garbage | Streetlight | Waterlogging | Signage | Other",
  "severity": "Low | Medium | High | Critical",
  "description": "<one sentence, factual, no speculation>",
  "department": "Roads | Sanitation | Electricity | Water | Municipal General",
  "confidence": <0.0 to 1.0>
}
If the media does not show a clear civic issue, set category to "Other" and confidence below 0.4.`;

      let classifiedData;
      try {
        const responseText = await callGeminiWithRetry(ai, {
          contents: { parts: [mediaPart, { text: promptText }] },
          config: {
            responseMimeType: "application/json",
          },
        });
        classifiedData = JSON.parse(responseText.trim());
        res.json({ result: classifiedData });
      } catch (geminiError: any) {
        console.error("Gemini classification failed after retries:", geminiError.message || geminiError);
        res.status(503).json({ error: "AI analysis temporarily unavailable" });
      }
    } catch (error: any) {
      console.error("Classification endpoint error:", error);
      res.status(500).json({ error: error.message || "Failed to classify image" });
    }
  });

  // Deduplication Endpoint using Gemini
  app.post("/api/deduplicate", async (req, res) => {
    try {
      const { newDescription, existingDescription, category } = req.body;
      if (!newDescription || !existingDescription) {
        return res.status(400).json({ error: "Missing 'newDescription' or 'existingDescription'" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server environment" });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const systemInstruction = `You are comparing a NEW civic report against an EXISTING nearby report to determine if they describe the same issue. Respond ONLY in JSON:
{
  "is_duplicate": true|false,
  "reasoning": "<one short sentence>"
}
Treat as duplicate only if the category matches and the description implies the same physical issue. Be conservative — false merges are worse than missed ones.`;

      const promptText = `Category: ${category || "Civic Issue"}
NEW Report Description: "${newDescription}"
EXISTING Report Description: "${existingDescription}"`;

      let deduplicatedResult;
      try {
        const responseText = await callGeminiWithRetry(ai, {
          contents: { parts: [{ text: promptText }] },
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
          },
        });
        deduplicatedResult = JSON.parse(responseText.trim());
        res.json({ result: deduplicatedResult });
      } catch (geminiError: any) {
        console.error("Gemini deduplication failed after retries:", geminiError.message || geminiError);
        res.status(503).json({ error: "AI analysis temporarily unavailable" });
      }
    } catch (error: any) {
      console.error("Deduplication endpoint error:", error);
      res.status(500).json({ error: error.message || "Failed to deduplicate reports" });
    }
  });

  // Escalation Endpoint using Gemini
  app.post("/api/escalate", async (req, res) => {
    try {
      const { category, severity, description, department, ageDays } = req.body;
      if (!category || !severity || !description) {
        return res.status(400).json({ error: "Missing required fields for escalation" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server environment" });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const systemInstruction = `You are reviewing a civic issue ticket that has exceeded its resolution SLA. Generate a brief, firm but professional escalation note addressed to the responsible department, referencing the ticket's age and severity. Keep it under 40 words. Do not invent facts not present in the ticket data. Respond ONLY in JSON: {"escalation_note": "<text>"}`;

      const promptText = `Category: ${category}
Severity: ${severity}
Department: ${department || "municipal department"}
Ticket Age: ${ageDays || "several"} days
Description: "${description}"`;

      let escalationResult;
      try {
        const responseText = await callGeminiWithRetry(ai, {
          contents: { parts: [{ text: promptText }] },
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
          },
        });
        escalationResult = JSON.parse(responseText.trim());
        res.json({ result: escalationResult });
      } catch (geminiError: any) {
        console.error("Gemini escalation failed after retries:", geminiError.message || geminiError);
        res.status(503).json({ error: "AI analysis temporarily unavailable" });
      }
    } catch (error: any) {
      console.error("Escalation endpoint error:", error);
      res.status(500).json({ error: error.message || "Failed to escalate report" });
    }
  });

  // Hotspot Insights Endpoint using Gemini
  app.post("/api/hotspot-insights", async (req, res) => {
    try {
      const { category, count, dateRange, approxLocation } = req.body;
      if (!category || !count || !dateRange || !approxLocation) {
        return res.status(400).json({ error: "Missing required fields for hotspot insights" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server environment" });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const systemInstruction = `You are a civic infrastructure analyst. Given this cluster of repeated issues in one area, write a one-sentence predictive insight about the underlying pattern, and a one-sentence recommended proactive action for the municipal department. Respond ONLY in JSON: {"insight": "<text>", "recommended_action": "<text>"}`;

      const promptText = `Category of issues: ${category}
Number of repeated reports: ${count}
Date range: ${dateRange}
Approximate location: ${approxLocation}`;

      let insightsResult;
      try {
        const responseText = await callGeminiWithRetry(ai, {
          contents: { parts: [{ text: promptText }] },
          config: {
            systemInstruction: systemInstruction,
            responseMimeType: "application/json",
          },
        });
        insightsResult = JSON.parse(responseText.trim());
        res.json({ result: insightsResult });
      } catch (geminiError: any) {
        console.error("Gemini hotspot insights failed after retries:", geminiError.message || geminiError);
        res.status(503).json({ error: "AI analysis temporarily unavailable" });
      }
    } catch (error: any) {
      console.error("Hotspot insights endpoint error:", error);
      res.status(500).json({ error: error.message || "Failed to generate hotspot insights" });
    }
  });

  // Vite middleware setup for Development or Static assets for Production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Since we're using Express 4, use app.get('*', ...)
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
