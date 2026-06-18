import { Briefcase } from 'lucide-react';

/**
 * Job description text input with optional job title.
 * @param {{ jobTitle, setJobTitle, jobDescription, setJobDescription }} props
 */
export default function JobDescriptionInput({ jobTitle, setJobTitle, jobDescription, setJobDescription }) {
  return (
    <div className="glass-card p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-lg bg-blue-500/10">
          <Briefcase className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Job Description</h3>
          <p className="text-xs text-gray-500">Paste the full job description for matching</p>
        </div>
      </div>

      <input
        id="job-title-input"
        type="text"
        value={jobTitle}
        onChange={(e) => setJobTitle(e.target.value)}
        placeholder="Job Title (e.g., Senior Python Developer)"
        className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-500
                   border border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30
                   outline-none transition-all"
        style={{ background: 'var(--surface-2)' }}
      />

      <textarea
        id="job-description-input"
        value={jobDescription}
        onChange={(e) => setJobDescription(e.target.value)}
        placeholder="Paste the complete job description here...&#10;&#10;Include required skills, experience, qualifications, and responsibilities."
        rows={14}
        className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-gray-500
                   border border-white/10 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30
                   outline-none transition-all resize-y min-h-[200px]"
        style={{ background: 'var(--surface-2)' }}
      />

      <div className="flex justify-between text-xs text-gray-600">
        <span>{jobDescription.length} characters</span>
        <span>Minimum 50 characters recommended</span>
      </div>
    </div>
  );
}
