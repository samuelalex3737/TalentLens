import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Trash2, ChevronRight } from 'lucide-react';
import { getSessions, deleteSession, getSession } from '../../services/api';
import toast from 'react-hot-toast';

/**
 * Skeleton shimmer card for loading states.
 */
function SkeletonCard() {
  return (
    <div className="glass-card p-4 flex items-center gap-4 animate-pulse">
      <div className="p-2 rounded-lg bg-white/5 w-9 h-9 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-white/5 rounded-lg w-3/5" />
        <div className="h-3 bg-white/5 rounded-lg w-2/5" />
      </div>
      <div className="h-5 bg-white/5 rounded-full w-16" />
      <div className="w-4 h-4 bg-white/5 rounded" />
    </div>
  );
}

/**
 * Session history list with skeleton loading and staggered animation.
 * @param {{ onLoadSession: function }} props
 */
export default function SessionHistory({ onLoadSession }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSessionId, setLoadingSessionId] = useState(null);

  useEffect(() => {
    loadSessions();
  }, []);

  async function loadSessions() {
    try {
      setLoading(true);
      const data = await getSessions();
      setSessions(data);
    } catch (err) {
      toast.error('Failed to load session history');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this session? This action cannot be undone.")) {
      try {
        await deleteSession(id);
        setSessions(prev => prev.filter(s => s.id !== id));
        toast.success('Session deleted');
      } catch (err) {
        toast.error('Failed to delete session');
      }
    }
  }

  async function handleView(id) {
    try {
      setLoadingSessionId(id);
      const data = await getSession(id);
      if (onLoadSession) onLoadSession(data);
    } catch (err) {
      toast.error('Failed to load session');
    } finally {
      setLoadingSessionId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <SkeletonCard />
          </motion.div>
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No analysis history yet</p>
        <p className="text-xs text-gray-600 mt-1">Results will appear here after your first analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session, i) => (
        <motion.div
          key={session.id}
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 30 }}
          onClick={() => handleView(session.id)}
          className={`glass-card glass-card-hover p-4 flex items-center gap-4 cursor-pointer group ${
            loadingSessionId === session.id ? 'ring-1 ring-blue-500/30' : ''
          }`}
        >
          <div className="p-2 rounded-lg bg-blue-500/10 shrink-0">
            {loadingSessionId === session.id ? (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Clock className="w-4 h-4 text-blue-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white truncate">{session.job_title}</h4>
            <p className="text-xs text-gray-500">
              {session.total_candidates} {session.total_candidates === 1 ? 'candidate' : 'candidates'} • {new Date(session.created_at).toLocaleDateString()}
            </p>
          </div>

          <span className={`text-xs px-2 py-0.5 rounded-full ${
            session.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
          }`}>
            {session.status}
          </span>

          <button
            onClick={(e) => handleDelete(session.id, e)}
            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
        </motion.div>
      ))}
    </div>
  );
}
