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
  drawn: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  points: number;
  rowClass: string;
  // Doubles pair
  partnerId?: string;
  partnerName?: string;
  isPartnerInjured?: boolean;
};

export default function StandingsRow({
  playerId, userId, name, isInjured, position, played, won, drawn, lost,
  setsFor, setsAgainst, points, rowClass,
  partnerId, partnerName, isPartnerInjured,
}: Props) {
  const router = useRouter();
  const isDoubles = !!partnerId;
  const isMe = playerId === userId || partnerId === userId;

  if (isDoubles) {
    return (
      <tr className={`border-t border-gray-100 ${rowClass}`}>
        <td className="px-4 py-3 text-gray-800">
          <span className="text-gray-400 mr-2">{position}</span>
          <Link
            href={`/players/${playerId}`}
            className="hover:underline hover:text-green-700 transition-colors"
          >
            <span className={isMe && playerId === userId ? 'font-bold' : 'font-medium'}>{name}</span>
          </Link>
          {isInjured && (
            <span className="inline-flex items-center justify-center w-4 h-4 bg-white border border-red-300 rounded-full ml-1.5" title="Injured">
              <svg className="w-2.5 h-2.5 text-red-500" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7 2h2v5h5v2h-5v5H7v-5H2V7h5z"/>
              </svg>
            </span>
          )}
          <span className="text-gray-400 mx-1.5">+</span>
          <Link
            href={`/players/${partnerId}`}
            className="hover:underline hover:text-green-700 transition-colors"
          >
            <span className={isMe && partnerId === userId ? 'font-bold' : 'font-medium'}>{partnerName}</span>
          </Link>
          {isPartnerInjured && (
            <span className="inline-flex items-center justify-center w-4 h-4 bg-white border border-red-300 rounded-full ml-1.5" title="Injured">
              <svg className="w-2.5 h-2.5 text-red-500" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7 2h2v5h5v2h-5v5H7v-5H2V7h5z"/>
              </svg>
            </span>
          )}
        </td>
        <td className="text-center px-2 py-3 text-gray-600">{played}</td>
        <td className="text-center px-2 py-3 text-gray-600">{won}</td>
        <td className="text-center px-2 py-3 text-gray-600">{drawn}</td>
        <td className="text-center px-2 py-3 text-gray-600">{lost}</td>
        <td className="text-center px-2 py-3 text-gray-600">{setsFor}-{setsAgainst}</td>
        <td className="text-center px-2 py-3 font-semibold text-gray-800">{points}</td>
      </tr>
    );
  }

  return (
    <tr
      className={`group border-t border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${rowClass}`}
      onClick={() => router.push(`/players/${playerId}`)}
    >
      <td className="px-4 py-3 text-gray-800">
        <span className="text-gray-400 mr-2">{position}</span>
        <Link
          href={`/players/${playerId}`}
          className="relative group-hover:underline group-hover:text-green-700 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <span className={playerId === userId ? 'font-bold' : 'font-medium'}>{name}</span>
          <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-20 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
            View profile &amp; contact details
          </span>
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
      <td className="text-center px-2 py-3 text-gray-600">{drawn}</td>
      <td className="text-center px-2 py-3 text-gray-600">{lost}</td>
      <td className="text-center px-2 py-3 text-gray-600">{setsFor}-{setsAgainst}</td>
      <td className="text-center px-2 py-3 font-semibold text-gray-800">{points}</td>
    </tr>
  );
}
