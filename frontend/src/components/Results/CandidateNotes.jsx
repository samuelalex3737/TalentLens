import React, { useState, useEffect, useRef } from 'react';
import { updateCandidateNotes } from '../../services/api';

export default function CandidateNotes({ candidateId, initialNotes = "" }) {
  const [notes, setNotes] = useState(initialNotes);
  const [saveState, setSaveState] = useState("idle"); 
  const timerRef = useRef(null);

  const saveNotes = async (value) => {
    setSaveState("saving");
    try {
      await updateCandidateNotes(candidateId, value);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2000);
    } catch {
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), 3000);
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    setNotes(value);
    setSaveState("idle");

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveNotes(value), 500);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const statusText = {
    idle: "",
    saving: "Saving...",
    saved: "✓ Saved",
    error: "⚠ Save failed",
  };

  const statusColor = {
    idle: "",
    saving: "text-white/30",
    saved: "text-green-400",
    error: "text-red-400",
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-white/50">Recruiter Notes</label>
        <span className={`text-xs transition-colors ${statusColor[saveState]}`}>
          {statusText[saveState]}
        </span>
      </div>
      <textarea
        value={notes}
        onChange={handleChange}
        placeholder="Add private notes about this candidate..."
        maxLength={1000}
        rows={3}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 resize-none focus:outline-none focus:border-purple-500/50 transition-colors"
      />
      <div className="flex justify-between mt-1">
        <span className="text-xs text-white/20">Private - not shown to candidates</span>
        <span className="text-xs text-white/20">{notes.length}/1000</span>
      </div>
    </div>
  );
}
