import React from 'react';

export default function ExperienceTimeline({ workExperience }) {
  if (!workExperience || workExperience.length === 0) {
    return (
      <p className="text-xs text-white/30 italic">No work experience extracted</p>
    );
  }

  const entries = typeof workExperience === 'string' ? JSON.parse(workExperience) : workExperience;

  const getDuration = (start, end) => {
    try {
      const parseDate = (s) => {
        if (!s || s.toLowerCase() === 'present') return new Date();
        const cleaned = s.replace(/(\w+)\s(\d{4})/, '$1 1, $2');
        const d = new Date(cleaned);
        return isNaN(d.getTime()) ? null : d;
      };

      const startD = parseDate(start);
      const endD = parseDate(end);
      if (!startD || !endD) return null;

      const months = Math.round((endD - startD) / (1000 * 60 * 60 * 24 * 30.44));
      if (months < 0) return null;
      if (months < 12) return `${months}mo`;
      const years = Math.floor(months / 12);
      const rem = months % 12;
      return rem > 0 ? `${years}y ${rem}mo` : `${years}y`;
    } catch {
      return null;
    }
  };

  const isCurrentRole = (end) => !end || end.toLowerCase() === 'present' || end === '';

  return (
    <div className="space-y-0 mt-3">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 exp-label">Work Experience</h4>
      {entries.map((exp, i) => {
        const isString = typeof exp === 'string';
        const isUnstructured = isString || (!exp.role && !exp.start_date && !exp.end_date);
        
        const duration = isString ? null : getDuration(exp.start_date, exp.end_date);
        const isCurrent = isString ? false : isCurrentRole(exp.end_date);
        const isLast = i === entries.length - 1;

        if (isUnstructured) {
          const textToDisplay = isString ? exp : (exp.description || exp.company);
          return (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 bg-white/30"/>
                {!isLast && <div className="w-px flex-1 bg-white/10 my-1"/>}
              </div>
              <div className={`pb-4 ${isLast ? 'pb-0' : ''}`}>
                <p className="text-sm text-white/70">{textToDisplay}</p>
              </div>
            </div>
          );
        }

        return (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${isCurrent ? 'bg-purple-400' : 'bg-white/30'}`}/>
              {!isLast && <div className="w-px flex-1 bg-white/10 my-1"/>}
            </div>

            <div className={`pb-4 ${isLast ? 'pb-0' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-white exp-title">{exp.role || 'Role not specified'}</span>
                {isCurrent && (
                  <span className="text-xs bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full">Current</span>
                )}
                {duration && (
                  <span className="text-xs bg-white/5 text-white/40 px-1.5 py-0.5 rounded-full exp-duration">{duration}</span>
                )}
              </div>
              <p className="text-xs text-white/50 mt-0.5 exp-company">{exp.company}</p>
              <p className="text-xs text-white/30 mt-0.5 exp-dates">
                {exp.start_date || 'Unknown'} - {exp.end_date || 'Present'}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
