'use client';

import { useRouter } from 'next/navigation';

export default function RegisterButton({ tournamentId, isRegistered }: { tournamentId: string; isRegistered: boolean }) {
  const router = useRouter();

  return (
    <div className="relative z-20" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => router.push(`/tournaments/register/${tournamentId}`)}
        className={`cursor-pointer text-xs font-medium px-2 py-1 rounded-full transition-colors whitespace-nowrap ${
          isRegistered
            ? 'bg-amber-100 hover:bg-amber-200 text-amber-700'
            : 'bg-green-700 hover:bg-green-800 text-white'
        }`}
      >
        {isRegistered ? 'Registered ✎' : 'Register'}
      </button>
    </div>
  );
}
