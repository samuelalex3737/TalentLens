import { useState, useCallback, useEffect } from 'react';
import { analyzeResumes } from '../services/api';
import toast from 'react-hot-toast';

/**
 * Custom hook to manage resume analysis state and lifecycle.
 * Provides loading states, progress tracking, results, and error handling.
 */
export default function useAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [results, setResults] = useState(() => {
    try {
      const saved = sessionStorage.getItem('tl_results');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [error, setError] = useState(null);

  // Save results to sessionStorage when they change
  useEffect(() => {
    if (results) {
      sessionStorage.setItem('tl_results', JSON.stringify(results));
    }
  }, [results]);

  const startAnalysis = useCallback(async (jobDescription, jobTitle, resumeFiles) => {
    if (!jobDescription.trim()) {
      toast.error('Please enter a job description');
      return null;
    }
    if (!resumeFiles.length) {
      toast.error('Please upload at least one resume');
      return null;
    }

    setIsAnalyzing(true);
    setError(null);
    setResults(null);
    setProgress({ current: 0, total: resumeFiles.length, message: 'Uploading resumes...' });

    // Simulate progress while backend processes
    const totalFiles = resumeFiles.length;
    let progressInterval;

    try {
      // Start simulated progress bar
      let currentStep = 0;
      progressInterval = setInterval(() => {
        currentStep = Math.min(currentStep + 1, totalFiles);
        setProgress({
          current: currentStep,
          total: totalFiles,
          message: currentStep < totalFiles
            ? `Analyzing Resume ${currentStep} of ${totalFiles}...`
            : 'Finalizing rankings...',
        });
      }, 2000); // ~2s per resume matches backend delay

      const data = await analyzeResumes(jobDescription, jobTitle, resumeFiles);

      clearInterval(progressInterval);
      setProgress({ current: resumeFiles.length, total: resumeFiles.length, message: 'Complete!' });
      setResults(data);
      
      // Rich toast notification with top candidate info
      const topCandidate = data.candidates?.[0];
      if (topCandidate) {
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-gray-900 border border-emerald-500/30 shadow-xl shadow-emerald-500/10 rounded-2xl p-4`}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/15 shrink-0">
                <span className="text-lg">🏆</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">Analysis Complete!</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {data.total_candidates} {data.total_candidates === 1 ? 'candidate' : 'candidates'} ranked
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-emerald-400 font-medium">Top Candidate:</span>
                  <span className="text-xs text-white font-bold truncate">{topCandidate.candidate_name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">
                    {topCandidate.final_score?.toFixed(1)}
                  </span>
                </div>
              </div>
              <button onClick={() => toast.dismiss(t.id)} className="text-gray-600 hover:text-white text-xs">✕</button>
            </div>
          </div>
        ), { duration: 5000 });
      } else {
        toast.success(`Analysis complete! ${data.total_candidates} candidates ranked.`);
      }
      return data;
    } catch (err) {
      clearInterval(progressInterval);
      const message = err.response?.data?.detail || err.message || 'Analysis failed';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
    setProgress({ current: 0, total: 0, message: '' });
    sessionStorage.removeItem('tl_results');
  }, []);

  return { isAnalyzing, progress, results, error, startAnalysis, clearResults };
}
