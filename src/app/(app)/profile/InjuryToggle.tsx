'use client';

import { useState } from 'react';

export default function InjuryToggle({ initialIsInjured }: { initialIsInjured: boolean }) {
  const [isInjured, setIsInjured] = useState(initialIsInjured);
  const [hasBeenTicked, setHasBeenTicked] = useState(initialIsInjured);
  const [saving, setSaving] = useState(false);

  async function toggle(checked: boolean) {
    setIsInjured(checked);
    if (checked) setHasBeenTicked(true);
    setSaving(true);
    await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isInjured: checked }),
    });
    setSaving(false);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Injury Status</h2>
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isInjured}
            onChange={(e) => toggle(e.target.checked)}
            disabled={saving}
            className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          <span className="text-sm font-medium text-gray-700">Mark myself as injured</span>
        </label>
        {isInjured && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg text-center">
            Your name will show an injury indicator in league tables while this is ticked.
          </p>
        )}
        {hasBeenTicked && !isInjured && (
          <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg text-center">
            Great to hear you have recovered, welcome back to the courts!
          </p>
        )}
      </div>
    </div>
  );
}
