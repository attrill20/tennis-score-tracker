'use client';

import { useRouter } from 'next/navigation';

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="text-green-700 hover:text-green-800 transition-colors pb-1 pr-8 ml-1 cursor-pointer -mt-1"
    >
      <svg className="w-10 h-2.5" fill="none" viewBox="0 0 36 8" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M35 4H1M5 1L1 4l4 3" />
      </svg>
    </button>
  );
}
