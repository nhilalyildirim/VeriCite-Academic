import { GoogleGenAI, Type } from "@google/genai";
import {
  Citation,
  CitationStatus,
  VerificationResult
} from "../types";

/* =========================
   GEMINI CLIENT
========================= */

const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY
});

/* =========================
   CROSSREF LOOKUP
========================= */

async function fetchCrossrefMetadata(doi: string) {
  try {
    const clean = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
    const res = await fetch(
      `https://api.crossref.org/works/${encodeURIComponent(clean)}`
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.message;
  } catch {
    return null;
  }
}

/* =========================
   MAIN EXPORT USED BY App.tsx
========================= */

export async function parseAndVerifyCitations(
  text: string
): Promise<VerificationResult> {

  /* ---- 1. EXTRACT CITATIONS ---- */

  const extract = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: `
Extract all academic citations.

Return JSON array only.
Fields:
id, rawText, title, authors[], year, doi

TEXT:
${text}
    `,
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
            authors: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            year: { type: Type.STRING },
            doi: { type: Type.STRING }
          },
          required: ["id", "rawText"]
        }
      }
    }
  });

  const extracted = JSON.parse(extract.text);
  const citations: Citation[] = [];

  /* ---- 2. VERIFY ---- */

  for (const item of extracted) {
    let doi = item.doi;

    if (!doi) {
      const m = item.rawText.match(/\b10\.\d{4,9}\/\S+\b/i);
      if (m) doi = m[0];
    }

    const crossref = doi ? await fetchCrossrefMetadata(doi) : null;

    const verify = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `
Is this a real academic source?

"${item.rawText}"

Answer as:
VERIFIED / UNVERIFIABLE / HALLUCINATION
      `
    });

    const r = verify.text.toLowerCase();

    let status = CitationStatus.UNVERIFIED;
    let confidence = 0.5;

    if (r.includes("hallucination")) {
      status = CitationStatus.HALLUCINATION;
      confidence = 0.95;
    } else if (crossref || r.includes("verified")) {
      status = CitationStatus.VERIFIED;
      confidence = 0.98;
    }

    citations.push({
      id: item.id,
      rawText: item.rawText,
      parsedMetadata: {
        title: crossref?.title?.[0] ?? item.title,
        authors:
          crossref?.author?.map(
            (a: any) => `${a.given} ${a.family}`
          ) ?? item.authors,
        year:
          crossref?.issued?.["date-parts"]?.[0]?.[0]?.toString() ??
          item.year,
        doi
      },
      status,
      confidenceScore: confidence,
      sourceUrl: doi ? `https://doi.org/${doi}` : undefined,
      explanation: verify.text,
      verificationSource: crossref ? "Crossref" : "Gemini"
    });
  }

  /* ---- 3. BIBLIOGRAPHY ---- */

  const verified = citations.filter(
    c => c.status === CitationStatus.VERIFIED
  );

  let multiStyleBib = undefined;

  if (verified.length > 0) {
    const bib = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: `
Generate APA, MLA, Chicago and IEEE bibliographies.
Return JSON.

DATA:
${JSON.stringify(verified)}
      `,
      config: { responseMimeType: "application/json" }
    });

    multiStyleBib = JSON.parse(bib.text);
  }

  return {
    citations,
    summary: {
      total: citations.length,
      verified: verified.length,
      hallucinated: citations.filter(
        c => c.status === CitationStatus.HALLUCINATION
      ).length,
      unverified: citations.filter(
        c => c.status === CitationStatus.UNVERIFIED
      ).length
    },
    multiStyleBib
  };
}
