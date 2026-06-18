import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';
import HomePage from './pages/HomePage';
import AnalyzePage from './pages/AnalyzePage';
import HistoryPage from './pages/HistoryPage';
import LiquidEther from './components/UI/LiquidEther/LiquidEther';
import BackToTop from './components/UI/BackToTop';

import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';

export default function App() {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('talentlens-theme');
    return stored === 'light' || stored === 'dark' ? stored : 'dark';
  });

  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    localStorage.setItem('talentlens-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="min-h-screen flex flex-col bg-grid">
      {!isMobile && (
        <LiquidEther
          colors={['#6366f1', '#a855f7', '#38bdf8']}
          mouseForce={15}
          cursorSize={80}
          resolution={0.3}
          isViscous={false}
          viscous={30}
          iterationsViscous={16}
          iterationsPoisson={16}
          BFECC={false}
          isBounce={false}
          autoDemo={true}
          autoSpeed={0.3}
          autoIntensity={1.2}
          autoResumeDelay={3000}
          autoRampDuration={0.6}
          takeoverDuration={0.25}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 0,
            opacity: 0.15,
            pointerEvents: 'none'
          }}
        />
      )}
      <Navbar theme={theme} onToggleTheme={toggleTheme} />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage theme={theme} />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="signup" element={<SignupPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="verify-email" element={<VerifyEmailPage />} />
          </Route>
          <Route path="/analyze" element={<ProtectedRoute><AnalyzePage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        </Routes>
      </main>
      <BackToTop />
      <Footer />
    </div>
  );
}
