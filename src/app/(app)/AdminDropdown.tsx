'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function AdminDropdown({ isSuperAdmin }: { isSuperAdmin: boolean }) {
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
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="hover:text-green-300 transition-colors"
      >
        Admin ▾
      </button>
      {open && (
        <div className="absolute left-1/2 -translate-x-1/2 top-7 flex flex-col bg-green-900 border border-green-700 rounded-lg overflow-hidden min-w-36 z-10 shadow-lg">
          <Link href="/admin/leagues" onClick={() => setOpen(false)} className="px-4 py-2.5 text-sm hover:bg-green-800 transition-colors">Leagues</Link>
          <Link href="/admin/disputes" onClick={() => setOpen(false)} className="px-4 py-2.5 text-sm hover:bg-green-800 transition-colors">Disputes</Link>
          {isSuperAdmin && (
            <Link href="/admin/users" onClick={() => setOpen(false)} className="px-4 py-2.5 text-sm hover:bg-green-800 transition-colors">Users</Link>
          )}
        </div>
      )}
    </div>
  );
}
