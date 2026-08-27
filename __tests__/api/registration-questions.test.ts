import { validateRegistrationQuestions, validateAnswers, type RegistrationQuestion } from '@/lib/registration';

describe('validateRegistrationQuestions', () => {
  it('accepts a well-formed list of questions', () => {
    const input = [
      { id: 'q1', type: 'single_choice', label: 'Pick one', options: ['A', 'B'], required: true },
      { id: 'q2', type: 'short_text', label: 'Name', required: false },
    ];
    const result = validateRegistrationQuestions(input);
    expect(result).not.toBe('invalid');
    expect((result as RegistrationQuestion[]).map((q) => q.id)).toEqual(['q1', 'q2']);
  });

  it('rejects a non-array value', () => {
    expect(validateRegistrationQuestions('nope')).toBe('invalid');
  });

  it('rejects a question with an empty label', () => {
    expect(validateRegistrationQuestions([{ id: 'q1', type: 'short_text', label: '  ', required: false }])).toBe('invalid');
  });

  it('rejects duplicate ids', () => {
    const input = [
      { id: 'q1', type: 'short_text', label: 'A', required: false },
      { id: 'q1', type: 'short_text', label: 'B', required: false },
    ];
    expect(validateRegistrationQuestions(input)).toBe('invalid');
  });

  it('rejects a single_choice question with fewer than 2 options', () => {
    expect(validateRegistrationQuestions([{ id: 'q1', type: 'single_choice', label: 'Pick', options: ['A'], required: false }])).toBe('invalid');
  });

  it('trims blank options out of a single_choice question', () => {
    const result = validateRegistrationQuestions([
      { id: 'q1', type: 'single_choice', label: 'Pick', options: ['A', '', ' B ', '  '], required: false },
    ]);
    expect(result).not.toBe('invalid');
    expect((result as RegistrationQuestion[])[0].options).toEqual(['A', 'B']);
  });

  it('rejects an unknown question type', () => {
    expect(validateRegistrationQuestions([{ id: 'q1', type: 'essay', label: 'A', required: false }])).toBe('invalid');
  });
});

describe('validateAnswers', () => {
  const questions: RegistrationQuestion[] = [
    { id: 'division', type: 'single_choice', label: 'Division', options: ['1', '2', '3'], required: false },
    { id: 'notes', type: 'long_text', label: 'Notes', required: false },
    { id: 'required_field', type: 'short_text', label: 'Must answer', required: true },
  ];

  it('accepts valid answers and trims whitespace', () => {
    const result = validateAnswers(questions, { division: '2', notes: '  hello  ', required_field: 'yes' });
    expect(result).toEqual({ division: '2', notes: 'hello', required_field: 'yes' });
  });

  it('drops empty optional answers', () => {
    const result = validateAnswers(questions, { division: '', notes: '', required_field: 'yes' });
    expect(result).toEqual({ required_field: 'yes' });
  });

  it('rejects when a required question is left blank', () => {
    expect(validateAnswers(questions, { division: '1' })).toBe('invalid');
  });

  it('rejects a single_choice answer outside its options', () => {
    expect(validateAnswers(questions, { division: '99', required_field: 'yes' })).toBe('invalid');
  });

  it('rejects a non-object value', () => {
    expect(validateAnswers(questions, null)).toBe('invalid');
  });
});
