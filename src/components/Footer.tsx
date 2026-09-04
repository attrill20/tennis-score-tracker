'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';

function FooterContent({ year, stacked }: { year: number; stacked: boolean }) {
  return (
    <>
      <span className={stacked ? '' : 'text-left'}>
        Licenced by{' '}
        <a
          href="https://qptc.co.uk"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white font-medium hover:underline"
        >
          Queen&apos;s <span className="whitespace-nowrap">Park Tennis Club</span>
        </a>
      </span>

      <Link
        href="/contact"
        className="px-3 py-1 rounded-full bg-white text-green-900 font-medium hover:bg-green-100 transition-colors whitespace-nowrap"
      >
        Contact Us
      </Link>

      <span className={stacked ? '' : 'text-right'}>
        Copyright &copy; {year}{' '}
        <a
          href="https://github.com/attrill20"
          target="_blank"
          rel="noopener noreferrer"
          className="text-white font-medium hover:underline whitespace-nowrap"
        >
          James Attrill
        </a>
      </span>
    </>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();
  // An invisible copy of the footer, always laid out in a single row, purely to measure
  // whether that row would need more than 2 lines at the current width - which is the
  // actual signal for switching to the stacked layout, rather than a guessed breakpoint.
  const measureRef = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);

  useLayoutEffect(() => {
    function check() {
      const el = measureRef.current;
      if (!el) return;
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 16;
      setStacked(el.offsetHeight > lineHeight * 2.5);
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <footer className="relative mt-auto border-t border-green-900 bg-green-900">
      <div
        ref={measureRef}
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 opacity-0 pointer-events-none max-w-4xl mx-auto px-6 flex flex-row items-start justify-center gap-4 sm:gap-6 text-xs"
      >
        <FooterContent year={year} stacked={false} />
      </div>

      <div className={`max-w-4xl mx-auto px-6 py-5 flex items-center gap-4 sm:gap-6 text-xs text-white ${
        stacked ? 'flex-col text-center' : 'flex-row justify-center'
      }`}>
        <FooterContent year={year} stacked={stacked} />
      </div>
    </footer>
  );
}
