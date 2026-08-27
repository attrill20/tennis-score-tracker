'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ABILITY_LEVELS, type AbilityLevel, type RegistrationQuestion } from '@/lib/registration';

type Profile = { fullName: string; phone: string | null; email: string };
type Initial = { abilityLevel: string; answers: Record<string, string> };

export default function RegistrationForm({
  tournamentId,
  profile,
  questions,
  initial,
  redirectHref,
}: {
  tournamentId: string;
  profile: Profile;
  questions: RegistrationQuestion[];
  initial: Initial | null;
  redirectHref: string;
}) {
  const router = useRouter();
  const [abilityLevel, setAbilityLevel] = useState<AbilityLevel | ''>((initial?.abilityLevel as AbilityLevel) ?? '');
  const [answers, setAnswers] = useState<Record<string, string>>(initial?.answers ?? {});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setAnswer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaved(false);

    if (!abilityLevel) {
      setError('Please select your ability level');
      return;
    }

    setSaving(true);
    const res = await fetch(`/api/tournaments/${tournamentId}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ abilityLevel, answers }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    setSaved(true);
    router.refresh();
    setTimeout(() => router.push(redirectHref), 1200);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-xl border border-gray-200 p-5">
      <div>
        <p className="text-xl font-semibold text-gray-800 mb-2">Your Details</p>
        <p className="text-sm text-gray-600"><span className="font-semibold">Name:</span> {profile.fullName}</p>
        <p className="text-sm text-gray-600"><span className="font-semibold">Email:</span> {profile.email}</p>
        {profile.phone && <p className="text-sm text-gray-600"><span className="font-semibold">Phone:</span> {profile.phone}</p>}
        <p className="text-xs text-gray-400 mt-1">To change these, update your profile.</p>
      </div>

      <div>
        <p className="text-xl font-semibold text-gray-800 mb-2">Your Ability Level</p>
        <label className="block text-sm font-medium text-gray-700 mb-2">My approximate ability level <span className="text-red-500">*</span></label>
        <div className="flex flex-wrap gap-2">
          {ABILITY_LEVELS.map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setAbilityLevel(val)}
              className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                abilityLevel === val
                  ? 'bg-green-900 border-green-900 text-white'
                  : 'border-gray-300 text-gray-500 hover:border-green-900 hover:text-green-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {questions.map((q) => (
        <div key={q.id}>
          <label htmlFor={q.type !== 'single_choice' ? `q-${q.id}` : undefined} className="block text-sm font-medium text-gray-700 mb-2">
            {q.label} {!q.required && <span className="text-gray-400 font-normal">(optional)</span>}
          </label>

          {q.type === 'single_choice' && (
            <div className="flex flex-wrap gap-2">
              {(q.options ?? []).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setAnswer(q.id, answers[q.id] === opt ? '' : opt)}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    answers[q.id] === opt
                      ? 'bg-green-900 border-green-900 text-white'
                      : 'border-gray-300 text-gray-500 hover:border-green-900 hover:text-green-900'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {q.type === 'short_text' && (
            <input
              id={`q-${q.id}`}
              name={`q-${q.id}`}
              type="text"
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            />
          )}

          {q.type === 'long_text' && (
            <textarea
              id={`q-${q.id}`}
              name={`q-${q.id}`}
              value={answers[q.id] ?? ''}
              onChange={(e) => setAnswer(q.id, e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
            />
          )}
        </div>
      ))}

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {saved && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">Registration saved.</p>}

      <button
        type="submit"
        disabled={saving}
        className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
      >
        {saving ? 'Saving...' : initial ? 'Update registration' : 'Register'}
      </button>
    </form>
  );
}
