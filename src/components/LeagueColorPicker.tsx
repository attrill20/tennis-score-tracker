'use client';

import { LEAGUE_COLOR_SWATCHES, type LeagueColorKey } from '@/lib/leagueColor';

export default function LeagueColorPicker({
  value,
  onChange,
}: {
  value: LeagueColorKey;
  onChange: (key: LeagueColorKey) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Tournament colour</label>
      <div className="flex flex-wrap gap-2.5">
        {LEAGUE_COLOR_SWATCHES.map((swatch) => (
          <button
            key={swatch.key}
            type="button"
            onClick={() => onChange(swatch.key)}
            title={swatch.label}
            className={`w-7 h-7 rounded-full ${swatch.bg} transition-all ${
              value === swatch.key
                ? `ring-2 ring-offset-2 ${swatch.ring} scale-110`
                : 'hover:scale-110 opacity-60 hover:opacity-100'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
