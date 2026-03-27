import type { Handler } from "@netlify/functions";
import { GoogleGenAI } from "@google/genai";

const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Gemini API key not configured" }) };
  }

  try {
    const { prompt, imageBytes, mimeType } = JSON.parse(event.body || "{}");
    const ai = new GoogleGenAI({ apiKey });

    const operation = await ai.models.generateVideos({
      model: "veo-3.1-fast-generate-preview",
      prompt,
      image: { imageBytes, mimeType: mimeType || "image/png" },
      config: { numberOfVideos: 1, aspectRatio: "9:16" },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ operation }),
    };
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

export { handler };
