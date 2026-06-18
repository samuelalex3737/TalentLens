import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Mail, ArrowLeft } from 'lucide-react';
import SessionHistory from '../components/Dashboard/SessionHistory';
import StatsBar from '../components/Dashboard/StatsBar';
import RankingTable from '../components/Results/RankingTable';
import ScoreComparisonChart from '../components/Results/ScoreComparisonChart';
import ScoreDistributionChart from '../components/Results/ScoreDistributionChart';
import ExportButton from '../components/UI/ExportButton';
import CompareModal from '../components/Results/CompareModal';
import ShortlistEmailModal from '../components/Results/ShortlistEmailModal';

/**
 * Helper to compute summary from loaded candidates client-side.
 */
function computeSummary(candidates) {
  if (!candidates || candidates.length === 0) return null;
  const scores = candidates.map(c => c.final_score || 0);
  const recs = candidates.map(c => c.hiring_recommendation || '');
  return {
    total: candidates.length,
    avg_score: +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
    max_score: +Math.max(...scores).toFixed(2),
    min_score: +Math.min(...scores).toFixed(2),
    conflict_count: candidates.filter(c => c.score_conflict).length,
    strong_matches: recs.filter(r => r === 'Strong Match').length,
    good_matches: recs.filter(r => r === 'Good Match').length,
    partial_matches: recs.filter(r => r === 'Partial Match').length,
    poor_matches: recs.filter(r => r === 'Poor Match').length,
  };
}

export default function HistoryPage() {
  const [loadedSession, setLoadedSession] = useState(null);
  const [aiWeight, setAiWeight] = useState(65);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

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

  // Recalculate candidate scores when slider moves
  const displayedCandidates = useMemo(() => {
    if (!loadedSession?.candidates) return [];
    return [...loadedSession.candidates].map(c => {
      const semantic = c.semantic_score || 0;
      const tfidf = c.tfidf_score || 0;
      const normalizedTfidf = Math.min(100, tfidf * 6.67);
      const weight = aiWeight / 100;
      const finalScore = (normalizedTfidf * (1 - weight)) + (semantic * weight);
      return { ...c, final_score: finalScore };
    }).sort((a, b) => {
      const diff = b.final_score - a.final_score;
      // When scores are very close, preserve original rank order from the backend
      if (Math.abs(diff) < 0.5) return (a.final_rank || 0) - (b.final_rank || 0);
      return diff;
    });
  }, [loadedSession, aiWeight]);

  const summary = displayedCandidates.length > 0 ? computeSummary(displayedCandidates) : null;

  return (
    <div className="relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 relative z-10">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-blue-400" />
            Analysis History
          </h1>
          <p className="text-sm text-gray-500 mt-1">Review past analysis sessions and results</p>
        </motion.div>

        {!loadedSession ? (
          <SessionHistory onLoadSession={setLoadedSession} />
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => { setLoadedSession(null); setSelectedIds(new Set()); }}
                  className="p-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                  title="Back to History"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h2 className="text-xl font-bold text-white">{loadedSession.job_title}</h2>
                  <p className="text-sm text-gray-500">
                    {loadedSession.total_candidates} {loadedSession.total_candidates === 1 ? 'candidate' : 'candidates'} •{' '}
                    {new Date(loadedSession.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* AI Weight Slider */}
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
                <ExportButton sessionId={loadedSession.id} />
              </div>
            </div>

            {summary && <StatsBar summary={summary} />}
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
            {emailModalOpen && <ShortlistEmailModal sessionId={loadedSession.id} onClose={() => setEmailModalOpen(false)} />}
          </motion.div>
        )}
      </div>
    </div>
  );
}
