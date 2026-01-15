import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt required" });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash" });
    const result = await model.generateContent(prompt);

    const text = result.response.text();
    res.status(200).json({ text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "API error" });
  }
}
