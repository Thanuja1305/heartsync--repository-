import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, Menu, X, ArrowRight } from 'lucide-react';

const navLinks = [
  { name: 'Home', href: '#home' },
  { name: 'Features', href: '#features' },
  { name: 'About', href: '#about' },
  { name: 'Contact', href: '#contact' },
];

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (location.pathname === '/' && href.startsWith('#')) {
      e.preventDefault();
      const id = href.replace('#', '');
      const element = document.getElementById(id);
      if (element) {
        const offset = 80; // height of fixed navbar
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
      setIsOpen(false);
    }
  };

  return (
    <nav 
      className={`fixed top-0 w-full z-[100] transition-all duration-300 ${
        scrolled 
          ? 'py-4 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-sm' 
          : 'py-6 bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        {/* Left Side: Logo */}
        <Link 
          to="/" 
          onClick={(e) => handleNavClick(e, '#home')}
          className="flex items-center gap-2.5 group"
        >
          <div className="p-2 bg-accent-maroon rounded-[10px] shadow-lg shadow-accent-maroon/20 group-hover:scale-105 transition-transform duration-300">
            <Heart className="w-5 h-5 text-white fill-white/20" />
          </div>
          <span className="text-xl font-display font-black text-dark-navy tracking-tighter">
            HeartSync
          </span>
        </Link>

        {/* Center Navigation: Links */}
        <div className="hidden lg:flex items-center gap-10">
          {navLinks.map((link) => (
            <Link 
              key={link.name} 
              to={location.pathname === '/' ? link.href : `/${link.href}`} 
              onClick={(e) => handleNavClick(e, link.href)}
              className="text-xs font-bold text-dark-navy/60 hover:text-accent-maroon uppercase tracking-widest transition-all duration-300 relative group"
            >
              {link.name}
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-accent-maroon transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </div>

        {/* Right Side: Auth Buttons */}
        <div className="hidden lg:flex items-center gap-6">
          <Link 
            to="/select-role" 
            className="text-xs font-bold text-dark-navy/80 hover:text-accent-maroon uppercase tracking-widest transition-colors"
          >
            Sign In
          </Link>
          <Link 
            to="/signup" 
            className="px-6 py-3 bg-accent-maroon text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-accent-maroon/20 hover:bg-dark-navy hover:shadow-dark-navy/20 transition-all duration-300 flex items-center gap-2"
          >
            Get Started <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="lg:hidden p-2 text-slate-900"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:hidden absolute top-full left-0 w-full bg-white border-b border-dark-navy/5 shadow-xl overflow-hidden"
          >
            <div className="px-6 py-10 space-y-8">
              {navLinks.map((link) => (
                <Link 
                  key={link.name} 
                  to={location.pathname === '/' ? link.href : `/${link.href}`} 
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="block text-2xl font-display font-bold text-dark-navy hover:text-accent-maroon tracking-tight"
                >
                  {link.name}
                </Link>
              ))}
              <div className="pt-8 border-t border-dark-navy/5 flex flex-col gap-4">
                <Link 
                  to="/signup" 
                  onClick={() => setIsOpen(false)}
                  className="text-center py-4 rounded-full bg-accent-maroon text-white text-xs font-black uppercase tracking-widest shadow-lg shadow-accent-maroon/20"
                >
                  Get Started
                </Link>
                <Link 
                  to="/select-role" 
                  onClick={() => setIsOpen(false)}
                  className="text-center py-4 text-xs font-black uppercase tracking-widest text-dark-navy/60"
                >
                  Sign In
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;
