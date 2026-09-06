import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  MINDSTREAM_SYSTEM_INSTRUCTION,
  MINDSTREAM_FALLBACK_NO_API_KEY,
  MINDSTREAM_ERROR_HIGH_TRAFFIC,
  MINDSTREAM_ERROR_CONNECTION,
  formatContextForPrompt
} from "./src/lib/aiPrompt";
import { extractAction } from "./src/lib/actionParser";

dotenv.config();

if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== "") {
  console.log("Gemini key found");
} else {
  console.log("Gemini key missing");
}

// Lazy initialize Gemini client to prevent startup crash if key is missing
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY" || key === "") {
      throw new Error("GEMINI_API_KEY environment variable is not set or invalid.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoint for server-side MindStream AI Companion
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { message, history, context } = req.body;
      if (!message) {
        res.status(400).json({ error: "Message is required." });
        return;
      }

      let ai;
      try {
        ai = getGeminiClient();
      } catch (err: any) {
        // Fallback gracefully if API key is not configured, instructing the user
        console.warn("Gemini Client init issue:", err.message);
        res.json({
          text: MINDSTREAM_FALLBACK_NO_API_KEY,
          action: null
        });
        return;
      }

      // Structure system prompt with real-time workspace context
      const contextSnippet = formatContextForPrompt(context);
      const systemInstruction = MINDSTREAM_SYSTEM_INSTRUCTION + contextSnippet;

      // Re-map history to the expected structure if provided, or supply as contents.
      // With @google/genai, ai.models.generateContent accepts content lists.
      // Format history: array of { role: 'user'|'model', parts: [{ text: string }] }
      const formattedContents: any[] = [];
      if (Array.isArray(history)) {
        history.forEach((h: any) => {
          formattedContents.push({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
          });
        });
      }
      formattedContents.push({
        role: 'user',
        parts: [{ text: message }]
      });

      let response;
      let success = false;
      const models = ["gemini-3.5-flash", "gemini-2.5-flash"];

      for (let i = 0; i < models.length; i++) {
        const currentModel = models[i];
        let attempt = 0;
        const maxRetries = 3;
        const retryDelayMs = 2000;
        let is503Error = false;

        while (attempt <= maxRetries) {
          try {
            console.log(`Sending request to model: ${currentModel} (Attempt ${attempt + 1}/${maxRetries + 1})`);
            response = await ai.models.generateContent({
              model: currentModel,
              contents: formattedContents,
              config: {
                systemInstruction,
                temperature: 0.7,
              },
            });
            success = true;
            break; // Succeeded!
          } catch (error: any) {
            console.error(`Gemini request failed for model ${currentModel} (Attempt ${attempt + 1}):`, error);

            const status = error.status || error.statusCode || error.response?.status;
            const msg = (error.message || "").toLowerCase();
            is503Error = status === 503 || status === '503' || msg.includes("503") || msg.includes("unavailable");

            if (is503Error) {
              // If it's the first model, automatically fall back to the second model immediately
              if (currentModel === "gemini-3.5-flash") {
                console.log("gemini-3.5-flash returned 503. Switching immediately to fallback model gemini-2.5-flash...");
                break; // Break the retry loop for gemini-3.5-flash, proceeds to the next model
              }

              // For the second/fallback model, retry up to 3 times
              if (attempt < maxRetries) {
                attempt++;
                console.log(`Retrying ${currentModel} in ${retryDelayMs / 1000}s due to 503 UNAVAILABLE (Retry ${attempt}/${maxRetries})...`);
                await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
                continue;
              }
            }

            // If it's a non-503 error, or we ran out of retries on the final model, handle responses
            if (is503Error && i === models.length - 1) {
              res.json({ text: MINDSTREAM_ERROR_HIGH_TRAFFIC, action: null });
              return;
            } else if (!is503Error) {
              res.json({ text: MINDSTREAM_ERROR_CONNECTION, action: null });
              return;
            }

            // If it was a 503 on an intermediate model, break to proceed to the next model
            break;
          }
        }

        if (success) {
          break;
        }
      }
      if (!response) {
        throw new Error("No response received from AI model.");
      }

      const rawText = response.text || "";
      const { cleanText, action } = extractAction(rawText);

      res.json({ text: cleanText, action });
    } catch (error: any) {
      console.error("AI API Error:", error);
      res.status(500).json({ error: "An unexpected error occurred. Please try again later." });
    }
  });

  // Health check route
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // OAuth Callback Route to handle redirects and notify parent iframe
  app.get(['/auth/callback', '/auth/callback/'], (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authenticating...</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              background-color: #f9f9ff;
              color: #151c27;
              margin: 0;
            }
            .spinner {
              width: 40px;
              height: 40px;
              border: 4px solid #f3f3f3;
              border-top: 4px solid #3525cd;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin-bottom: 20px;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <h2>Completing Sign In...</h2>
          <p>This window will close automatically once authentication is finished.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS',
                hash: window.location.hash,
                search: window.location.search
              }, '*');
              setTimeout(() => {
                window.close();
              }, 1500);
            } else {
              window.location.href = '/';
            }
          </script>
        </body>
      </html>
    `);
  });

  // Integrate Vite middleware in development to handle client assets hot loading
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express full-stack server listening on http://localhost:${PORT}`);
  });
}

startServer();
