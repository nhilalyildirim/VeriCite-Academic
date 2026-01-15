import { VerificationResult } from "../types";

export async function verifyText(
  text: string
): Promise<VerificationResult> {
  const res = await fetch("/api/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error("Verification failed");
  }

  return res.json();
}

