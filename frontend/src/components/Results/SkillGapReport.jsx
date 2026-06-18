import { CheckCircle, XCircle, ArrowRightLeft } from 'lucide-react';

/**
 * Detailed skill gap report for a single candidate.
 * @param {{ candidate: object }} props
 */
export default function SkillGapReport({ candidate }) {
  if (!candidate) return null;

  const { matched_skills = [], missing_skills = [], transferable_skills = [] } = candidate;
  const total = matched_skills.length + missing_skills.length;
  const coverage = total > 0 ? Math.round((matched_skills.length / total) * 100) : 0;

  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-white">Skill Gap Report</h4>
        <div className="text-right">
          <div className="text-2xl font-bold gradient-text">{coverage}%</div>
          <div className="text-xs text-gray-500">Skill Coverage</div>
        </div>
      </div>

      {/* Coverage Bar */}
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${coverage}%`,
            background: coverage >= 70 ? '#10b981' : coverage >= 40 ? '#f59e0b' : '#ef4444',
          }}
        />
      </div>

      {/* Skill Sections */}
      <div className="space-y-4">
        <SkillSection
          icon={<CheckCircle className="w-4 h-4 text-emerald-400" />}
          title={`Matched (${matched_skills.length})`}
          skills={matched_skills}
          tagBg="rgba(16,185,129,0.12)"
        />
        <SkillSection
          icon={<XCircle className="w-4 h-4 text-red-400" />}
          title={`Missing (${missing_skills.length})`}
          skills={missing_skills}
          tagBg="rgba(239,68,68,0.12)"
        />
        <SkillSection
          icon={<ArrowRightLeft className="w-4 h-4 text-amber-400" />}
          title={`Transferable (${transferable_skills.length})`}
          skills={transferable_skills}
          tagBg="rgba(245,158,11,0.12)"
        />
      </div>
    </div>
  );
}

function SkillSection({ icon, title, skills, tagBg }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-300">{title}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {skills.length > 0 ? (
          skills.map((skill, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full text-gray-300" style={{ background: tagBg }}>
              {skill}
            </span>
          ))
        ) : (
          <span className="text-xs text-gray-600 italic">None</span>
        )}
      </div>
    </div>
  );
}
