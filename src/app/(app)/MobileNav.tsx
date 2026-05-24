'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface MobileNavProps {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
}

export default function MobileNav({ isAdmin, isSuperAdmin, signOut }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative md:hidden" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open menu"
        className="flex flex-col justify-center gap-1.5 p-1"
      >
        <span className={`block w-5 h-0.5 bg-white transition-transform duration-200 ${open ? 'translate-y-2 rotate-45' : ''}`} />
        <span className={`block w-5 h-0.5 bg-white transition-opacity duration-200 ${open ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-white transition-transform duration-200 ${open ? '-translate-y-2 -rotate-45' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-9 w-48 bg-green-900 border border-green-700 rounded-lg shadow-lg overflow-hidden z-20">
          <Link href="/leagues" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm hover:bg-green-800 transition-colors">
            Leagues
          </Link>
          <Link href="/profile" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm hover:bg-green-800 transition-colors">
            Profile
          </Link>
          <Link href="/contact" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm hover:bg-green-800 transition-colors">
            Contact
          </Link>
          {isAdmin && (
            <>
              <div className="border-t border-green-700" />
              <Link href="/admin/leagues" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm hover:bg-green-800 transition-colors">
                Admin - Leagues
              </Link>
              <Link href="/admin/disputes" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm hover:bg-green-800 transition-colors">
                Admin - Disputes
              </Link>
              {isSuperAdmin && (
                <Link href="/admin/users" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm hover:bg-green-800 transition-colors">
                  Admin - Users
                </Link>
              )}
            </>
          )}
          <div className="border-t border-green-700" />
          <form action={signOut}>
            <button type="submit" className="w-full text-left px-4 py-3 text-sm hover:bg-green-800 transition-colors">
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
