import { motion } from 'framer-motion';
import CandidateCard from './CandidateCard';

/**
 * Full ranking table rendered as a list of CandidateCards.
 * @param {{ candidates: object[] }} props
 */
export default function RankingTable({ candidates, selectedIds, onToggleSelect, aiWeight = 65 }) {
  if (!candidates || candidates.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <p className="text-gray-500">No candidates to display</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-3"
    >
      {candidates.map((candidate, index) => (
        <CandidateCard 
          key={candidate.id || index} 
          candidate={candidate} 
          index={index} 
          isSelected={selectedIds?.has(candidate.id)}
          onToggleSelect={onToggleSelect}
          aiWeight={aiWeight}
        />
      ))}
    </motion.div>
  );
}
