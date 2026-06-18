import React, { useEffect } from 'react';

export const normalize_tfidf = (raw) => {
  if (!raw) return 0;
  return Number(Math.min(100, raw * 6.67).toFixed(1));
};

export default function CompareModal({ candidates, onClose }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const scoreColor = (score) => {
    if (score >= 75) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm overflow-y-auto" data-force-dark>
      <div onClick={(e) => e.stopPropagation()} className="min-h-screen p-6 pt-24 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Candidate Comparison</h2>
          <button onClick={onClose} className="text-white hover:text-gray-300">✕</button>
        </div>

        <div className={`grid gap-4 ${candidates.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
          {candidates.map((c) => (
            <div key={c.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-semibold text-white">{c.candidate_name}</span>
                </div>
                <span className={`text-3xl font-bold ${scoreColor(c.final_score)}`}>
                  {c.final_score?.toFixed(1)}
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs text-white/50 mb-1">
                    <span>TF-IDF</span>
                    <span>{normalize_tfidf(c.tfidf_score)}</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full">
                    <div className="h-full bg-blue-400 rounded-full"
                         style={{width: `${normalize_tfidf(c.tfidf_score)}%`}}/>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-white/50 mb-1">
                    <span>AI Semantic</span>
                    <span>{c.semantic_score}</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full">
                    <div className="h-full bg-purple-400 rounded-full"
                         style={{width: `${c.semantic_score}%`}}/>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-green-400 mb-2">
                  Matched ({(c.matched_skills || []).length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {(c.matched_skills || []).map(s => (
                    <span key={s} className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-red-400 mb-2">
                  Missing ({(c.missing_skills || []).length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {(c.missing_skills || []).map(s => (
                    <span key={s} className="text-xs bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full">{s}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-white/50 mb-1">AI Summary</p>
                <p className="text-xs text-white/70 leading-relaxed">{c.candidate_summary}</p>
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
