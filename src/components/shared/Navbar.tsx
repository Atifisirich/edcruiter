'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, LogIn } from 'lucide-react';
import BrandMark from '@/components/shared/BrandMark';

function scrollToHash(hash: string) {
  const id = hash.replace(/^#/, '');
  if (!id) return;
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hideChrome =
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname.startsWith('/candidate/') ||
    pathname.startsWith('/school/setup') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/reviewer') ||
    pathname.startsWith('/superadmin');

  if (hideChrome) return null;

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'How It Works', href: '/#workflow' },
    { label: 'Teaching Jobs', href: '/jobs', badge: 'New' },
    { label: 'Get a quote', href: '/contact#book-demo' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ];

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    setMobileMenuOpen(false);
    if (!href.includes('#')) return;

    const [path, hash] = href.split('#');
    const targetPath = path || '/';

    if (pathname === targetPath || (targetPath === '/' && pathname === '/')) {
      e.preventDefault();
      window.history.pushState(null, '', `/#${hash}`);
      // Re-run scroll even if hash did not change (browser otherwise ignores)
      requestAnimationFrame(() => scrollToHash(hash));
      return;
    }

    e.preventDefault();
    router.push(href);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs transition-all duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 sm:h-[5.25rem]">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-lg shadow-md group-hover:scale-105 transition-transform">
                E
              </div>
              <div className="flex flex-col gap-0.5">
                <BrandMark size="md" />
                <span className="text-xs text-slate-400 font-medium leading-none">Teacher hiring for schools</span>
              </div>
            </Link>
          </div>

          <nav className="hidden lg:flex items-center gap-1 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200 text-sm font-semibold">
            {navLinks.map((link) => {
              const isActive =
                link.href === '/'
                  ? pathname === '/'
                  : !link.href.includes('#') && pathname === link.href;
              return (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-indigo-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-mono font-bold">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="hidden lg:flex flex-col items-end leading-tight">
            <Link
              href="/login"
              className="brand-primary-btn px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer hover:scale-105 transition-transform"
            >
              <span>Sign in</span>
            </Link>
            <Link href="/contact#book-demo" className="mt-1 text-[11px] font-semibold text-slate-500 hover:text-indigo-600">
              Book a demo
            </Link>
          </div>

          <div className="lg:hidden flex items-center gap-2">
            <Link
              href="/login"
              className="px-3.5 py-2 rounded-lg text-sm font-bold brand-primary-btn"
            >
              Sign in
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden p-4 border-t border-slate-200 bg-white space-y-2.5 shadow-xl">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="block p-2.5 rounded-xl text-sm font-bold text-slate-800 hover:bg-slate-50"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-slate-100 space-y-1">
            <Link
              href="/contact#book-demo"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl font-bold text-sm text-indigo-600 hover:bg-indigo-50"
            >
              Book a demo
            </Link>
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 p-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-50"
            >
              <LogIn className="w-4 h-4" />
              Log in
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
