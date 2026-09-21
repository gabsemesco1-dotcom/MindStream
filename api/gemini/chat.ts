import { GoogleGenAI } from "@google/genai";
import { MINDSTREAM_SYSTEM_INSTRUCTION, formatContextForPrompt } from "../../src/lib/aiPrompt";
import { extractAction } from "../../src/lib/actionParser";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Missing GEMINI_API_KEY",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    const { message, history, context } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Message is required.",
      });
    }

    const contextSnippet = formatContextForPrompt(context);
    const systemInstruction = MINDSTREAM_SYSTEM_INSTRUCTION + contextSnippet;

    const contents: any[] = [];

    if (Array.isArray(history)) {
      history.forEach((item: any) => {
        contents.push({
          role: item.role === "user" ? "user" : "model",
          parts: [{ text: item.text }],
        });
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    const rawText = response.text || "";
    const { cleanText, action, actions } = extractAction(rawText);

    return res.status(200).json({
      text: cleanText,
      action,
      actions,
    });

  } catch (err: any) {
    console.error(err);

    return res.status(500).json({
      error: err.message,
    });
  }
}