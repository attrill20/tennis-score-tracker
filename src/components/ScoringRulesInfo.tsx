'use client';

import { useState } from 'react';
import { type PointsConfig } from '@/lib/league';

const CLASSIC: PointsConfig = { winStraightSets: 3, loseStraightSets: 0, winDecider: 3, loseDecider: 0, draw: 1 };

export default function ScoringRulesInfo({ pointsConfig }: { pointsConfig: PointsConfig | null | undefined }) {
  const [open, setOpen] = useState(false);
  const config = pointsConfig ?? CLASSIC;
  const simple = config.winStraightSets === config.winDecider && config.loseStraightSets === config.loseDecider;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="How points are calculated"
        aria-expanded={open}
        className="p-1.5 -m-1.5 flex items-center justify-center"
      >
        <span className="w-4 h-4 rounded-full border border-gray-300 text-gray-400 flex items-center justify-center text-[10px] font-semibold leading-none">
          i
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-full left-0 mt-2 w-64 max-w-[85vw] bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs text-gray-600 space-y-1.5">
            <p className="font-semibold text-gray-700">How points are earned</p>
            {simple ? (
              <>
                <p>Win: <span className="font-medium text-gray-800">{config.winStraightSets} pts</span></p>
                <p>Unfinished: <span className="font-medium text-gray-800">{config.draw}pts</span></p>
                <p>Loss: <span className="font-medium text-gray-800">{config.loseStraightSets} pts</span></p>
              </>
            ) : (
              <>
                <p>Straight-sets win: <span className="font-medium text-gray-800">{config.winStraightSets} pts</span> &middot; loss: <span className="font-medium text-gray-800">{config.loseStraightSets} pts</span></p>
                <p>Deciding-set win: <span className="font-medium text-gray-800">{config.winDecider} pts</span> &middot; loss: <span className="font-medium text-gray-800">{config.loseDecider} pts</span></p>
                <p>Unfinished: <span className="font-medium text-gray-800">{config.draw}pts</span></p>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
