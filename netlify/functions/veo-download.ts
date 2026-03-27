import type { Handler } from "@netlify/functions";

const handler: Handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
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
    const { uri } = JSON.parse(event.body || "{}");
    if (!uri) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing video URI" }) };
    }

    const res = await fetch(uri, {
      headers: { "x-goog-api-key": apiKey },
    });

    if (!res.ok) {
      return { statusCode: res.status, headers, body: JSON.stringify({ error: "Failed to download video" }) };
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ videoBase64: base64, mimeType: res.headers.get("content-type") || "video/mp4" }),
    };
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

export { handler };
