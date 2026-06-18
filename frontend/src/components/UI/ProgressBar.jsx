import { motion } from 'framer-motion';

/**
 * Animated progress bar showing analysis progress.
 * @param {{ current: number, total: number, message: string }} props
 */
export default function ProgressBar({ current, total, message }) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-300">{message}</p>
        <span className="text-sm font-bold text-blue-400">{percentage}%</span>
      </div>

      <div className="h-3 bg-navy-800 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{
            background: 'linear-gradient(90deg, #3b82f6, #818cf8, #a78bfa)',
            boxShadow: '0 0 20px rgba(59,130,246,0.4)',
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        <p className="text-xs text-gray-500">
          Processing {current} of {total} resumes • AI analysis in progress
        </p>
      </div>
    </motion.div>
  );
}
