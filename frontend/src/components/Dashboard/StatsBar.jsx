import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Users, Trophy, AlertTriangle, TrendingUp } from 'lucide-react';

/**
 * Animated counter hook - counts from 0 to target value on mount.
 */
function useAnimatedCounter(target, duration = 1200) {
  const [count, setCount] = useState(0);
  const startTime = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const numTarget = parseFloat(target) || 0;
    if (numTarget === 0) { setCount(0); return; }

    const isFloat = String(target).includes('.');
    startTime.current = performance.now();

    function animate(now) {
      const elapsed = now - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * numTarget;
      setCount(isFloat ? parseFloat(current.toFixed(1)) : Math.round(current));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

/**
 * Statistics bar with animated counting numbers and staggered entrance.
 * @param {{ summary: object }} props
 */
export default function StatsBar({ summary }) {
  if (!summary) return null;

  const stats = [
    { label: 'Total Candidates', value: summary.total, icon: Users, color: '#60a5fa' },
    { label: 'Average Score', value: summary.avg_score?.toFixed(1), icon: TrendingUp, color: '#10b981' },
    { label: 'Strong Matches', value: summary.strong_matches, icon: Trophy, color: '#fbbf24' },
    { label: 'Score Conflicts', value: summary.conflict_count, icon: AlertTriangle, color: summary.conflict_count > 0 ? '#f59e0b' : '#4b5563' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, i) => (
        <StatCard key={stat.label} stat={stat} index={i} />
      ))}
    </div>
  );
}

function StatCard({ stat, index }) {
  const animatedValue = useAnimatedCounter(stat.value, 1000 + index * 200);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.12, duration: 0.5, type: 'spring', stiffness: 200 }}
      className="glass-card p-3 sm:p-4 flex items-center gap-2 sm:gap-3 group"
    >
      <div
        className="p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-110"
        style={{ background: `${stat.color}15` }}
      >
        <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
      </div>
      <div>
        <p className="text-lg sm:text-xl font-bold text-white tabular-nums">{animatedValue}</p>
        <p className="text-[10px] sm:text-xs text-gray-500">{stat.label}</p>
      </div>
    </motion.div>
  );
}
