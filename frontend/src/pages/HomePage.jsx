import { motion } from 'framer-motion';
import { Link, Outlet } from 'react-router-dom';
import { ScanEye, Upload, BarChart3, FileDown, Cpu, Shield, Zap, ArrowRight, Sparkles } from 'lucide-react';
import { gradientText } from '../components/UI/GradientText';

const features = [
  { icon: Upload, title: 'Smart PDF Parsing', desc: 'Dual-engine extraction with PyMuPDF + pdfplumber handles any resume format.', color: '#3b82f6' },
  { icon: Cpu, title: 'Dual AI Scoring', desc: 'TF-IDF baseline + LLM semantic analysis for accurate, bias-aware matching.', color: '#8b5cf6' },
  { icon: BarChart3, title: 'Visual Analytics', desc: 'Interactive charts, radar plots, and ranked cards for instant insight.', color: '#06b6d4' },
  { icon: Shield, title: 'Skill Gap Reports', desc: 'Per-candidate matched, missing, and transferable skill breakdowns.', color: '#10b981' },
  { icon: Zap, title: 'Auto-Extract Details', desc: 'Automatically extracts name, LinkedIn, GitHub, certifications & more.', color: '#f59e0b' },
  { icon: FileDown, title: 'CSV Export', desc: 'One-click ranked results download for your ATS or hiring team.', color: '#ec4899' },
];

const stats = [
  { value: '200+', label: 'Skills Tracked' },
  { value: '2', label: 'AI Providers' },
  { value: '<3s', label: 'Per Resume' },
  { value: '35/65', label: 'Score Blend' },
];

export default function HomePage({ theme }) {
  const isDark = theme === 'dark';

  return (
    <div className="min-h-[calc(100vh-8rem)] relative overflow-hidden">
      <Outlet />
      <div className="relative z-10">
        {/* Floating Orbs */}
        <div className="orb w-[250px] h-[250px] sm:w-[400px] sm:h-[400px] lg:w-[500px] lg:h-[500px] bg-blue-600 top-[-10%] left-[-5%]" />
        <div className="orb w-[200px] h-[200px] sm:w-[300px] sm:h-[300px] lg:w-[400px] lg:h-[400px] bg-purple-600 top-[20%] right-[-10%]" style={{ animationDelay: '-4s' }} />
        <div className="orb w-[150px] h-[150px] sm:w-[250px] sm:h-[250px] lg:w-[300px] lg:h-[300px] bg-cyan-500 bottom-[10%] left-[30%]" style={{ animationDelay: '-8s' }} />

        {/* Hero */}
        <section className="relative py-20 sm:py-32 px-4">
          <div className="max-w-5xl mx-auto text-center relative z-10">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-8 hero-badge">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-blue-300 font-medium tracking-wide uppercase hero-badge-text">AI-Powered Resume Intelligence</span>
              </div>

              <h1 className="text-4xl sm:text-6xl lg:text-8xl font-black tracking-tight mb-4 leading-none">
                <span style={gradientText}>TalentLens</span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7 }}
              className="text-lg sm:text-2xl lg:text-3xl text-gray-400 font-extralight mb-6 italic tracking-wide hero-subtitle"
            >
              See Beyond the Resume.
            </motion.p>

            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="max-w-2xl mx-auto text-gray-500 mb-12 text-base leading-relaxed"
            >
              Upload resumes, paste a job description, and let our dual AI engine rank candidates
              with precision. Automatically extract candidate details, score with TF-IDF + LLM,
              and get skill gap reports - all in seconds.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Link
                to="/analyze"
                className="group inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-sm font-semibold
                           text-white shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/40
                           transition-all duration-300 active:scale-95 btn-shine btn-start-analyzing"
              >
                <ScanEye className="w-5 h-5" />
                Start Analyzing
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/history"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl text-sm font-semibold
                           border border-white/10 text-gray-300 hover:bg-white/5 hover:border-white/20
                           transition-all duration-300"
              >
                View History
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Stats Row - Interactive KPI Cards */}
        <section className="max-w-4xl mx-auto px-4 mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4"
          >
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20, scale: 0.9 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                whileHover={{ 
                  scale: 1.05, 
                  borderColor: 'rgba(59,130,246,0.4)',
                  boxShadow: '0 0 30px rgba(59,130,246,0.15), 0 8px 32px rgba(0,0,0,0.3)',
                }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, type: 'spring', stiffness: 300 }}
              className="relative text-center py-7 rounded-2xl border border-white/5 cursor-default group overflow-hidden stat-card"
                style={{ background: 'var(--surface-1)' }}
              >
                {/* Subtle animated gradient border on hover */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle at 50% 0%, rgba(59,130,246,0.08) 0%, transparent 70%)',
                  }}
                />
                <motion.div 
                  className="mb-1 relative z-10"
                  initial={{ scale: 1 }}
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 400 }}
                >
                  <span className="text-3xl font-black" style={gradientText}>
                    {s.value}
                  </span>
                </motion.div>
                <div className="text-xs text-gray-500 uppercase tracking-wider relative z-10 group-hover:text-gray-400 transition-colors stat-label">
                  {s.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* Features */}
        <section className="max-w-6xl mx-auto px-4 pb-24">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Everything You Need</h2>
            <p className="text-gray-500 max-w-xl mx-auto">End-to-end resume screening powered by dual AI scoring, smart extraction, and interactive analytics.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                className="glass-card glass-card-hover p-7 group cursor-default"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                  style={{ background: `${f.color}15` }}
                >
                  <f.icon className="w-6 h-6" style={{ color: f.color }} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
