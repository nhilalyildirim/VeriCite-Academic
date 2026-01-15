
export enum CitationStatus {
  VERIFIED = 'VERIFIED',
  PARTIAL_MATCH = 'PARTIAL_MATCH',
  UNVERIFIED = 'UNVERIFIED',
  HALLUCINATION = 'HALLUCINATION',
  PENDING = 'PENDING'
}

export enum UserTier {
  FREE = 'FREE',
  PRO = 'PRO'
}

export interface Citation {
  id: string;
  rawText: string;
  parsedMetadata: {
    title?: string;
    authors?: string[];
    year?: string;
    journal?: string;
    doi?: string;
    volume?: string;
    issue?: string;
  };
  status: CitationStatus;
  confidenceScore: number;
  verificationSource?: string;
  sourceUrl?: string;
  explanation?: string;
  correctedText?: string;
}

export interface VerificationResult {
  citations: Citation[];
  summary: {
    total: number;
    verified: number;
    hallucinated: number;
    unverified: number;
  };
  multiStyleBib?: {
    apa: string;
    mla: string;
    chicago: string;
    ieee: string;
  };
}

export interface AppState {
  view: 'input' | 'results' | 'spec' | 'pricing' | 'auth' | 'payment';
  inputText: string;
  results: VerificationResult | null;
  error: string | null;
  userTier: UserTier;
  analysesRemaining: number;
  isLoggedIn: boolean;
}
