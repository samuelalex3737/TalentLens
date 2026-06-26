import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle,
  ArrowRightLeft, Link, Code, Globe, Mail, Phone,
  GraduationCap, Briefcase, Award, Languages,
} from 'lucide-react';
import ScoreBadge from '../UI/ScoreBadge';
import ExperienceTimeline from './ExperienceTimeline';
import CandidateNotes from './CandidateNotes';
import { normalize_tfidf } from './CompareModal';
import api from '../../services/api';
import { createPortal } from 'react-dom';

const fairnessTooltips = {
  low: '⚖️ Fairness Check: Low Risk\nTF-IDF and AI scores are closely aligned.\nThis result is consistent and reliable.',
  medium: '⚖️ Fairness Check: Medium Risk\nModerate gap between TF-IDF keyword score and AI semantic score. Review this candidate manually to confirm the ranking reflects their true fit.',
  high: '⚖️ Fairness Check: High Risk\nLarge gap between TF-IDF and AI scores detected. One score may be inflated. Manual review strongly recommended before making a hiring decision.',
};

const BiasBadge = ({ risk, explanation }) => {
  const [tooltipPos, setTooltipPos] = useState(null);

  if (risk === 'low' || !risk) return null;
  const styles = {
    medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  };

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      top: rect.top - 10,
      left: rect.left + rect.width / 2,
    });
  };

  const handleMouseLeave = () => setTooltipPos(null);

  return (
    <>
      <div 
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs cursor-help ${styles[risk] || styles.medium}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span>⚖️</span>
        <span>Fairness check: {risk}</span>
      </div>
      {tooltipPos && createPortal(
        <div style={{
          position: 'fixed',
          top: tooltipPos.top,
          left: tooltipPos.left,
          transform: 'translate(-50%, -100%)',
          background: 'rgba(15,23,42,0.95)',
          border: '1px solid rgba(234,179,8,0.3)',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '12px',
          color: '#e2e8f0',
          maxWidth: '240px',
          zIndex: 9999,
          pointerEvents: 'none',
          whiteSpace: 'pre-line'
        }}>
          {fairnessTooltips[risk] || fairnessTooltips.medium}
        </div>,
        document.body
      )}
    </>
  );
};

const ScoreTooltipWrapper = ({ children, aiWeight }) => {
  const [tooltipPos, setTooltipPos] = useState(null);

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      top: rect.top - 10,
      left: rect.left + rect.width / 2,
    });
  };

  const handleMouseLeave = () => setTooltipPos(null);

  return (
    <>
      <div className="cursor-help" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        {children}
      </div>
      {tooltipPos && createPortal(
        <div style={{
          position: 'fixed',
          top: tooltipPos.top,
          left: tooltipPos.left,
          transform: 'translate(-50%, -100%)',
          background: 'rgba(15,23,42,0.95)',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '12px',
          color: '#e2e8f0',
          maxWidth: '220px',
          zIndex: 9999,
          pointerEvents: 'none',
        }}>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Final Score</p>
          <p>{100 - aiWeight}% TF-IDF (keyword match) + {aiWeight}% AI (semantic analysis) = weighted blend out of 100</p>
        </div>,
        document.body
      )}
    </>
  );
};

const RedFlagBadge = ({ flags }) => {
  if (!flags || flags.length === 0) return null;
  return (
    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-xs font-bold text-red-400 mb-1">Potential Red Flags</p>
        <ul className="list-disc pl-4 space-y-0.5">
          {flags.map((f, i) => (
            <li key={i} className="text-xs text-red-300">{f}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const rankStyles = {
  1: { border: 'rgba(251,191,36,0.5)', bg: 'rgba(251,191,36,0.04)', icon: '🥇', glow: '0 0 30px rgba(251,191,36,0.15)' },
  2: { border: 'rgba(192,192,192,0.4)', bg: 'rgba(192,192,192,0.03)', icon: '🥈', glow: 'none' },
  3: { border: 'rgba(217,119,6,0.4)', bg: 'rgba(217,119,6,0.04)', icon: '🥉', glow: 'none' },
};

const recColors = {
  'Strong Match': { bg: 'rgba(16,185,129,0.12)', text: '#10b981', border: 'rgba(16,185,129,0.3)' },
  'Good Match': { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  'Partial Match': { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  'Poor Match': { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
};

export default function CandidateCard({ candidate, index, isSelected, onToggleSelect, aiWeight = 65 }) {
  const [expanded, setExpanded] = useState(false);
  const [questions, setQuestions] = useState(null);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const hasMounted = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => { hasMounted.current = true; }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const rank = index + 1; // Dynamic visual rank based on current array position
  const style = rankStyles[rank] || { border: 'rgba(59,130,246,0.1)', bg: 'transparent', icon: `#${rank}`, glow: 'none' };
  const rec = recColors[candidate.hiring_recommendation] || recColors['Partial Match'];

  const isTopCandidate = rank === 1 && candidate.final_score >= 40;

  const weight = aiWeight / 100;
  const tfidfScore = normalize_tfidf(candidate.tfidf_score);
  const semanticScore = candidate.semantic_score || 0;
  const tfidfContrib = tfidfScore * (1 - weight);
  const aiContrib = semanticScore * weight;

  if (candidate.status === 'invalid_resume') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06, duration: 0.4 }}
        className="glass-card relative overflow-visible p-5 border-amber-500/30 bg-amber-500/5"
      >
        <div className="flex items-start gap-4">
          <div className="text-2xl w-10 text-center shrink-0">
            <span className="text-2xl">⚠️</span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-bold text-base truncate">{candidate.filename}</h4>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-sm font-medium text-amber-400">Invalid Document</span>
            </div>
            <p className="mt-2 text-sm text-gray-400">
              "{candidate.filename}" does not appear to be a resume. Please check the file and re-upload a valid resume PDF.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4 }}
      className="glass-card relative overflow-visible"
      style={{ borderColor: style.border, background: style.bg, boxShadow: style.glow }}
    >
      {/* Confetti burst for top candidate */}
      {isTopCandidate && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              initial={{
                opacity: 1,
                x: '50%',
                y: '50%',
                scale: 0,
              }}
              animate={{
                opacity: [1, 1, 0],
                x: `${50 + (Math.random() - 0.5) * 80}%`,
                y: `${50 + (Math.random() - 0.5) * 100}%`,
                scale: [0, 1.5, 0.8],
              }}
              transition={{
                duration: 1.2 + Math.random() * 0.5,
                delay: 0.3 + i * 0.05,
                ease: 'easeOut',
              }}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                background: ['#fbbf24', '#3b82f6', '#10b981', '#ec4899', '#8b5cf6', '#f59e0b'][i % 6],
              }}
            />
          ))}
        </div>
      )}
      {/* Header Row */}
      <div className="p-5 cursor-pointer flex items-center gap-4" onClick={() => setExpanded(!expanded)}>
        {onToggleSelect && (
          <div className="shrink-0 pt-1" onClick={e => e.stopPropagation()}>
            <input 
              type="checkbox" 
              checked={isSelected || false} 
              onChange={() => onToggleSelect(candidate.id)} 
              className="w-5 h-5 rounded border-white/20 bg-white/5 checked:bg-purple-500 cursor-pointer"
            />
          </div>
        )}
        <div className="text-2xl w-10 text-center shrink-0">
          {typeof style.icon === 'string' && style.icon.startsWith('#')
            ? <span className="text-sm font-bold text-gray-500 bg-white/5 rounded-full w-8 h-8 flex items-center justify-center">{style.icon}</span>
            : <span className="text-2xl">{style.icon}</span>}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-white font-bold text-base truncate">{candidate.candidate_name}</h4>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500 truncate">{candidate.filename}</span>
            {candidate.linkedin && <Link className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
            {candidate.github && <Code className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
            {candidate.certifications?.length > 0 && <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <BiasBadge risk={candidate.bias_risk} explanation={candidate.bias_explanation} />
          <ScoreTooltipWrapper aiWeight={aiWeight}>
            <ScoreBadge score={candidate.final_score} size="lg" />
          </ScoreTooltipWrapper>
          <span className="hidden sm:inline-flex text-xs px-3 py-1 rounded-full font-semibold"
            style={{ background: rec.bg, color: rec.text, border: `1px solid ${rec.border}` }}>
            {candidate.hiring_recommendation}
          </span>
          {candidate.score_conflict && <AlertTriangle className="w-4 h-4 text-amber-400" />}
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </div>

      {/* Score Bars */}
      <div className="px-5 pb-3 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:gap-3 text-xs">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <span className="text-gray-500 w-10 shrink-0">TF-IDF</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${tfidfContrib}%` }}
              transition={hasMounted.current ? { duration: 0.15 } : { duration: 1, delay: index * 0.06 + 0.3 }}
              className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
          </div>
          <span className="text-blue-400 w-10 text-right font-semibold shrink-0">{tfidfContrib.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <span className="text-gray-500 w-10 shrink-0">AI</span>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${aiContrib}%` }}
              transition={hasMounted.current ? { duration: 0.15 } : { duration: 1, delay: index * 0.06 + 0.5 }}
              className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
          </div>
          <span className="text-violet-400 w-10 text-right font-semibold shrink-0">{aiContrib.toFixed(1)}</span>
        </div>
      </div>

      {/* Expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
            className="overflow-hidden">
            <div className="px-5 pb-6 space-y-5 border-t border-white/5 pt-5">

              {/* Contact & Links */}
              <div className="flex flex-wrap gap-3 text-xs">
                {candidate.email && (
                  <a href={`mailto:${candidate.email}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/8 text-blue-400 hover:bg-blue-500/15 transition-colors">
                    <Mail className="w-3.5 h-3.5" />{candidate.email}
                  </a>
                )}
                {candidate.phone && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-gray-400">
                    <Phone className="w-3.5 h-3.5" />{candidate.phone}
                  </span>
                )}
                {candidate.linkedin && (
                  <a href={candidate.linkedin} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-colors">
                    <Link className="w-3.5 h-3.5" />LinkedIn
                  </a>
                )}
                {candidate.github && (
                  <a href={candidate.github} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-500/10 text-gray-300 hover:bg-gray-500/20 transition-colors">
                    <Code className="w-3.5 h-3.5" />GitHub
                  </a>
                )}
                {candidate.portfolio && (
                  <a href={candidate.portfolio} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                    <Globe className="w-3.5 h-3.5" />Portfolio
                  </a>
                )}
              </div>

              {/* AI Summary */}
              <div className="p-4 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)' }}>
                <h5 className="text-sm font-bold text-indigo-300 mb-2">AI Summary</h5>
                <p className="text-sm text-gray-400 leading-relaxed">{candidate.candidate_summary}</p>
              </div>

              {/* Recommended Improvements */}
              {candidate.recommended_improvements?.length > 0 && (
                <div className="p-4 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
                  <h5 className="text-sm font-bold text-amber-400 mb-2">Recommended Improvements</h5>
                  <ul className="space-y-1.5 list-disc pl-4">
                    {candidate.recommended_improvements.map((improvement, i) => (
                      <li key={i} className="text-sm text-amber-200/70">{improvement}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Red Flags */}
              <RedFlagBadge flags={candidate.red_flags} />

              {/* Skills Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <SkillList title="Matched" skills={candidate.matched_skills} icon={<CheckCircle className="w-4 h-4 text-emerald-400" />} color="emerald" />
                <SkillList title="Missing" skills={candidate.missing_skills} icon={<XCircle className="w-4 h-4 text-red-400" />} color="red" />
                <SkillList title="Transferable" skills={candidate.transferable_skills} icon={<ArrowRightLeft className="w-4 h-4 text-amber-400" />} color="amber" />
              </div>

              {/* Education, Experience, Certs, Languages */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {candidate.education?.length > 0 && (
                  <InfoSection icon={<GraduationCap className="w-4 h-4 text-cyan-400" />} title="Education" items={candidate.education} color="cyan" />
                )}
                {candidate.certifications?.length > 0 && (
                  <InfoSection icon={<Award className="w-4 h-4 text-amber-400" />} title="Certifications" items={candidate.certifications} color="amber" />
                )}
                {candidate.projects?.length > 0 && (
                  <InfoSection icon={<Code className="w-4 h-4 text-indigo-400" />} title="Projects" items={candidate.projects.slice(0, 5)} color="indigo" />
                )}
                {candidate.languages?.length > 0 && (
                  <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)' }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Languages className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-emerald-400">Languages</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.languages.map((l, i) => (
                        <span key={i} className="text-xs px-2.5 py-1 rounded-full text-gray-300 bg-emerald-500/10">{l}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Interview Questions Section */}
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-sm font-bold text-indigo-300 exp-questions-title">Targeted Interview Questions</h5>
                  <button
                    onClick={async () => {
                      if (loadingQuestions) return;
                      setLoadingQuestions(true);
                      try {
                        const res = await api.generateInterviewQuestions(candidate.id);
                        setQuestions(res.questions || []);
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setLoadingQuestions(false);
                      }
                    }}
                    disabled={loadingQuestions}
                    className="text-xs px-[18px] py-[8px] font-semibold rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:opacity-90 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 border-none"
                  >
                    {loadingQuestions ? 'Generating...' : (questions ? 'Regenerate Questions' : 'Generate Questions')}
                  </button>
                </div>
                
                {questions && (
                  <div className="space-y-3">
                    {questions.map((q, i) => (
                      <div key={i} className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                        <p className="text-sm text-gray-200 font-medium mb-1"><span className="text-indigo-400 mr-2">Q{i + 1}.</span>{q.question}</p>
                        <p className="text-xs text-gray-500 mb-1"><span className="text-amber-500/70">Why:</span> {q.reason}</p>
                        <p className="text-xs text-gray-400"><span className="text-emerald-500/70">Look for:</span> {q.expected_answer}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Experience Timeline */}
              <ExperienceTimeline workExperience={candidate.experience} />

              {/* Candidate Notes */}
              <CandidateNotes candidateId={candidate.id} initialNotes={candidate.notes} />

              {/* Provider & Conflict */}
              <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-white/5">
                <span>Scored by: {candidate.ai_provider}/{candidate.ai_model}</span>
                {candidate.score_conflict && (
                  <span className="inline-flex items-center gap-1.5 text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5" />Score conflict - review manually
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SkillList({ title, skills, icon, color }) {
  const colors = {
    emerald: { bg: 'rgba(16,185,129,0.05)', border: 'rgba(16,185,129,0.1)', tag: 'rgba(16,185,129,0.12)' },
    red: { bg: 'rgba(239,68,68,0.05)', border: 'rgba(239,68,68,0.1)', tag: 'rgba(239,68,68,0.12)' },
    amber: { bg: 'rgba(245,158,11,0.05)', border: 'rgba(245,158,11,0.1)', tag: 'rgba(245,158,11,0.12)' },
  };
  const c = colors[color];
  return (
    <div className="rounded-xl p-4" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}<span className="text-xs font-bold" style={{ color: color === 'emerald' ? '#10b981' : color === 'red' ? '#ef4444' : '#f59e0b' }}>{title} ({skills?.length || 0})</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {skills?.length > 0 ? skills.map((s, i) => (
          <span key={i} className="text-xs px-2 py-0.5 rounded-full text-gray-300" style={{ background: c.tag }}>{s}</span>
        )) : <span className="text-xs text-gray-600 italic">None detected</span>}
      </div>
    </div>
  );
}

function InfoSection({ icon, title, items, color }) {
  const colorMap = { cyan: 'rgba(6,182,212,', blue: 'rgba(59,130,246,', amber: 'rgba(245,158,11,' };
  const base = colorMap[color] || colorMap.blue;
  return (
    <div className="rounded-xl p-4" style={{ background: `${base}0.05)`, border: `1px solid ${base}0.1)` }}>
      <div className="flex items-center gap-1.5 mb-2">{icon}<span className="text-xs font-bold" style={{ color: color === 'cyan' ? '#06b6d4' : color === 'amber' ? '#f59e0b' : '#3b82f6' }}>{title}</span></div>
      <ul className="space-y-1">
        {items.map((item, i) => {
          const text = typeof item === 'string' 
            ? item 
            : item.name ? `${item.name} - ${item.description || ''} [${item.technologies || ''}]` 
            : `${item.degree || item.title || item.role} @ ${item.institution || item.company}`;
          return <li key={i} className="text-xs text-gray-400 truncate">• {text}</li>;
        })}
      </ul>
    </div>
  );
}
