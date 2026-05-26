'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

export default function SearchInput({
  initialSearch,
  sortCol,
  sortOrder,
}: {
  initialSearch: string;
  sortCol: string;
  sortOrder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const params = new URLSearchParams({ sort: sortCol, order: sortOrder });
      if (e.target.value) params.set('search', e.target.value);
      router.replace(`${pathname}?${params}`);
    },
    [router, pathname, sortCol, sortOrder],
  );

  return (
    <div className="relative w-full">
      <input
        type="text"
        defaultValue={initialSearch}
        onChange={handleChange}
        placeholder="Search by name or email..."
        className="w-full px-4 py-2 pl-9 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
      />
      <svg
        className="absolute left-3 top-2.5 h-4 w-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>
  );
}
