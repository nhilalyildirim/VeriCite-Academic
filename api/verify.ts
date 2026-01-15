import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";
import {
  Citation,
  CitationStatus,
  VerificationResult,
} from "../src/types";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

// --------------------
// Crossref helper
// --------------------
async function fetchCrossrefMetadata(doi: string) {
  try {
    const cleanDoi = doi
      .replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, "")
      .trim();

    const response = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) return null;
    const json = await response.json();
    return json.message;
  } catch (e) {
    console.error("Crossref error:", e);
    return null;
  }
}

// --------------------
// CORE LOGIC (SENİN KODUN)
// --------------------
async function parseAndVerifyCitations(
  text: string
): Promise<VerificationResult> {
  // 1️⃣ Citation extraction
  const parsingResponse = await ai.models.generateContent({
    model: "gemini-3-flash",
    contents: `Extract all academic citations from this text.
Return JSON array with: id, rawText, title, authors[], year, doi.

TEXT:
${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            rawText: { type: Type.STRING },
            title: { type: Type.STRING },
            authors: { type: Type.ARRAY, items: { type: Type.STRING } },
            year: { type: Type.STRING },
            doi: { type: Type.STRING },
          },
          required: ["id", "rawText"],
        },
      },
    },
  });

  const extracted = JSON.parse(parsingResponse.text) as any[];
  let citations: Citation[] = [];

  // 2️⃣ Verification loop
  for (const item of extracted) {
    let doi = item.doi;

    if (!doi) {
      const doiRegex =
        /\b(10[.][0-9]{4,}(?:[.][0-9]+)*\/(?:(?!["&'<>])\S)+)\b/i;
      const match = item.rawText.match(doiRegex);
      if (match) doi = match[0];
    }

    const crossrefData = doi ? await fetchCrossrefMetadata(doi) : null;

    const verificationPrompt = `You are an academic integrity auditor.
Verify if this source exists: "${item.rawText}"

Rules:
- VERIFIED only if strong evidence exists
- If unsure → UNVERIFIABLE
- If fake → HALLUCINATION`;

    const verifyResponse = await ai.models.generateContent({
      model: "gemini-3-flash",
      contents: verificationPrompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const responseText = verifyResponse.text.toLowerCase();
    const groundingChunks =
      verifyResponse.candidates?.[0]?.groundingMetadata?.groundingChunks ||
      [];

    let status = CitationStatus.UNVERIFIED;
    let confidence = 0.5;

    if (crossrefData || groundingChunks.length > 0) {
      status = CitationStatus.PARTIAL_MATCH;
      confidence = 0.75;
    }

    if (crossrefData && groundingChunks.length > 0) {
      status = CitationStatus.VERIFIED;
      confidence = 0.99;
    }

    if (
      responseText.includes("hallucinated") ||
      responseText.includes("fabricated") ||
      responseText.includes("fake")
    ) {
      status = CitationStatus.HALLUCINATION;
      confidence = 0.95;
    }

    citations.push({
      id: item.id || Math.random().toString(36).slice(2),
      rawText: item.rawText,
      parsedMetadata: {
        title: crossrefData?.title?.[0] || item.title,
        authors:
          crossrefData?.author?.map(
            (a: any) => `${a.given} ${a.family}`
          ) || item.authors,
        year:
          crossrefData?.created?.["date-parts"]?.[0]?.[0]?.toString() ||
          item.year,
        doi,
      },
      status,
      confidenceScore: confidence,
      explanation: verifyResponse.text,
      sourceUrl:
        groundingChunks[0]?.web?.uri ||
        (doi ? `https://doi.org/${doi}` : undefined),
      verificationSource:
        (crossrefData ? "Crossref " : "") +
        (groundingChunks.length > 0 ? "+ Web Search" : ""),
    });
  }

  // 3️⃣ Bibliography (only verified)
  const verified = citations.filter(
    (c) => c.status === CitationStatus.VERIFIED
  );

  let multiStyleBib = undefined;

  if (verified.length > 0) {
    const bibResponse = await ai.models.generateContent({
      model: "gemini-3-flash",
      contents: `Generate APA, MLA, Chicago, IEEE bibliographies.
Return JSON object.

DATA:
${JSON.stringify(verified)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            apa: { type: Type.STRING },
            mla: { type: Type.STRING },
            chicago: { type: Type.STRING },
            ieee: { type: Type.STRING },
          },
          required: ["apa", "mla", "chicago", "ieee"],
        },
      },
    });

    multiStyleBib = JSON.parse(bibResponse.text);
  }

  return {
    citations,
    summary: {
      total: citations.length,
      verified: verified.length,
      hallucinated: citations.filter(
        (c) => c.status === CitationStatus.HALLUCINATION
      ).length,
      unverified: citations.filter(
        (c) =>
          c.status === CitationStatus.UNVERIFIED ||
          c.status === CitationStatus.PARTIAL_MATCH
      ).length,
    },
    multiStyleBib,
  };
}

// --------------------
// HTTP HANDLER
// --------------------
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { text } = req.body;
    const result = await parseAndVerifyCitations(text);
    res.status(200).json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Verification failed" });
  }
}
