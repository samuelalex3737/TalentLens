import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function ScrollIndicator() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`flex flex-col items-center justify-center transition-opacity duration-500 mt-16 ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <span className="text-[11px] font-medium tracking-[0.3em] uppercase mb-2 scroll-text">
        SCROLL
      </span>
      <div className="scroll-animation-container flex flex-col items-center">
        <div className="w-[1px] h-[40px] scroll-line"></div>
        <ChevronDown className="w-4 h-4 scroll-arrow mt-[-2px]" />
      </div>
    </div>
  );
}
