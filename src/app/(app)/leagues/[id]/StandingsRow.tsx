'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Props = {
  playerId: string;
  userId: string | undefined;
  name: string;
  isInjured: boolean;
  position: number;
  played: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  points: number;
  rowClass: string;
};

export default function StandingsRow({ playerId, userId, name, isInjured, position, played, won, lost, setsFor, setsAgainst, points, rowClass }: Props) {
  const router = useRouter();

  return (
    <tr
      className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${rowClass}`}
      onClick={() => router.push(`/players/${playerId}`)}
    >
      <td className="px-4 py-3 text-gray-800">
        <span className="text-gray-400 mr-2">{position}</span>
        <Link
          href={`/players/${playerId}`}
          className="hover:underline hover:text-green-700 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <span className={playerId === userId ? 'font-bold' : 'font-medium'}>{name}</span>
        </Link>
        {isInjured && (
          <span className="inline-flex items-center justify-center w-4 h-4 bg-white border border-red-300 rounded-full ml-1.5" title="Injured">
            <svg className="w-2.5 h-2.5 text-red-500" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7 2h2v5h5v2h-5v5H7v-5H2V7h5z"/>
            </svg>
          </span>
        )}
      </td>
      <td className="text-center px-2 py-3 text-gray-600">{played}</td>
      <td className="text-center px-2 py-3 text-gray-600">{won}</td>
      <td className="text-center px-2 py-3 text-gray-600">{lost}</td>
      <td className="text-center px-2 py-3 text-gray-600">{setsFor}-{setsAgainst}</td>
      <td className="text-center px-2 py-3 font-semibold text-gray-800">{points}</td>
    </tr>
  );
}
