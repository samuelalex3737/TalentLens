/**
 * Color-coded score badge.
 * @param {{ score: number, label?: string, size?: 'sm'|'md'|'lg' }} props
 */
export default function ScoreBadge({ score, label, size = 'md' }) {
  const getColor = () => {
    if (score >= 80) return { bg: 'rgba(16,185,129,0.15)', text: '#10b981', border: 'rgba(16,185,129,0.3)' };
    if (score >= 60) return { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', border: 'rgba(59,130,246,0.3)' };
    if (score >= 40) return { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' };
    return { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' };
  };

  const colors = getColor();
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses[size]}`}
      style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
    >
      {label && <span className="opacity-70">{label}</span>}
      {score.toFixed(1)}
    </span>
  );
}
