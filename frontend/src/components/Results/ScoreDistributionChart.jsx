import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const ScoreDistributionChart = ({ candidates }) => {
  if (!candidates || candidates.length === 0) return null;

  // Build 10 bins: 0-9, 10-19, ..., 90-100
  const bins = Array.from({ length: 10 }, (_, i) => ({
    range: i === 9 ? '90-100' : `${i * 10}-${i * 10 + 9}`,
    min: i * 10,
    max: i === 9 ? 100 : i * 10 + 9,
    count: 0,
    candidates: [],
  }));

  candidates.forEach((c) => {
    const score = c.final_score || 0;
    const binIndex = Math.min(Math.floor(score / 10), 9);
    bins[binIndex].count += 1;
    bins[binIndex].candidates.push(c.candidate_name || 'Unknown');
  });

  // Custom tooltip showing candidate names
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { range, candidates: names } = payload[0].payload;
    return (
      <div className="chart-tooltip" style={{ borderRadius: '8px', padding: '10px 14px', fontSize: '13px' }}>
        <p className="chart-tooltip-title" style={{ fontWeight: 600, marginBottom: 6 }}>Score {range}</p>
        {names.map((name, i) => (
          <p key={i} className="chart-tooltip-item" style={{ margin: '2px 0' }}>• {name}</p>
        ))}
      </div>
    );
  };

  // Color bars by range to match backend thresholds
  const barColor = (min) => {
    if (min >= 80) return '#4ade80'; // Green (Strong Match)
    if (min >= 60) return '#facc15'; // Yellow (Good Match)
    if (min >= 40) return '#fb923c'; // Orange (Partial Match)
    return '#f87171';                // Red (Poor Match)
  };

  const maxCount = Math.max(...bins.map(b => b.count), 1);

  return (
    <div className="glass-card p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-white">
            Score Distribution
          </h3>
          <p className="text-xs text-white/40 mt-0.5">
            {candidates.length} {candidates.length === 1 ? 'candidate' : 'candidates'} · final score spread
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          {[
            { color: '#f87171', label: '0–39 Poor' },
            { color: '#fb923c', label: '40–59 Partial' },
            { color: '#facc15', label: '60–79 Good' },
            { color: '#4ade80', label: '80–100 Strong' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-white/40">
              <span
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={140}>
        <BarChart
          data={bins}
          margin={{ top: 0, right: 0, bottom: 0, left: -20 }}
          barSize={28}
        >
          <XAxis
            dataKey="range"
            tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: 'var(--chart-axis)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            domain={[0, maxCount + 1]}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'var(--chart-cursor)' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {bins.map((bin) => (
              <Cell
                key={bin.range}
                fill={barColor(bin.min)}
                fillOpacity={bin.count === 0 ? 0.15 : 0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScoreDistributionChart;
