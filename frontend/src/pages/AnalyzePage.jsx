import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanEye, RotateCcw, Mail } from 'lucide-react';
import JobDescriptionInput from '../components/Upload/JobDescriptionInput';
import ResumeDropzone from '../components/Upload/ResumeDropzone';
import ExportButton from '../components/UI/ExportButton';
import StatsBar from '../components/Dashboard/StatsBar';
import RankingTable from '../components/Results/RankingTable';
import ScoreComparisonChart from '../components/Results/ScoreComparisonChart';
import ScoreDistributionChart from '../components/Results/ScoreDistributionChart';
import useAnalysis from '../hooks/useAnalysis';
import JDQualityPanel from '../components/UI/JDQualityPanel';
import CompareModal from '../components/Results/CompareModal';
import ShortlistEmailModal from '../components/Results/ShortlistEmailModal';
import { analyzeJD } from '../services/api';

export default function AnalyzePage() {
  const [jobTitle, setJobTitle] = useState(() => sessionStorage.getItem('tl_jd_title') || '');
  const [jobDescription, setJobDescription] = useState(() => sessionStorage.getItem('tl_jd_text') || '');
  const [resumeFiles, setResumeFiles] = useState([]);
  const { isAnalyzing, progress, results, error, startAnalysis, clearResults } = useAnalysis();

  // Session Persistence
  useEffect(() => {
    sessionStorage.setItem('tl_jd_title', jobTitle);
  }, [jobTitle]);

  useEffect(() => {
    sessionStorage.setItem('tl_jd_text', jobDescription);
  }, [jobDescription]);

  useEffect(() => {
    if (resumeFiles.length > 0) {
      sessionStorage.setItem('tl_file_names', JSON.stringify(resumeFiles.map(f => f.name)));
    }
  }, [resumeFiles]);

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [jdQuality, setJdQuality] = useState(null);
  const [jdAnalyzing, setJdAnalyzing] = useState(false);
  const [previousJdScore, setPreviousJdScore] = useState(null);

  // Resume Analysis Loading Sequence
  const loadingMessages = [
    "Reading uploaded resumes...",
    "Analyzing candidate experience...",
    "Matching skills to job description...",
    "Ranking candidates...",
    "Generating insights..."
  ];
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  useEffect(() => {
    if (isAnalyzing) {
      const interval = setInterval(() => {
        setLoadingMessageIndex(prev => Math.min(prev + 1, loadingMessages.length - 1));
      }, 2000);
      return () => clearInterval(interval);
    } else {
      setLoadingMessageIndex(0);
    }
  }, [isAnalyzing]);

  useEffect(() => {
    if (jobDescription.length < 50) {
      setJdQuality(null);
      setPreviousJdScore(null);
      return;
    }
    const timer = setTimeout(async () => {
      setJdAnalyzing(true);
      try {
        const result = await analyzeJD({ job_title: jobTitle || 'Untitled', job_description: jobDescription });
        setPreviousJdScore(prev => jdQuality ? jdQuality.quality_score : prev);
        setJdQuality(result);
      } catch (err) {
        console.error(err);
      } finally {
        setJdAnalyzing(false);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [jobDescription, jobTitle]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (next.size >= 3) return prev;
        next.add(id);
      }
      return next;
    });
  };

  async function handleAnalyze() {
    await startAnalysis(jobDescription, jobTitle, resumeFiles);
  }

  function handleReset() {
    setJobTitle('');
    setJobDescription('');
    setResumeFiles([]);
    setSelectedIds(new Set());
    setJdQuality(null);
    clearResults();
    sessionStorage.removeItem('tl_jd_title');
    sessionStorage.removeItem('tl_jd_text');
    sessionStorage.removeItem('tl_file_names');
  }

  const [aiWeight, setAiWeight] = useState(65);

  const displayedCandidates = results ? [...results.candidates].map(c => {
    const semantic = c.semantic_score || 0;
    const tfidf = c.tfidf_score || 0;
    // Normalize tfidf to a 0-100 scale matching the backend (6.67x)
    const normalizedTfidf = Math.min(100, tfidf * 6.67);
    const weight = aiWeight / 100;
    const finalScore = (normalizedTfidf * (1 - weight)) + (semantic * weight);
    return { ...c, final_score: finalScore };
  }).sort((a, b) => b.final_score - a.final_score) : [];

  return (
    <div className="relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 relative z-10">
        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-white">Analyze Resumes</h1>
          <p className="text-sm text-gray-500 mt-1">Upload resumes and a job description to get AI-powered rankings</p>
        </motion.div>

        {/* Input Section (hidden once results show) */}
        {!results && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <JobDescriptionInput
                  jobTitle={jobTitle} setJobTitle={setJobTitle}
                  jobDescription={jobDescription} setJobDescription={setJobDescription}
                />
                <JDQualityPanel qualityData={jdQuality} loading={jdAnalyzing} previousScore={previousJdScore} />
              </div>
              <ResumeDropzone files={resumeFiles} setFiles={setResumeFiles} />
            </div>

            {/* Progress or Analyze Button */}
            {isAnalyzing ? (
              <div className="w-full bg-slate-900/50 rounded-xl p-6 border border-indigo-500/20 text-center analyze-progress-card">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-indigo-400 font-medium analyze-progress-text">Analyzing Candidates...</span>
                  <span className="text-gray-400 analyze-progress-subtext">
                    {Math.round(((loadingMessageIndex + 1) / loadingMessages.length) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-4 relative analyze-progress-track">
                  <motion.div 
                    className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full analyze-progress-bar"
                    initial={{ width: "0%" }}
                    animate={{ width: `${((loadingMessageIndex + 1) / loadingMessages.length) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" />
                </div>
                <div className="text-sm text-gray-400 animate-pulse analyze-progress-subtext">
                  {loadingMessages[loadingMessageIndex]}
                </div>
              </div>
            ) : (
              <motion.button
                id="analyze-button"
                onClick={handleAnalyze}
                disabled={!jobDescription.trim() || resumeFiles.length === 0}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full py-4 rounded-xl text-base font-semibold flex items-center justify-center gap-2 transition-all duration-200 analyze-submit-btn
                  ${(!jobDescription.trim() || resumeFiles.length === 0)
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/20'
                  }`}
              >
                <ScanEye className="w-5 h-5" />
                {!jobDescription.trim()
                  ? 'Please Paste a Job Description'
                  : resumeFiles.length === 0
                  ? 'Please Upload a Resume'
                  : `Analyze ${resumeFiles.length} Resume${resumeFiles.length !== 1 ? 's' : ''}`
                }
              </motion.button>
            )}

            {/* Error State */}
            {error && (
              <div className="glass-card p-4 border-red-500/20 bg-red-500/5 text-center">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
          </>
        )}

        {/* Results Section */}
        {results && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">{results.job_title}</h2>
                <p className="text-sm text-gray-500">{results.total_candidates} {results.total_candidates === 1 ? 'candidate' : 'candidates'} ranked</p>
              </div>
              
              <div className="flex items-center gap-4 px-4 py-2 rounded-xl relative group cursor-help transition-all duration-300 w-full md:w-auto ai-slider-container">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium">Keywords</span>
                  <input 
                    type="range" 
                    min="0" max="100" 
                    value={aiWeight} 
                    onChange={(e) => setAiWeight(Number(e.target.value))}
                    className="w-full sm:w-32 accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-xs text-indigo-400 font-medium">AI Semantic</span>
                  <span className="text-xs font-bold text-white ml-2 bg-indigo-500/20 px-2 py-1 rounded">{aiWeight}% AI</span>
                </div>
                
                {/* Tooltip */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 p-3 bg-gray-900 border border-indigo-500/30 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 text-xs text-gray-300 leading-relaxed pointer-events-none">
                  <p className="mb-2"><strong className="text-white">What does this do?</strong></p>
                  <ul className="space-y-1.5 list-disc pl-3">
                    <li><strong>0% AI:</strong> Strict ATS mode. Ranks purely on exact keyword matches.</li>
                    <li><strong>65% AI:</strong> The sweet spot. Demands some keywords but heavily leverages AI intuition.</li>
                    <li><strong>100% AI:</strong> Ranks based on the AI's contextual understanding of transferable skills, ignoring exact keywords.</li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEmailModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-white/10 text-gray-300 hover:bg-white/5 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  Shortlist Email
                </button>
                <ExportButton sessionId={results.session_id} />
                <button
                  onClick={() => setResetModalOpen(true)}
                  className="inline-flex items-center gap-2 font-medium transition-all hover:opacity-80"
                  style={{
                    border: '1px solid #6366f1',
                    color: '#6366f1',
                    background: 'transparent',
                    padding: '8px 16px',
                    borderRadius: '8px'
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                  New Analysis
                </button>
              </div>
            </div>

            <StatsBar summary={results.summary} />
            <ScoreDistributionChart candidates={displayedCandidates} />
            <RankingTable candidates={displayedCandidates} selectedIds={selectedIds} onToggleSelect={toggleSelect} aiWeight={aiWeight} />
            <ScoreComparisonChart candidates={displayedCandidates} semanticWeight={aiWeight / 100} />
            
            <AnimatePresence>
              {selectedIds.size > 0 && (
                <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] sm:w-auto bg-gray-900 border border-white/10 shadow-2xl rounded-2xl px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4 z-40">
                  <span className="text-sm text-white/70">{selectedIds.size}/3 selected</span>
                  <button onClick={() => setCompareOpen(true)} disabled={selectedIds.size < 2} className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                    Compare Candidates
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {compareOpen && <CompareModal candidates={displayedCandidates.filter(c => selectedIds.has(c.id))} onClose={() => setCompareOpen(false)} />}
            {emailModalOpen && <ShortlistEmailModal sessionId={results.session_id} onClose={() => setEmailModalOpen(false)} />}
            
            <AnimatePresence>
              {resetModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full new-analysis-modal"
                    style={{
                      background: 'rgba(15,23,42,0.98)',
                      border: '1px solid rgba(99,102,241,0.3)',
                      borderRadius: '12px',
                      padding: '24px',
                      maxWidth: '400px',
                      margin: '0 auto'
                    }}
                  >
                    <h3 className="text-xl font-bold text-white mb-2 new-analysis-title">Start a new analysis?</h3>
                    <p className="text-gray-400 text-sm mb-6 new-analysis-desc">
                      This will clear your current results, uploaded resumes, and job description. This cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setResetModalOpen(false)}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-white/5 border border-transparent new-analysis-cancel"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          handleReset();
                          setResetModalOpen(false);
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 new-analysis-confirm"
                      >
                        Start Fresh
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}
