'use client';

import { type RegistrationQuestion, type QuestionType } from '@/lib/registration';

function newQuestionId() {
  return `q_${Math.random().toString(36).slice(2, 10)}`;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: 'Multiple choice',
  short_text: 'Short answer',
  long_text: 'Long answer',
};

export default function RegistrationQuestionsBuilder({
  questions,
  onChange,
}: {
  questions: RegistrationQuestion[];
  onChange: (questions: RegistrationQuestion[]) => void;
}) {
  function update(index: number, patch: Partial<RegistrationQuestion>) {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }
  function remove(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }
  function addQuestion() {
    onChange([...questions, { id: newQuestionId(), type: 'short_text', label: '', required: false }]);
  }
  function setType(index: number, type: QuestionType) {
    update(index, { type, options: type === 'single_choice' ? ['', ''] : undefined });
  }
  function updateOption(qIndex: number, optIndex: number, value: string) {
    const options = [...(questions[qIndex].options ?? [])];
    options[optIndex] = value;
    update(qIndex, { options });
  }
  function addOption(qIndex: number) {
    update(qIndex, { options: [...(questions[qIndex].options ?? []), ''] });
  }
  function removeOption(qIndex: number, optIndex: number) {
    update(qIndex, { options: (questions[qIndex].options ?? []).filter((_, i) => i !== optIndex) });
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Ability level (Beginner / Intermediate / Parks League C-E / Parks League 1sts-B) is always asked and is what suggests a division. Add, edit, remove or reorder any other questions below.
      </p>

      {questions.map((q, i) => (
        <div key={q.id} className="border border-gray-200 rounded-lg p-3 bg-white space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <label htmlFor={`q-label-${q.id}`} className="sr-only">Question text</label>
              <input
                id={`q-label-${q.id}`}
                name={`q-label-${q.id}`}
                type="text"
                value={q.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Question text"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              />
            </div>
            <div className="flex items-center gap-1 shrink-0 pt-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1">&uarr;</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1} className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-30 px-1">&darr;</button>
              <button type="button" onClick={() => remove(i)} className="text-xs text-red-500 hover:text-red-700 hover:underline px-1">Remove</button>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <label htmlFor={`q-type-${q.id}`} className="sr-only">Question type</label>
            <select
              id={`q-type-${q.id}`}
              name={`q-type-${q.id}`}
              value={q.type}
              onChange={(e) => setType(i, e.target.value as QuestionType)}
              className="text-xs px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
              <input
                type="checkbox"
                checked={q.required}
                onChange={(e) => update(i, { required: e.target.checked })}
                className="accent-green-700 w-3.5 h-3.5"
              />
              Required
            </label>
          </div>

          {q.type === 'single_choice' && (
            <div className="space-y-1.5 pl-1">
              {(q.options ?? []).map((opt, optIndex) => (
                <div key={optIndex} className="flex items-center gap-2">
                  <label htmlFor={`q-opt-${q.id}-${optIndex}`} className="sr-only">Option {optIndex + 1}</label>
                  <input
                    id={`q-opt-${q.id}-${optIndex}`}
                    name={`q-opt-${q.id}-${optIndex}`}
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(i, optIndex, e.target.value)}
                    placeholder={`Option ${optIndex + 1}`}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i, optIndex)}
                    disabled={(q.options ?? []).length <= 2}
                    className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-30 shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addOption(i)} className="text-xs text-green-700 hover:underline font-medium">
                + Add option
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addQuestion}
        className="w-full py-2 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-green-700 hover:text-green-700 text-sm font-medium transition-colors"
      >
        + Add a question
      </button>
    </div>
  );
}
