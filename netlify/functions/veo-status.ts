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
    const { operation } = JSON.parse(event.body || "{}");
    const ai = new GoogleGenAI({ apiKey });

    const updated = await ai.operations.getVideosOperation({ operation });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ operation: updated }),
    };
  } catch (err: any) {
    if (err.message?.includes("not found")) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: "session_expired" }) };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

export { handler };
