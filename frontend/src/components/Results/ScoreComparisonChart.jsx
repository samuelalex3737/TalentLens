import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

/**
 * Score comparison charts: bar chart for all candidates + radar chart for top 3.
 * @param {{ candidates: object[] }} props
 */
export default function ScoreComparisonChart({ candidates, semanticWeight = 0.65 }) {
  if (!candidates || candidates.length === 0) return null;

  // Bar chart data (Weighted to reflect slider contribution)
  const barData = candidates.map(c => {
    const rawTfidf = Number(Math.min(100, (c.tfidf_score || 0) * 6.67));
    const rawAi = c.semantic_score || 0;
    
    return {
      name: (c.candidate_name || 'Unknown').split(' ')[0],
      'TF-IDF (Weighted)': Number((rawTfidf * (1 - semanticWeight)).toFixed(1)),
      'AI Score (Weighted)': Number((rawAi * semanticWeight).toFixed(1)),
      'Final': c.final_score || 0,
    };
  });

  // Radar chart data for top 3
  const top3 = [...candidates]
    .sort((a, b) => b.final_score - a.final_score)
    .slice(0, 3);
  const radarSkills = ['matched_skills', 'missing_skills', 'transferable_skills'];
  const radarData = [
    { subject: 'TF-IDF', ...Object.fromEntries(top3.map((c, i) => [`C${i + 1}`, Number(Math.min(100, (c.tfidf_score || 0) * 6.67).toFixed(1))])) },
    { subject: 'AI Score', ...Object.fromEntries(top3.map((c, i) => [`C${i + 1}`, c.semantic_score || 0])) },
    { subject: 'Final', ...Object.fromEntries(top3.map((c, i) => [`C${i + 1}`, c.final_score || 0])) },
    { subject: 'Skills Match', ...Object.fromEntries(top3.map((c, i) => [`C${i + 1}`, Math.min((c.matched_skills?.length || 0) * 10, 100)])) },
    { subject: 'Coverage', ...Object.fromEntries(top3.map((c, i) => {
      const matched = c.matched_skills?.length || 0;
      const total = matched + (c.missing_skills?.length || 0);
      return [`C${i + 1}`, total > 0 ? Math.round((matched / total) * 100) : 0];
    })) },
  ];

  const radarColors = ['#3b82f6', '#a78bfa', '#f59e0b'];

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (
      <div className="glass-card p-3 text-sm" style={{ background: 'var(--surface-4)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <p className="font-medium text-white mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }} className="text-xs">
            {p.name}: {p.value?.toFixed(1)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Bar Chart */}
      <div className="glass-card p-6">
        <h4 className="text-base font-semibold text-white mb-4">Score Comparison</h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis dataKey="name" tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} axisLine={{ stroke: 'var(--chart-grid)' }} />
            <YAxis tick={{ fill: 'var(--chart-axis)', fontSize: 12 }} axisLine={{ stroke: 'var(--chart-grid)' }} domain={[0, 100]} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: 'var(--chart-axis)', fontSize: 12 }} />
            <Bar dataKey="TF-IDF (Weighted)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="AI Score (Weighted)" fill="#818cf8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Final" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Radar Chart */}
      {top3.length >= 2 && (
        <div className="glass-card p-6 overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-semibold text-white">Top Candidates - Skill Radar</h4>
            <span className="text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Hover to view details</span>
          </div>
          <div className="transition-transform duration-500 ease-out group-hover:scale-105 cursor-crosshair">
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--chart-grid)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--chart-angle-axis)', fontSize: 11 }} />
                <PolarRadiusAxis tick={{ fill: 'var(--chart-radius-axis)', fontSize: 10 }} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                {[...top3].reverse().map((c, ri) => {
                  const i = top3.length - 1 - ri;
                  return (
                  <Radar
                    key={i}
                    name={c.candidate_name || `Candidate ${i + 1}`}
                    dataKey={`C${i + 1}`}
                    stroke={radarColors[i]}
                    fill={radarColors[i]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                    activeDot={{ r: 6, fill: radarColors[i], stroke: '#fff', strokeWidth: 2 }}
                  />
                  );
                })}
                <Legend 
                  wrapperStyle={{ color: 'var(--chart-angle-axis)', fontSize: 12, paddingTop: '20px' }} 
                  payload={top3.map((c, i) => ({
                    id: c.candidate_name || `C${i+1}`,
                    type: 'square',
                    value: c.candidate_name || `Candidate ${i + 1}`,
                    color: radarColors[i]
                  }))}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
