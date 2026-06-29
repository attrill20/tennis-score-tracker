'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DatePicker from '@/components/DatePicker';

export default function TournamentSettingsForm({
  tid,
  initialName,
  initialDescription,
  initialRoundDates,
  initialFinalEnd,
  initialPromoted,
  initialRelegated,
}: {
  tid: string;
  initialName: string;
  initialDescription: string;
  initialRoundDates: string[];
  initialFinalEnd: string;
  initialPromoted: number;
  initialRelegated: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [roundDates, setRoundDates] = useState<string[]>(initialRoundDates.length ? initialRoundDates : ['']);
  const [finalEnd, setFinalEnd] = useState(initialFinalEnd);
  const [numPromoted, setNumPromoted] = useState(initialPromoted);
  const [numRelegated, setNumRelegated] = useState(initialRelegated);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function setRoundDate(i: number, val: string) {
    setRoundDates((prev) => prev.map((d, idx) => (idx === i ? val : d)));
  }
  function addRound() {
    setRoundDates((prev) => [...prev, '']);
  }
  function removeRound(i: number) {
    setRoundDates((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    setError('');
    setSaved(false);
    setSaving(true);
    const res = await fetch(`/api/admin/tournaments/multi/${tid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, roundDates: roundDates.filter(Boolean), finalEnd, numPromoted, numRelegated }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }
    setSaved(true);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium px-4 py-2 rounded-lg transition-colors"
      >
        Manage tournament settings
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-700">Tournament settings</h2>
        <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
      </div>

      <div>
        <label htmlFor="t-name" className="block text-sm font-medium text-gray-700 mb-1">Tournament name</label>
        <input
          id="t-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        />
      </div>

      <div>
        <label htmlFor="t-description" className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400 font-normal">(shown on each division page)</span></label>
        <textarea
          id="t-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
          placeholder="e.g. Summer championship across three divisions..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Round start dates</label>
        <p className="text-xs text-gray-400 mb-2">Changing these updates the start and end dates of every division in each round.</p>
        <div className="space-y-2">
          {roundDates.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-16 shrink-0">Round {i + 1}</span>
              <div className="flex-1">
                <DatePicker id={`edit-round-${i}`} value={d} onChange={(val) => setRoundDate(i, val)} />
              </div>
              {roundDates.length > 1 && (
                <button type="button" onClick={() => removeRound(i)} className="text-xs text-red-500 hover:text-red-700 hover:underline shrink-0">
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addRound} className="mt-2 text-xs text-green-700 hover:underline font-medium">
          + Add another round
        </button>
      </div>

      <div>
        <label htmlFor="t-final" className="block text-sm font-medium text-gray-700 mb-1">Final finishing date</label>
        <DatePicker id="t-final" value={finalEnd} onChange={setFinalEnd} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="t-promoted" className="block text-sm font-medium text-gray-700 mb-1">Number promoted</label>
          <select
            id="t-promoted"
            value={numPromoted}
            onChange={(e) => setNumPromoted(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="t-relegated" className="block text-sm font-medium text-gray-700 mb-1">Number relegated</label>
          <select
            id="t-relegated"
            value={numRelegated}
            onChange={(e) => setNumRelegated(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {saved && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">Settings saved.</p>}

      <button
        onClick={save}
        disabled={saving}
        className="text-sm bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {saving ? 'Saving...' : 'Save settings'}
      </button>
    </div>
  );
}
