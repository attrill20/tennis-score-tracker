'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CollapsibleSection from '@/components/CollapsibleSection';
import { ABILITY_LEVEL_LABELS, type AbilityLevel, type RegistrationQuestion } from '@/lib/registration';

type Registration = {
  id: string;
  player_id: string;
  full_name: string;
  phone: string | null;
  email: string;
  ability_level: string;
  answers: Record<string, string>;
  suggested_division: number | null;
  current_division_id?: string | null;
  current_division_name?: string | null;
};

type Division = { id: string; name: string; order: number };

export default function RegistrationsPanel({
  registrations,
  registrationCount,
  maxRegistrations,
  divisions,
  questions,
  tournamentId,
  isDraft,
}: {
  registrations: Registration[];
  registrationCount: number;
  maxRegistrations: number | null;
  divisions: Division[];
  questions: RegistrationQuestion[];
  tournamentId: string;
  isDraft: boolean;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState('');

  const divisionsBySuggestedOrder = (order: number | null) => divisions.find((d) => d.order === order)?.id ?? '';
  const defaultChoice = (r: Registration) => r.current_division_id || divisionsBySuggestedOrder(r.suggested_division);

  async function assign(registration: Registration) {
    const divisionId = choice[registration.id] || defaultChoice(registration);
    if (!divisionId) return;
    setError('');
    setAssigning(registration.id);
    try {
      // While the round is still a draft (upcoming), the "move" endpoint removes any existing
      // draft row for this player across the round's divisions before adding the new one - a
      // plain insert would otherwise leave them drafted into two divisions at once.
      const res = isDraft
        ? await fetch(`/api/admin/tournaments/${tournamentId}/assign-divisions/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: registration.player_id, targetLeagueId: divisionId }),
          })
        : await fetch(`/api/admin/leagues/${divisionId}/players`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerIds: [registration.player_id] }),
          });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign player');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setAssigning(null);
    }
  }

  return (
    <CollapsibleSection
      title="Registrations"
      meta={
        <span className="text-xs text-gray-400">
          {registrationCount}{maxRegistrations !== null ? ` / ${maxRegistrations}` : ''} registered
        </span>
      }
    >
      {registrations.length === 0 ? (
        <p className="text-sm text-gray-400">No pending registrations to assign</p>
      ) : (
        <div className="space-y-3">
          {registrations.map((r) => {
            const answeredQuestions = questions.filter((q) => r.answers[q.id]);
            return (
              <div key={r.id} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.full_name}</p>
                    <p className="text-xs text-gray-400">{r.email}{r.phone ? ` - ${r.phone}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Division for ${r.full_name}`}
                      value={choice[r.id] ?? defaultChoice(r)}
                      onChange={(e) => setChoice((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      className="text-xs px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">Select division...</option>
                      {divisions.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => assign(r)}
                      disabled={assigning === r.id || !(choice[r.id] || defaultChoice(r))}
                      className="text-xs bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {assigning === r.id ? (r.current_division_id ? 'Moving...' : 'Assigning...') : (r.current_division_id ? 'Move' : 'Assign')}
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    {ABILITY_LEVEL_LABELS[r.ability_level as AbilityLevel] ?? r.ability_level}
                  </span>
                  {r.current_division_id && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      Currently assigned: {r.current_division_name ?? divisions.find((d) => d.id === r.current_division_id)?.name}
                    </span>
                  )}
                  {!r.current_division_id && r.suggested_division && (
                    <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                      Suggested: {divisions.find((d) => d.order === r.suggested_division)?.name ?? `Division ${r.suggested_division}`}
                    </span>
                  )}
                </div>

                {answeredQuestions.length > 0 && (
                  <dl className="mt-2 space-y-1">
                    {answeredQuestions.map((q) => (
                      <div key={q.id} className="text-xs text-gray-500">
                        <dt className="inline font-medium text-gray-600">{q.label}: </dt>
                        <dd className="inline">{r.answers[q.id]}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mt-3">{error}</p>}
    </CollapsibleSection>
  );
}
