'use client';

import { type PointsConfig } from '@/lib/league';

export const CLASSIC_POINTS: PointsConfig = { winStraightSets: 3, loseStraightSets: 0, winDecider: 3, loseDecider: 0, draw: 1 };
export const SPLIT_POINTS: PointsConfig = { winStraightSets: 5, loseStraightSets: 1, winDecider: 4, loseDecider: 2, draw: 3 };

const PRESETS = [
  ['classic', 'Classic', 'Win 3 / draw 1 / loss 0'],
  ['split', 'Split', '5-1 / 4-2 / 3-3'],
  ['custom', 'Custom', 'Set your own'],
] as const;

function sameConfig(a: PointsConfig, b: PointsConfig) {
  return a.winStraightSets === b.winStraightSets
    && a.loseStraightSets === b.loseStraightSets
    && a.winDecider === b.winDecider
    && a.loseDecider === b.loseDecider
    && a.draw === b.draw;
}

function presetForConfig(config: PointsConfig | null): (typeof PRESETS)[number][0] {
  if (!config) return 'classic';
  if (sameConfig(config, CLASSIC_POINTS)) return 'classic';
  if (sameConfig(config, SPLIT_POINTS)) return 'split';
  return 'custom';
}

export default function PointsConfigFields({
  value,
  onChange,
}: {
  value: PointsConfig | null;
  onChange: (value: PointsConfig | null) => void;
}) {
  const config = value ?? CLASSIC_POINTS;
  const preset = presetForConfig(value);

  function applyPreset(p: (typeof PRESETS)[number][0]) {
    if (p === 'classic') onChange(null);
    else if (p === 'split') onChange(SPLIT_POINTS);
    else onChange(config);
  }

  function updateField(key: keyof PointsConfig, raw: string) {
    const n = Number(raw);
    onChange({ ...config, [key]: Number.isFinite(n) ? n : 0 });
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Points scoring</label>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {PRESETS.map(([val, label, hint]) => (
          <button
            key={val}
            type="button"
            onClick={() => applyPreset(val)}
            className={`py-2 px-2 rounded-lg border text-xs font-medium transition-colors text-left ${
              preset === val
                ? 'bg-green-900 border-green-900 text-white'
                : 'border-gray-300 text-gray-500 hover:border-green-900 hover:text-green-900'
            }`}
          >
            <span className="block">{label}</span>
            <span className={`block font-normal mt-0.5 ${preset === val ? 'text-green-100' : 'text-gray-400'}`}>{hint}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div>
          <label htmlFor="winStraightSets" className="block text-xs text-gray-500 mb-1">Winner - straight sets</label>
          <input
            id="winStraightSets"
            type="number"
            min={0}
            max={20}
            value={config.winStraightSets}
            onChange={(e) => updateField('winStraightSets', e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
        <div>
          <label htmlFor="loseStraightSets" className="block text-xs text-gray-500 mb-1">Loser - straight sets</label>
          <input
            id="loseStraightSets"
            type="number"
            min={0}
            max={20}
            value={config.loseStraightSets}
            onChange={(e) => updateField('loseStraightSets', e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
        <div>
          <label htmlFor="winDecider" className="block text-xs text-gray-500 mb-1">Winner - deciding set</label>
          <input
            id="winDecider"
            type="number"
            min={0}
            max={20}
            value={config.winDecider}
            onChange={(e) => updateField('winDecider', e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
        <div>
          <label htmlFor="loseDecider" className="block text-xs text-gray-500 mb-1">Loser - deciding set</label>
          <input
            id="loseDecider"
            type="number"
            min={0}
            max={20}
            value={config.loseDecider}
            onChange={(e) => updateField('loseDecider', e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="drawPoints" className="block text-xs text-gray-500 mb-1">Both players - unfinished (level scores)</label>
          <input
            id="drawPoints"
            type="number"
            min={0}
            max={20}
            value={config.draw}
            onChange={(e) => updateField('draw', e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
