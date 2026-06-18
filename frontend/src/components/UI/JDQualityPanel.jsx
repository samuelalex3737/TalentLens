import React, { useState } from 'react';
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react';

export default function JDQualityPanel({ qualityData, loading, previousScore }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (loading) return (
    <div className="mt-3 p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
      <div className="flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        Analyzing job description...
      </div>
    </div>
  );

  if (!qualityData) return null;

  const gradeColor = {
    A: 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-500/20',
    B: 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/20',
    C: 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-500/20',
    D: 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-500/20',
  };

  const scoreDelta = previousScore !== null && previousScore !== undefined
    ? qualityData.quality_score - previousScore
    : null;

  return (
    <div className="jda-container mt-3 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden bg-white dark:bg-transparent shadow-sm dark:shadow-none transition-all duration-200">
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer select-none transition-colors ${isExpanded ? 'border-b border-gray-200 dark:border-white/10' : ''}`}
      >
        <div className="flex items-center gap-2">
          <span className="jda-header-text text-xs font-medium text-gray-500 dark:text-white/60">JD Quality Analysis</span>
          {isExpanded ? <ChevronUp className="jda-chevron w-4 h-4 text-gray-400" /> : <ChevronDown className="jda-chevron w-4 h-4 text-gray-400" />}
        </div>
        <div className="flex items-center gap-2">
          <span className="jda-score text-sm font-semibold text-gray-900 dark:text-white">{qualityData.quality_score}/100</span>
          {scoreDelta !== null && scoreDelta !== 0 && (
            <span className={`text-xs font-medium ${scoreDelta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {scoreDelta > 0 ? `▲ +${scoreDelta}` : `▼ ${scoreDelta}`}
            </span>
          )}
          {scoreDelta === 0 && (
            <span className="text-xs font-medium text-gray-400">→ No change</span>
          )}
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${gradeColor[qualityData.grade] || gradeColor.D}`}>
            Grade {qualityData.grade}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-white/10">
          <div className="px-4 py-3 space-y-4">
            {qualityData.issues && qualityData.issues.length > 0 ? (
              qualityData.issues.map((issue, i) => (
                <div key={i} className="text-xs">
                  <div className="jda-criterion-label flex items-center gap-1.5 font-bold text-amber-600 dark:text-yellow-400 mb-1">
                    <span className="uppercase">[{issue.type} — {issue.severity}/20]</span>
                  </div>
                  <div className="pl-1 space-y-1.5">
                    <p className="jda-quote text-gray-500 dark:text-white/50 italic leading-relaxed">"{issue.phrase}"</p>
                    <p className="jda-suggestion text-gray-700 dark:text-white/80"><span className="jda-suggestion-arrow text-blue-500 dark:text-blue-400 font-semibold mr-1">→</span>{issue.suggestion}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-green-600 dark:text-green-400 font-medium pl-1">
                ✨ Perfect score! No improvements needed.
              </div>
            )}
          </div>

          {qualityData.strengths && qualityData.strengths.length > 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {qualityData.strengths.map((s, i) => (
                <span key={i} className="text-xs bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-md border border-green-200 dark:border-transparent font-medium">
                  ✓ {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
