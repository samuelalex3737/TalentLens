import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ScanEye, Menu, X, Sun, Moon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { gradientText } from '../UI/GradientText';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../UI/ThemeToggle';
import PillNav from '../UI/PillNav/PillNav';

export default function Navbar({ theme = 'dark', onToggleTheme = () => {} }) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const [logoRotation, setLogoRotation] = useState(0);
  const { user, logout } = useAuth();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const isDark = theme === 'dark';

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Analyze', href: '/analyze' },
    { label: 'History', href: '/history' }
  ];

  const getActiveHref = (pathname) => {
    if (pathname === '/') return '/';
    if (pathname.startsWith('/analyze')) return '/analyze';
    if (pathname.startsWith('/history')) return '/history';
    return pathname;
  };

  const pillNavProps = {
    logo: undefined,
    items: navItems,
    activeHref: getActiveHref(location.pathname),
    ease: 'power3.easeOut',
    initialLoadAnimation: true,
    baseColor: isDark ? '#0f172a' : '#f1f5f9',
    pillColor: isDark ? '#3730a3' : '#ffffff', // Brighter active pill background
    pillTextColor: isDark ? '#cbd5e1' : '#4338ca', // Lighter text for inactive
    hoveredPillTextColor: '#ffffff', // White text when active/hovered for max contrast
  };

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50"
      style={{
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid var(--nav-border)',
      }}
    >
      <div className="w-full px-0">
        <div className="relative flex items-center justify-center h-[72px]">
          {/* Logo */}
          <Link to="/" className="absolute left-3 sm:left-8 flex items-center gap-2 sm:gap-3 group">
            <motion.img 
              src="/logo.png" 
              alt="TalentLens Logo" 
              className="w-14 h-14 sm:w-20 sm:h-20 object-cover mix-blend-screen" 
              animate={{ rotate: logoRotation }}
              transition={{ type: "spring", stiffness: 260, damping: 15 }}
              onClick={() => setLogoRotation(prev => prev + 360)}
            />
            <div className="hidden sm:flex flex-col">
              <span className="text-3xl font-black leading-tight transition-all duration-300" style={gradientText}>
                TalentLens
              </span>
              <span className="text-xs text-gray-500 tracking-[0.2em] uppercase leading-none mt-0.5 group-hover:text-teal-400/70 transition-colors">
                See Beyond the Resume
              </span>
            </div>
          </Link>

          {/* PillNav replacing standard desktop tabs */}
          <PillNav {...pillNavProps} />

          <div className="absolute right-2 sm:right-4 flex items-center gap-2 sm:gap-4">
            <ThemeToggle isDark={theme === 'dark'} toggleTheme={onToggleTheme} />

            {/* Auth Menu */}
            {user ? (
              <div className="relative" ref={profileRef}>
                <button 
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 focus:outline-none"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md transition-transform hover:scale-105">
                    {(user.full_name || user.email || '?').charAt(0).toUpperCase()}
                  </div>
                </button>
                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl shadow-lg ring-1 backdrop-blur-md z-50 profile-dropdown">
                    <div className="px-4 py-3">
                      <p className="text-sm font-medium truncate profile-name">{user.full_name || 'User'}</p>
                      <p className="text-xs truncate profile-email">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <button 
                        onClick={() => { logout(); setProfileOpen(false); }}
                        className="group flex w-full items-center px-4 py-2 text-sm transition-colors profile-signout"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <Link to="/login" className="text-xs sm:text-sm font-medium text-gray-300 hover:text-white transition-colors">
                  Sign in
                </Link>
                <Link to="/signup" className="hidden sm:inline-flex text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 px-4 py-2 rounded-lg transition-colors btn-get-started">
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
