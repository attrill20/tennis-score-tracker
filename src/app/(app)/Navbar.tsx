'use client';

import { useState } from 'react';
import Link from 'next/link';

interface NavbarProps {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
}

export default function Navbar({ isAdmin, isSuperAdmin, signOut }: NavbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-green-900 text-white px-4 py-3 relative z-30">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" onClick={() => setOpen(false)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/qptc-logo.jpg" alt="QPTC" className="w-9 h-9 aspect-square shrink-0 rounded-full object-cover" />
          </Link>
          <Link href="/dashboard" onClick={() => setOpen(false)} className="font-semibold text-sm">
            Score Tracker
          </Link>
        </div>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          <Link href="/leagues" className="hover:text-green-300 transition-colors">Leagues</Link>
          <Link href="/profile" className="hover:text-green-300 transition-colors">Profile</Link>
          <Link href="/contact" className="hover:text-green-300 transition-colors">Contact</Link>
          {isAdmin && <AdminDropdown isSuperAdmin={isSuperAdmin} />}
          <form action={signOut}>
            <button type="submit" className="hover:text-green-300 transition-colors">Sign out</button>
          </form>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((prev) => !prev)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="md:hidden flex flex-col justify-center gap-1.5 p-1"
        >
          <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${open ? 'translate-y-2 rotate-45' : ''}`} />
          <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${open ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${open ? '-translate-y-2 -rotate-45' : ''}`} />
        </button>
      </div>

      {/* Mobile slide-down panel */}
      {open && (
        <>
          <Backdrop onClose={() => setOpen(false)} />
          <div className="md:hidden absolute top-full left-0 right-0 bg-green-900 border-t border-green-700 shadow-lg z-20">
            <div className="max-w-4xl mx-auto py-2 flex flex-col items-end">
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
                  <div className="w-full border-t border-green-700 my-1" />
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
              <div className="w-full border-t border-green-700 my-1" />
              <form action={signOut}>
                <button type="submit" className="px-4 py-3 text-sm hover:bg-green-800 transition-colors">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}

function Backdrop({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-10" onClick={onClose} aria-hidden="true" />;
}

function AdminDropdown({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen((prev) => !prev)} className="hover:text-green-300 transition-colors">
        Admin ▾
      </button>
      {open && (
        <>
          <Backdrop onClose={() => setOpen(false)} />
          <div className="absolute left-1/2 -translate-x-1/2 top-7 flex flex-col bg-green-900 border border-green-700 rounded-lg overflow-hidden min-w-36 z-20 shadow-lg">
            <Link href="/admin/leagues" onClick={() => setOpen(false)} className="px-4 py-2.5 text-sm hover:bg-green-800 transition-colors">Leagues</Link>
            <Link href="/admin/disputes" onClick={() => setOpen(false)} className="px-4 py-2.5 text-sm hover:bg-green-800 transition-colors">Disputes</Link>
            {isSuperAdmin && (
              <Link href="/admin/users" onClick={() => setOpen(false)} className="px-4 py-2.5 text-sm hover:bg-green-800 transition-colors">Users</Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
