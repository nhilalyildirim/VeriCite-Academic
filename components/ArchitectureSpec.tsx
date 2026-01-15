
import React from 'react';

const ArchitectureSpec: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-4xl mx-auto overflow-auto max-h-[85vh]">
      <h2 className="text-3xl font-bold mb-6 border-b pb-4 text-slate-800">Production Specification: VeriCite v1.2 (Hardened)</h2>
      
      <div className="space-y-8 text-slate-700 leading-relaxed text-sm">
        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-2">1. Precision-First Verification Policy</h3>
          <p>VeriCite v1.2 prioritizes precision over completeness. It is designed to minimize false positives by adhering to the "Accuracy over Helpfulness" principle.</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><strong>Two-Source Rule:</strong> No source is marked 'Verified' without metadata matches in at least two independent indexes.</li>
            <li><strong>Default to Unverifiable:</strong> Uncertainty results in a downgrade of status rather than a guess.</li>
          </ul>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-2">2. Self-Correction & Review Phase</h3>
          <p>After initial grounding, the system triggers a "Skeptic Pass" using Gemini. This pass specifically looks for fabricated sources that may appear plausible but lack structural existence in registry metadata.</p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-2">3. Hybrid Verification Architecture</h3>
          <p>Combines deterministic DOI lookups (Crossref REST API) with probabilistic semantic grounding. Direct API matches count as Source #1, grounding confirmations count as Source #2.</p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-2">4. Scholarly Database Indexing</h3>
          <p>Integrates Crossref, Semantic Scholar, and PubMed. Uses Google Search Grounding to simulate access to broader scientific web indices where metadata is openly crawlable.</p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-2">5. Hallucination Detection Criteria</h3>
          <p>Detects fabrication by analyzing: 1. Author/Journal citation inconsistencies. 2. Impossible publication dates. 3. Synthesized titles that mirror LLM patterns but resolve to 404 in official registries.</p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-2">6. Mandatory Disclosure Protocol</h3>
          <p>All reports and UI surfaces feature mandatory scholarly disclaimers to prevent over-reliance on automated auditing tools in high-stakes submission workflows.</p>
        </section>

        <section>
          <h3 className="text-lg font-bold text-slate-900 mb-2">7. Hard Technical Limits</h3>
          <p className="text-red-600 font-semibold">Strict Limitations: Cannot verify sources not indexed in public metadata, verify content within restricted-access institutional archives, or guarantee 100% accuracy in pre-print verification.</p>
        </section>
      </div>
    </div>
  );
};

export default ArchitectureSpec;
