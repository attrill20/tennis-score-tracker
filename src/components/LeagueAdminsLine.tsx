import Link from 'next/link';
import PlayerAvatar from '@/components/PlayerAvatar';

type Admin = { id: string; name: string; avatarUrl: string | null };

export default function LeagueAdminsLine({
  admins,
  textClassName = 'text-gray-600',
  className = '',
}: {
  admins: Admin[];
  textClassName?: string;
  className?: string;
}) {
  if (admins.length === 0) return null;
  const isPlural = admins.length > 1;

  return (
    <div className={`flex items-center flex-wrap gap-1.5 ${className}`}>
      <span className={`text-sm font-semibold ${textClassName}`}>
        {isPlural ? 'League Admins:' : 'League Admin:'}
      </span>
      {admins.map((a, i) => (
        <Link
          key={a.id}
          href={`/players/${a.id}`}
          className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
        >
          <PlayerAvatar name={a.name} avatarUrl={a.avatarUrl} size="sm" />
          <span className={`text-sm ${textClassName} ${isPlural ? 'hidden sm:inline' : ''}`}>
            {a.name}
            {isPlural && i < admins.length - 1 ? ',' : ''}
          </span>
        </Link>
      ))}
    </div>
  );
}
