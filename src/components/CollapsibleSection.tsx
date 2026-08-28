'use client';

import { useState, type ReactNode } from 'react';

export default function CollapsibleSection({
  title,
  titleClassName = 'text-gray-700',
  borderClassName = 'border-gray-200',
  meta,
  defaultOpen = false,
  children,
}: {
  title: string;
  titleClassName?: string;
  borderClassName?: string;
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`bg-white rounded-xl border ${borderClassName}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
        aria-expanded={open}
      >
        <h2 className={`text-base font-semibold ${titleClassName}`}>{title}</h2>
        <span className="flex items-center gap-2">
          {meta}
          <svg
            className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="border-t border-gray-100 p-4">
          {children}
        </div>
      )}
    </div>
  );
}
