'use client';

import { useRouter } from 'next/navigation';

export default function RegisterButton({ tournamentId, isRegistered }: { tournamentId: string; isRegistered: boolean }) {
  const router = useRouter();

  return (
    <div className="relative z-20" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => router.push(`/tournaments/register/${tournamentId}`)}
        className="cursor-pointer text-xs bg-green-700 hover:bg-green-800 text-white font-medium px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
      >
        {isRegistered ? 'Registered - edit' : 'Register'}
      </button>
    </div>
  );
}
