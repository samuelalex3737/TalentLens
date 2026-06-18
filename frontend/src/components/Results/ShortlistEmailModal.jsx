import React, { useState, useEffect } from 'react';
import { generateShortlistEmail } from '../../services/api';

export default function ShortlistEmailModal({ sessionId, onClose }) {
  const [topN, setTopN] = useState(3);
  const [emailData, setEmailData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const generate = async () => {
    setLoading(true);
    try {
      const data = await generateShortlistEmail(sessionId, topN);
      setEmailData(data);
      setDisabled(true);
      setTimeout(() => setDisabled(false), 5000);
    } catch (err) {
      console.error('Email generation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${emailData.subject}\n\n${emailData.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMailto = () => {
    const mailto = `mailto:?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`;
    window.open(mailto);
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 pt-24">
      <div onClick={(e) => e.stopPropagation()} className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6 email-modal">
        
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-white">Generate Shortlist Email</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>

        {!emailData ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/60 block mb-2">Include top candidates</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onClick={() => setTopN(n)}
                    className={`w-10 h-10 rounded-xl border text-sm font-medium transition-colors email-num-btn ${topN === n 
                        ? 'bg-purple-600 border-purple-500 text-white email-num-selected'
                        : 'border-white/20 text-white/50 hover:border-white/40'
                      }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={generate}
              disabled={loading || disabled}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors email-generate-btn"
            >
              {loading ? 'Generating...' : 'Generate Email'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {emailData.candidate_count < topN && (
              <p className="text-xs text-yellow-400">Showing top {emailData.candidate_count} of {emailData.candidate_count} candidates.</p>
            )}
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-xs text-white/40 mb-1">Subject</p>
              <p className="text-sm text-white font-medium">{emailData.subject}</p>
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-xs text-white/40 mb-2">Body</p>
              <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                {emailData.body}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCopy} className="flex-1 border border-white/20 hover:border-white/40 text-white/70 hover:text-white py-2.5 rounded-xl text-sm transition-colors">
                {copied ? '✓ Copied' : 'Copy to Clipboard'}
              </button>
              <button onClick={handleMailto} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2.5 rounded-xl text-sm transition-colors email-generate-btn">
                Open in Mail
              </button>
            </div>
            <button onClick={() => setEmailData(null)} className="w-full text-white/30 hover:text-white/50 text-sm py-2 transition-colors">
              ← Regenerate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
