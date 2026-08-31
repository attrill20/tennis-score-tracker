'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DatePicker from '@/components/DatePicker';
import CollapsibleSection from '@/components/CollapsibleSection';
import PointsConfigFields from '@/components/PointsConfigFields';
import { type PointsConfig } from '@/lib/league';

export default function TournamentSettingsForm({
  tid,
  initialName,
  initialDescription,
  initialRoundDates,
  initialFinalEnd,
  initialPromoted,
  initialRelegated,
  hasRegistrationForm,
  initialMaxRegistrations,
  initialScoringMethod,
  initialPointsConfig,
  initialNumDivisions,
  isCurrentRoundUpcoming,
}: {
  tid: string;
  initialName: string;
  initialDescription: string;
  initialRoundDates: string[];
  initialFinalEnd: string;
  initialPromoted: number;
  initialRelegated: number;
  hasRegistrationForm: boolean;
  initialMaxRegistrations: number | null;
  initialScoringMethod: string;
  initialPointsConfig: PointsConfig | null;
  initialNumDivisions: number;
  isCurrentRoundUpcoming: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [roundDates, setRoundDates] = useState<string[]>(initialRoundDates.length ? initialRoundDates : ['']);
  const [finalEnd, setFinalEnd] = useState(initialFinalEnd);
  const [numPromoted, setNumPromoted] = useState(initialPromoted);
  const [numRelegated, setNumRelegated] = useState(initialRelegated);
  const [maxRegistrations, setMaxRegistrations] = useState(initialMaxRegistrations !== null ? String(initialMaxRegistrations) : '');
  const [scoringMethod, setScoringMethod] = useState(initialScoringMethod);
  const [pointsConfig, setPointsConfig] = useState<PointsConfig | null>(initialPointsConfig);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [numDivisions, setNumDivisions] = useState(initialNumDivisions);
  const [resizing, setResizing] = useState(false);
  const [resizeError, setResizeError] = useState('');
  const [resizeConfirm, setResizeConfirm] = useState<{ message: string } | null>(null);
  const [resizeSaved, setResizeSaved] = useState(false);

  async function resizeDivisions(force = false) {
    setResizeError('');
    setResizeSaved(false);
    if (!force) setResizeConfirm(null);
    setResizing(true);
    try {
      const res = await fetch(`/api/admin/tournaments/${tid}/assign-divisions/resize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numDivisions, ...(force ? { force: true } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.needsConfirmation) {
          setResizeConfirm({ message: data.error });
          return;
        }
        throw new Error(data.error || 'Failed to update the number of divisions');
      }
      setResizeSaved(true);
      router.refresh();
    } catch (e) {
      setResizeError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setResizing(false);
    }
  }

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
      body: JSON.stringify({
        name, description, roundDates: roundDates.filter(Boolean), finalEnd, numPromoted, numRelegated,
        maxRegistrations: maxRegistrations !== '' ? Number(maxRegistrations) : null,
        scoringMethod, pointsConfig,
      }),
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

  return (
    <CollapsibleSection title="Manage tournament settings">
      <div className="space-y-4">
      <div>
        <label htmlFor="t-name" className="block text-sm font-medium text-gray-700 mb-1">Tournament name</label>
        <input
          id="t-name"
          name="tournamentName"
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
          name="tournamentDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
          placeholder="e.g. Summer championship across three divisions..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Round start dates</label>
        <p className="text-xs text-gray-400 mb-2">Changing these updates the start and end dates of every division in each round</p>
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

      <div>
        <label htmlFor="t-scoringMethod" className="block text-sm font-medium text-gray-700 mb-1">Scoring method</label>
        <p className="text-xs text-gray-400 mb-2">Applies to every division in every round</p>
        <select
          id="t-scoringMethod"
          name="scoringMethod"
          value={scoringMethod}
          onChange={(e) => setScoringMethod(e.target.value)}
          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        >
          <option value="1_set_tiebreak">1 set only (allow tiebreaker)</option>
          <option value="1_set_no_tiebreak">1 set only (no tiebreaker)</option>
          <option value="best_of_3_tiebreak">Best of 3 sets (allow tiebreaker)</option>
          <option value="best_of_3_no_tiebreak">Best of 3 sets (no tiebreaker)</option>
          <option value="best_of_5_tiebreak">Best of 5 sets (allow tiebreaker)</option>
          <option value="best_of_5_no_tiebreak">Best of 5 sets (no tiebreaker)</option>
        </select>
      </div>

      <PointsConfigFields value={pointsConfig} onChange={setPointsConfig} />

      <div className="bg-green-50/50 border border-green-100 rounded-xl p-4 space-y-2">
        <label htmlFor="t-numDivisions" className="block text-sm font-medium text-gray-700 mb-1">Number of divisions</label>
        {isCurrentRoundUpcoming ? (
          <>
            <p className="text-xs text-gray-400">
              Only changes the current round, and only while it hasn&apos;t started yet. Adding a division clones the settings of the bottom division; removing one deletes the bottom division(s) - any players already drafted into them are returned to the unassigned pool.
            </p>
            <select
              id="t-numDivisions"
              name="numDivisions"
              value={numDivisions}
              onChange={(e) => { setNumDivisions(Number(e.target.value)); setResizeSaved(false); setResizeError(''); setResizeConfirm(null); }}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            >
              {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>{n} divisions</option>
              ))}
            </select>
            {resizeConfirm && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 space-y-2">
                <p className="text-sm text-amber-800">{resizeConfirm.message}</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setResizeConfirm(null)}
                    className="flex-1 text-xs border border-gray-300 hover:border-gray-400 text-gray-600 font-medium py-1.5 rounded-lg transition-colors">
                    Cancel
                  </button>
                  <button type="button" onClick={() => resizeDivisions(true)} disabled={resizing}
                    className="flex-1 text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-medium py-1.5 rounded-lg transition-colors">
                    Continue anyway
                  </button>
                </div>
              </div>
            )}
            {resizeError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{resizeError}</p>}
            {resizeSaved && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">Number of divisions updated</p>}
            <button
              type="button"
              onClick={() => resizeDivisions()}
              disabled={resizing || numDivisions === initialNumDivisions}
              className="text-sm bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {resizing ? 'Updating...' : 'Update divisions'}
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-500 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
            {initialNumDivisions} divisions <span className="text-gray-400 text-xs ml-1">(the current round has already started, so this can&apos;t be changed until the next round is generated)</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="t-promoted" className="block text-sm font-medium text-gray-700 mb-1">Number promoted</label>
          <select
            id="t-promoted"
            name="numPromoted"
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
            name="numRelegated"
            value={numRelegated}
            onChange={(e) => setNumRelegated(Number(e.target.value))}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          >
            {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {hasRegistrationForm && (
        <div>
          <label htmlFor="t-maxRegistrations" className="block text-sm font-medium text-gray-700 mb-1">
            Maximum total registrations <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="t-maxRegistrations"
            name="maxRegistrations"
            type="number"
            min={1}
            value={maxRegistrations}
            onChange={(e) => setMaxRegistrations(e.target.value)}
            placeholder="Unlimited"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {saved && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">Settings saved</p>}

      <button
        onClick={save}
        disabled={saving}
        className="text-sm bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors"
      >
        {saving ? 'Saving...' : 'Save settings'}
      </button>
      </div>
    </CollapsibleSection>
  );
}
