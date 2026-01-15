
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import ArchitectureSpec from './components/ArchitectureSpec';
import { AppState, CitationStatus, UserTier, VerificationResult } from './types';
import { parseAndVerifyCitations } from './services/geminiService';
import { 
  CheckCircle, AlertTriangle, XCircle, Search, FileText, 
  Download, Loader2, Info, Upload, CreditCard, Lock, 
  Crown, User, ChevronRight, RefreshCw, ShieldAlert,
  Copy, Check
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { jsPDF } from 'jspdf';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    view: 'input',
    inputText: '',
    results: null,
    error: null,
    userTier: UserTier.FREE,
    analysesRemaining: 10,
    isLoggedIn: false
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleProcess = async () => {
    if (!state.inputText.trim()) return;
    if (state.userTier === UserTier.FREE && state.analysesRemaining <= 0) {
      setState(p => ({ ...p, view: 'pricing', error: "Analysis limit reached. Upgrade to Pro for unlimited verification." }));
      return;
    }
    
    setIsProcessing(true);
    setState(prev => ({ ...prev, error: null }));
    
    try {
      const results = await parseAndVerifyCitations(state.inputText);
      setState(prev => ({
        ...prev,
        view: 'results',
        results,
        analysesRemaining: prev.userTier === UserTier.FREE ? prev.analysesRemaining - 1 : prev.analysesRemaining
      }));
    } catch (err) {
      console.error(err);
      setState(prev => ({
        ...prev,
        error: "Verification failed. System load is high or academic databases are unreachable."
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpgradeClick = () => {
    if (!state.isLoggedIn) {
      setState(p => ({ ...p, view: 'auth' }));
    } else {
      setState(p => ({ ...p, view: 'pricing' }));
    }
  };

  const handleLogin = () => {
    setState(p => ({ ...p, isLoggedIn: true, view: 'pricing' }));
  };

  const handlePaymentConfirm = () => {
    setState(p => ({ ...p, userTier: UserTier.PRO, view: 'input' }));
    alert("Pro Access Activated successfully!");
  };

  const downloadPDFReport = () => {
    if (!state.results) return;
    
    const doc = new jsPDF();
    const results = state.results;
    
    doc.setFontSize(22);
    doc.text("VeriCite Academic Verification Report", 20, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Executive Summary", 20, 45);
    doc.setFontSize(10);
    doc.text(`Total Citations Audited: ${results.summary.total}`, 25, 55);
    doc.text(`Verified as Confirmed: ${results.summary.verified}`, 25, 60);
    doc.text(`Likely Fabricated: ${results.summary.hallucinated}`, 25, 65);
    doc.text(`Unverifiable/Partial: ${results.summary.unverified}`, 25, 70);

    let y = 85;
    doc.setFontSize(14);
    doc.text("Detailed Source Audit", 20, y);
    y += 10;

    results.citations.forEach((c, i) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(`${i + 1}. ${c.parsedMetadata.title || "Untitled Fragment"}`, 20, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Status: ${c.status}`, 20, y);
      y += 5;
      doc.text(`Original Content: "${c.rawText.substring(0, 100)}..."`, 20, y);
      y += 5;
      doc.text(`Analysis: ${c.explanation.substring(0, 150)}...`, 20, y);
      y += 10;
    });

    if (results.multiStyleBib) {
        doc.addPage();
        y = 20;
        doc.setFontSize(16);
        doc.text("Verified References - Bibliography", 20, y);
        y += 15;
        
        ['apa', 'mla', 'chicago', 'ieee'].forEach(style => {
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.text(`${style.toUpperCase()} Style`, 20, y);
            y += 7;
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            const text = results.multiStyleBib![style as keyof typeof results.multiStyleBib];
            const splitText = doc.splitTextToSize(text, 170);
            doc.text(splitText, 20, y);
            y += (splitText.length * 4) + 10;
        });
    }

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("VeriCite Academic may produce errors. Users are strongly advised to independently verify critical academic information.", 20, 285);
    
    doc.save(`VeriCite_Audit_Report_${Date.now()}.pdf`);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderStatusBadge = (citation: any) => {
    switch (citation.status) {
      case CitationStatus.VERIFIED:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800"><CheckCircle className="w-3 h-3 mr-1" /> Confirmed</span>;
      case CitationStatus.HALLUCINATION:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800"><XCircle className="w-3 h-3 mr-1" /> Likely Fabricated</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800"><Search className="w-3 h-3 mr-1" /> Unverifiable</span>;
    }
  };

  return (
    <Layout activeView={state.view} onViewChange={(v) => setState(p => ({ ...p, view: v }))} isLoggedIn={state.isLoggedIn} userTier={state.userTier}>
      
      {state.view === 'input' && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative">
            <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 text-slate-800">
              <FileText className="text-blue-600 w-6 h-6" />
              Hardened Citation Audit
            </h2>
            <p className="text-slate-500 mb-6 text-sm">Submit your manuscript text for cross-referencing against global scholarly metadata.</p>
            
            <textarea
              className="w-full h-80 p-5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-slate-700 bg-slate-50 mono text-sm leading-relaxed"
              placeholder="Paste manuscript text or citations here..."
              value={state.inputText}
              onChange={(e) => setState(p => ({ ...p, inputText: e.target.value }))}
            />
            
            <div className="mt-6 flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleUpgradeClick}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-all bg-white text-slate-600 border-slate-300 hover:border-blue-500`}
                >
                  <Upload className="w-4 h-4" />
                  Upload File (PRO)
                  {state.userTier === UserTier.FREE && <Lock className="w-3 h-3 ml-1" />}
                </button>
              </div>
              
              <button
                onClick={handleProcess}
                disabled={isProcessing || !state.inputText.trim()}
                className="gradient-bg text-white px-10 py-3.5 rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Multi-Pass Audit in Progress...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Run High-Precision Verification
                  </>
                )}
              </button>
            </div>
          </div>

          {state.analysesRemaining <= 3 && state.userTier === UserTier.FREE && (
             <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex justify-between items-center">
                <p className="text-sm text-blue-700 font-medium">You have {state.analysesRemaining} free analyses remaining.</p>
                <button onClick={handleUpgradeClick} className="text-xs font-bold text-white bg-blue-600 px-4 py-2 rounded-lg">Upgrade to Pro</button>
             </div>
          )}

          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{state.error}</p>
            </div>
          )}
        </div>
      )}

      {state.view === 'results' && state.results && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold mb-6 text-slate-800">Verification Overview</h3>
              <div className="h-56 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: 'Confirmed', val: state.results.summary.verified, color: '#10b981' },
                    { name: 'Fabricated', val: state.results.summary.hallucinated, color: '#f43f5e' },
                    { name: 'Unknown', val: state.results.summary.unverified, color: '#94a3b8' }
                  ]} layout="vertical" margin={{ left: -10, right: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" fontSize={11} width={80} />
                    <Tooltip />
                    <Bar dataKey="val" radius={[0, 4, 4, 0]}>
                      {[0, 1, 2].map((_, index) => (
                        <Cell key={`cell-${index}`} fill={['#10b981', '#f43f5e', '#94a3b8'][index]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <button 
                onClick={downloadPDFReport}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all text-sm"
              >
                <Download className="w-4 h-4" />
                Download PDF Report
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
                <h3 className="text-sm font-bold text-slate-600">Verification Report</h3>
                <button 
                  onClick={() => setState(p => ({ ...p, view: 'input' }))}
                  className="text-xs font-bold text-blue-600 hover:underline"
                >
                  Run New Analysis
                </button>
              </div>

              {state.results.citations.map(citation => (
                <div key={citation.id} className={`p-6 rounded-2xl bg-white border shadow-sm ${
                  citation.status === CitationStatus.VERIFIED ? 'border-emerald-100' :
                  citation.status === CitationStatus.HALLUCINATION ? 'border-rose-200 bg-rose-50/10' :
                  'border-slate-200'
                }`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1 max-w-[70%]">
                      <div className="font-bold text-slate-800 leading-tight text-sm">
                        {citation.parsedMetadata.title || "No Identifiable Title"}
                      </div>
                      <div className="text-[10px] font-medium text-slate-500">
                        {citation.parsedMetadata.authors?.join(', ') || "Unknown Authors"} • {citation.parsedMetadata.year || "N/A"}
                      </div>
                    </div>
                    {renderStatusBadge(citation)}
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 text-[11px] text-slate-600 italic leading-relaxed">
                    &ldquo;{citation.rawText}&rdquo;
                  </div>

                  <div className="flex flex-col gap-2 p-3 bg-white rounded-lg border border-slate-100 text-[11px] text-slate-600">
                    <div className="font-bold text-slate-400 text-[9px] uppercase tracking-wider">Academic Audit Log</div>
                    <div className="whitespace-pre-line leading-relaxed">{citation.explanation}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Multi-Citation Style Section */}
            {state.results.multiStyleBib && (
              <div className="bg-white p-8 rounded-2xl border border-blue-100 shadow-sm space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                    <ShieldAlert className="w-5 h-5 text-blue-500" />
                    <h3 className="text-lg font-bold text-slate-800">Verified References – Citation Formats</h3>
                </div>
                
                <div className="space-y-8">
                    {Object.entries(state.results.multiStyleBib).map(([style, text]) => (
                        <div key={style} className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black uppercase tracking-widest text-slate-400">{style === 'apa' ? 'APA 7' : style.toUpperCase()}</span>
                                <button 
                                    onClick={() => copyToClipboard(text, style)}
                                    className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-md hover:bg-blue-100"
                                >
                                    {copiedId === style ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    {copiedId === style ? 'Copied' : 'Copy'}
                                </button>
                            </div>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-700 font-medium leading-relaxed mono">
                                {text}
                            </div>
                        </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {state.view === 'auth' && (
        <div className="max-w-md mx-auto py-20 animate-in fade-in zoom-in-95">
          <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-xl space-y-6">
             <div className="text-center">
                <h2 className="text-2xl font-bold">Welcome Back</h2>
                <p className="text-sm text-slate-500 mt-2">Sign in to manage your VeriCite Pro account.</p>
             </div>
             <div className="space-y-4">
                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase">Email Address</label>
                   <input type="email" placeholder="dr.smith@university.edu" className="w-full mt-1 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                   <label className="text-xs font-bold text-slate-400 uppercase">Password</label>
                   <input type="password" placeholder="••••••••" className="w-full mt-1 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <button onClick={handleLogin} className="w-full py-4 gradient-bg text-white font-bold rounded-2xl shadow-lg">Sign In</button>
             </div>
             <div className="text-center text-xs text-slate-400 pt-4 border-t">
                Don't have an account? <span className="text-blue-600 font-bold cursor-pointer">Register here</span>
             </div>
          </div>
        </div>
      )}

      {state.view === 'pricing' && (
        <div className="max-w-4xl mx-auto py-12 animate-in fade-in">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-black text-slate-900 mb-4">Choose Your Plan</h2>
            <p className="text-slate-500 max-w-lg mx-auto leading-relaxed">Unlock advanced academic verification and structured reporting.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-sm opacity-60">
              <h3 className="text-xl font-bold mb-2">Academic Free</h3>
              <div className="text-3xl font-black mb-6">$0 <span className="text-sm font-normal text-slate-400">/ forever</span></div>
              <ul className="space-y-4 mb-10 text-sm text-slate-600">
                <li className="flex items-center gap-3"><CheckCircle className="w-5 h-5 text-emerald-500" /> 10 Analyses per month</li>
                <li className="flex items-center gap-3"><CheckCircle className="w-5 h-5 text-emerald-500" /> Text Paste only</li>
                <li className="flex items-center gap-3 text-slate-300"><XCircle className="w-5 h-5" /> Export PDF Reports</li>
                <li className="flex items-center gap-3 text-slate-300"><XCircle className="w-5 h-5" /> Batch File Processing</li>
              </ul>
              <div className="text-center text-slate-400 font-bold py-4">Current Plan</div>
            </div>

            <div className="gradient-bg p-10 rounded-3xl text-white shadow-2xl relative overflow-hidden border-4 border-blue-500/20">
              <div className="absolute top-6 right-6 bg-amber-400 text-amber-950 text-[10px] font-black px-3 py-1 rounded-full uppercase">Best Value</div>
              <h3 className="text-xl font-bold mb-2">Academic Pro</h3>
              <div className="text-4xl font-black mb-6">$14.99 <span className="text-sm font-normal text-blue-200">/ month</span></div>
              <ul className="space-y-4 mb-10 text-sm text-blue-50">
                <li className="flex items-center gap-3"><CheckCircle className="w-5 h-5 text-blue-300" /> Unlimited Citation Audits</li>
                <li className="flex items-center gap-3"><CheckCircle className="w-5 h-5 text-blue-300" /> PDF & DOCX File Uploads</li>
                <li className="flex items-center gap-3"><CheckCircle className="w-5 h-5 text-blue-300" /> Professional PDF Reports</li>
                <li className="flex items-center gap-3"><CheckCircle className="w-5 h-5 text-blue-300" /> Multiple Citation Styles</li>
                <li className="flex items-center gap-3"><CheckCircle className="w-5 h-5 text-blue-300" /> Priority Academic Engine</li>
              </ul>
              <button 
                onClick={() => setState(p => ({ ...p, view: 'payment' }))}
                className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}

      {state.view === 'payment' && (
        <div className="max-w-md mx-auto py-20">
          <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-2xl space-y-8">
             <div className="flex items-center gap-3 border-b pb-4">
                <CreditCard className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold">Secure Checkout</h2>
             </div>
             
             <div className="space-y-4">
                <div className="flex justify-between text-sm">
                   <span className="text-slate-500">VeriCite Pro (Monthly)</span>
                   <span className="font-bold">$14.99</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t pt-4">
                   <span>Total Due Today</span>
                   <span>$14.99</span>
                </div>
             </div>

             <div className="space-y-4 pt-4">
                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                   By confirming payment, you authorize VeriCite Academic to charge your card $14.99 monthly until cancelled. 
                </p>
                <button 
                    onClick={handlePaymentConfirm}
                    className="w-full py-4 gradient-bg text-white font-bold rounded-2xl shadow-lg flex items-center justify-center gap-2"
                >
                    Confirm & Activate Pro
                </button>
                <button onClick={() => setState(p => ({ ...p, view: 'pricing' }))} className="w-full text-xs text-slate-400 font-bold">Cancel</button>
             </div>
          </div>
        </div>
      )}

      {state.view === 'spec' && <ArchitectureSpec />}
    </Layout>
  );
};

export default App;
