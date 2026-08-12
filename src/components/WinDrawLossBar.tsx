export default function WinDrawLossBar({
  wins,
  draws,
  losses,
}: {
  wins: number;
  draws: number;
  losses: number;
}) {
  const total = wins + draws + losses;
  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));

  return (
    <div>
      <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-gray-100">
        {wins > 0 && <div className="bg-green-500" style={{ width: `${pct(wins)}%` }} />}
        {draws > 0 && <div className="bg-yellow-400" style={{ width: `${pct(draws)}%` }} />}
        {losses > 0 && <div className="bg-red-400" style={{ width: `${pct(losses)}%` }} />}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div>
          <p className="text-xs text-green-600">Wins</p>
          <p className="font-bold text-gray-900">{wins} <span className="text-xs font-normal text-gray-400">({pct(wins)}%)</span></p>
        </div>
        <div>
          <p className="text-xs text-yellow-500">Draws</p>
          <p className="font-bold text-gray-900">{draws} <span className="text-xs font-normal text-gray-400">({pct(draws)}%)</span></p>
        </div>
        <div>
          <p className="text-xs text-red-400">Losses</p>
          <p className="font-bold text-gray-900">{losses} <span className="text-xs font-normal text-gray-400">({pct(losses)}%)</span></p>
        </div>
      </div>
    </div>
  );
}
