'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
};

type Division = { id: string; name: string; order: number };

export default function RegistrationsPanel({
  registrations,
  registrationCount,
  maxRegistrations,
  divisions,
  questions,
}: {
  registrations: Registration[];
  registrationCount: number;
  maxRegistrations: number | null;
  divisions: Division[];
  questions: RegistrationQuestion[];
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState('');

  const divisionsBySuggestedOrder = (order: number | null) => divisions.find((d) => d.order === order)?.id ?? '';

  async function assign(registration: Registration) {
    const divisionId = choice[registration.id] || divisionsBySuggestedOrder(registration.suggested_division);
    if (!divisionId) return;
    setError('');
    setAssigning(registration.id);
    try {
      const res = await fetch(`/api/admin/leagues/${divisionId}/players`, {
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
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-700">Registrations</h2>
        <span className="text-xs text-gray-400">
          {registrationCount}{maxRegistrations !== null ? ` / ${maxRegistrations}` : ''} registered
        </span>
      </div>

      {registrations.length === 0 ? (
        <p className="text-sm text-gray-400">No pending registrations to assign.</p>
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
                      value={choice[r.id] ?? divisionsBySuggestedOrder(r.suggested_division)}
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
                      disabled={assigning === r.id || !(choice[r.id] || divisionsBySuggestedOrder(r.suggested_division))}
                      className="text-xs bg-green-700 hover:bg-green-800 disabled:opacity-40 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {assigning === r.id ? 'Assigning...' : 'Assign'}
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                    {ABILITY_LEVEL_LABELS[r.ability_level as AbilityLevel] ?? r.ability_level}
                  </span>
                  {r.suggested_division && (
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
    </div>
  );
}
