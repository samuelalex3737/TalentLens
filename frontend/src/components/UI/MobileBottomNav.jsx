import { Link, useLocation } from 'react-router-dom';

const navItems = [
  {
    label: 'Home',
    href: '/',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="w-5 h-5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    label: 'Analyze',
    href: '/analyze',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="w-5 h-5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    label: 'History',
    href: '/history',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
];

function getActiveHref(pathname) {
  if (pathname === '/') return '/';
  if (pathname.startsWith('/analyze')) return '/analyze';
  if (pathname.startsWith('/history')) return '/history';
  return pathname;
}

export default function MobileBottomNav() {
  const { pathname } = useLocation();
  const activeHref = getActiveHref(pathname);

  return (
    <nav
      aria-label="Mobile navigation"
      className="mobile-bottom-nav fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex lg:hidden max-w-xs w-auto rounded-full px-2 py-2"
    >
      {navItems.map((item) => {
        const isActive = activeHref === item.href;
        return (
          <Link
            key={item.href}
            to={item.href}
            className={`mobile-bottom-nav-item flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${isActive ? 'is-active' : ''}`}
          >
            <span className="mobile-bottom-nav-icon flex-shrink-0">
              {item.icon}
            </span>
            {isActive && (
              <span className="mobile-bottom-nav-label whitespace-nowrap">
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
