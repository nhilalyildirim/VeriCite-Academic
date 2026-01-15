import { GoogleGenAI, Type } from "@google/genai";
import { Citation, CitationStatus, VerificationResult } from "../types";

let ai: any = null;

try {
  const apiKey = import.meta.env.VITE_API_KEY;
  console.log("API Key available:", !!apiKey);
  
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
  } else {
    console.warn("VITE_API_KEY not found in environment variables");
  }
} catch (e) {
  console.error("Failed to initialize GoogleGenAI:", e);
}

async function fetchCrossrefMetadata(doi: string) {
  try {
    const cleanDoi = doi.replace(/^(https?:\/\/)?(dx\.)?doi\.org\//, "").trim();
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json.message;
  } catch (e) {
    console.error("Crossref lookup failed:", e);
    return null;
  }
}

export const parseAndVerifyCitations = async (text: string): Promise<VerificationResult> => {
  if (!ai) {
    throw new Error("Google Gemini API not initialized. Please check your VITE_API_KEY environment variable in Vercel settings.");
  }

  try {
    const parsingResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Extract all academic citations from this text. Identify in-text, parenthetical, or numbered references. 
      Return a JSON array of objects with id, rawText, title, authors[], year, and doi.
      
      TEXT: ${text}`,
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
              doi: { type: Type.STRING }
            },
            required: ["id", "rawText"]
          }
        }
      }
    });

    const extractedCitations = JSON.parse(parsingResponse.text) as any[];
    let citations: Citation[] = [];

    for (const item of extractedCitations) {
      let doi = item.doi;
      if (!doi) {
        const doiRegex = /\b(10[.][0-9]{4,}(?:[.][0-9]+)*\/(?:(?!["&\'<>])\S)+)\b/i;
        const match = item.rawText.match(doiRegex);
        if (match) doi = match[0];
      }

      let crossrefData = doi ? await fetchCrossrefMetadata(doi) : null;
      
      const verificationPrompt = `You are an academic integrity auditor. Verify if this source exists: "${item.rawText}".
      
      STRICT RULES:
      1. A source is "VERIFIED" ONLY if: 
         - Title, Author, and Year (±1) match exactly across TWO or more independent scholarly databases.
      2. If metadata is missing or mismatched, it is "UNVERIFIABLE".
      3. If there are strong indicators of fabrication, it is "HALLUCINATION".
      
      Accuracy is more important than being helpful. If unsure, mark as UNVERIFIABLE.`;

      const verifyResponse = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: verificationPrompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const groundingMetadata = verifyResponse.candidates?.[0]?.groundingMetadata;
      const groundingChunks = groundingMetadata?.groundingChunks || [];
      const sourceUrl = groundingChunks[0]?.web?.uri || (doi ? `https://doi.org/${doi}` : undefined);
      
      const responseText = verifyResponse.text.toLowerCase();
      let status = CitationStatus.UNVERIFIED;
      let confidence = 0.5;

      if (crossrefData || responseText.includes("verified") || groundingChunks.length >= 1) {
        const hasDoiMatch = !!crossrefData;
        const hasSearchMatch = groundingChunks.length >= 1;
        
        if (hasDoiMatch && hasSearchMatch) {
          status = CitationStatus.VERIFIED;
          confidence = 0.99;
        } else if (hasDoiMatch || hasSearchMatch) {
          status = CitationStatus.PARTIAL_MATCH;
          confidence = 0.75;
        }
      } 
      
      if (responseText.includes("hallucinated") || responseText.includes("fabricated") || responseText.includes("fake")) {
        status = CitationStatus.HALLUCINATION;
        confidence = 0.95;
      }

      citations.push({
        id: item.id || Math.random().toString(36).substr(2, 9),
        rawText: item.rawText,
        parsedMetadata: {
          title: crossrefData?.title?.[0] || item.title,
          authors: crossrefData?.author?.map((a: any) => `${a.given} ${a.family}`) || item.authors,
          year: crossrefData?.created?.['date-parts']?.[0]?.[0]?.toString() || item.year,
          doi: doi
        },
        status,
        confidenceScore: confidence,
        sourceUrl: sourceUrl,
        explanation: verifyResponse.text,
        verificationSource: (crossrefData ? "Crossref " : "") + (groundingChunks.length > 0 ? "+ Web Scholarly Index" : "")
      });
    }

    // Self-Correction Review Step
    const reviewResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Review these citation verification results as a skeptic. Downgrade 'VERIFIED' to 'UNVERIFIABLE' if confidence is not absolute.
      
      DATA: ${JSON.stringify(citations)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              newStatus: { type: Type.STRING },
              reasoning: { type: Type.STRING }
            },
            required: ["id", "newStatus", "reasoning"]
          }
        }
      }
    });

    const reviews = JSON.parse(reviewResponse.text);
    citations = citations.map(c => {
      const review = reviews.find((r: any) => r.id === c.id);
      if (review && review.newStatus !== c.status) {
        return { 
          ...c, 
          status: review.newStatus as CitationStatus, 
          explanation: `${c.explanation}\n\n[Skeptic Review]: ${review.reasoning}` 
        };
      }
      return c;
    });

    // Generate Multi-Style Bibliography for ONLY verified sources
    const verifiedCitations = citations.filter(c => c.status === CitationStatus.VERIFIED);
    let multiStyleBib = undefined;
    
    if (verifiedCitations.length > 0) {
      const bibResponse = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Generate clean bibliographies for these verified sources in APA 7, MLA, Chicago, and IEEE styles.
        Return as a JSON object with keys: apa, mla, chicago, ieee.
        
        DATA: ${JSON.stringify(verifiedCitations)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              apa: { type: Type.STRING },
              mla: { type: Type.STRING },
              chicago: { type: Type.STRING },
              ieee: { type: Type.STRING }
            },
            required: ["apa", "mla", "chicago", "ieee"]
          }
        }
      });
      multiStyleBib = JSON.parse(bibResponse.text);
    }

    return {
      citations,
      summary: {
        total: citations.length,
        verified: citations.filter(c => c.status === CitationStatus.VERIFIED).length,
        hallucinated: citations.filter(c => c.status === CitationStatus.HALLUCINATION).length,
        unverified: citations.filter(c => c.status === CitationStatus.UNVERIFIED || c.status === CitationStatus.PARTIAL_MATCH).length
      },
      multiStyleBib
    };
  } catch (error) {
    console.error("Citation verification error:", error);
    throw error;
  }
};

export const exportBibliography = async (citations: Citation[], style: string): Promise<string> => {
  if (!ai) {
    throw new Error("Google Gemini API not initialized");
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `Generate a clean, professional bibliography in ${style} style. 
    Only include sources verified as REAL.
    
    DATA: ${JSON.stringify(citations.filter(c => c.status === CitationStatus.VERIFIED))}`
  });
  return response.text;
};
