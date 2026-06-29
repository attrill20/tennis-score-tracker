'use client';

import { useState } from 'react';
import PasswordInput from '@/components/PasswordInput';

const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-900 text-sm text-gray-900';

export default function ProfileForm({
  initialFirstName,
  initialLastName,
  initialEmail,
  initialPhone,
  initialGender,
}: {
  initialFirstName: string;
  initialLastName: string;
  initialEmail: string;
  initialPhone: string;
  initialGender: string;
}) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [gender, setGender] = useState(initialGender);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [nameWarning, setNameWarning] = useState('');
  const [emailWarning, setEmailWarning] = useState('');
  const [phoneWarning, setPhoneWarning] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function toTitleCase(val: string) {
    const trimmed = val.trim();
    if (trimmed === trimmed.toUpperCase() || trimmed === trimmed.toLowerCase()) {
      return trimmed.toLowerCase().replace(/(?:^|\s|-)[a-z]/g, (c) => c.toUpperCase());
    }
    return trimmed;
  }

  async function checkName(first: string, last: string) {
    if (!first.trim() || !last.trim()) return;
    const res = await fetch(`/api/check-name?firstName=${encodeURIComponent(first)}&lastName=${encodeURIComponent(last)}`);
    const data = await res.json();
    setNameWarning(data.taken
      ? `A member called ${first} ${last} is already registered - please add a slightly different name to distinguish yourself from the other member, e.g. a middle name or initial, a nickname, or a shortened version (e.g. Dan instead of Daniel).`
      : ''
    );
  }

  function handleFirstNameBlur() {
    const normalized = toTitleCase(firstName);
    setFirstName(normalized);
    checkName(normalized, lastName);
  }

  function handleLastNameBlur() {
    const normalized = toTitleCase(lastName);
    setLastName(normalized);
    checkName(firstName, normalized);
  }

  async function handleEmailBlur() {
    if (!email.trim()) return;
    const res = await fetch(`/api/check-field?field=email&value=${encodeURIComponent(email)}`);
    const data = await res.json();
    setEmailWarning(data.taken ? 'An account with this email address already exists.' : '');
  }

  async function handlePhoneBlur() {
    if (!phone.trim()) return;
    const res = await fetch(`/api/check-field?field=phone&value=${encodeURIComponent(phone)}`);
    const data = await res.json();
    setPhoneWarning(data.taken ? 'This phone number is already registered to another account.' : '');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        phone: phone || undefined,
        gender,
        newPassword: newPassword || undefined,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    setSuccess('Profile updated successfully');
    setNewPassword('');
    setConfirmPassword('');
  }

  return (
    <form onSubmit={handleSubmit} onChange={() => setSuccess('')} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First name <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => { setFirstName(e.target.value); setNameWarning(''); }}
            onBlur={handleFirstNameBlur}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last name <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => { setLastName(e.target.value); setNameWarning(''); }}
            onBlur={handleLastNameBlur}
            required
            className={inputClass}
          />
        </div>
      </div>
      {nameWarning && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">{nameWarning}</p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setEmailWarning(''); }}
          onBlur={handleEmailBlur}
          required
          className={inputClass}
        />
        {emailWarning && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg mt-2">{emailWarning}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Phone number</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setPhoneWarning(''); }}
          onBlur={handlePhoneBlur}
          autoComplete="tel"
          placeholder="Optional - visible to your tournament members"
          className={inputClass}
        />
        {phoneWarning && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg mt-2">{phoneWarning}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">I play in <span className="text-red-500">*</span></label>
        <div className="grid grid-cols-2 gap-3">
          {(['mens', 'womens'] as const).map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => { setGender(val); setSuccess(''); }}
              className={`py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                gender === val
                  ? 'bg-green-900 border-green-900 text-white'
                  : 'border-gray-300 text-gray-500 hover:border-green-900 hover:text-green-900'
              }`}
            >
              {val === 'mens' ? "Men's singles" : "Women's singles"}
            </button>
          ))}
        </div>
      </div>

      <hr className="border-gray-100" />
      <p className="text-xs text-gray-400">Leave password fields blank to keep your current password</p>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
        <PasswordInput
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          inputClassName={inputClass}
          placeholder="Min. 8 characters"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
        <PasswordInput
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          inputClassName={inputClass}
          placeholder="Repeat new password"
        />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-green-900 hover:bg-green-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
      >
        {loading ? 'Saving...' : 'Save changes'}
      </button>

      {success && <p className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg text-center">{success}</p>}
    </form>
  );
}
