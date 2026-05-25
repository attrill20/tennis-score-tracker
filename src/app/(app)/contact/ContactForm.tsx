'use client';

import { useState } from 'react';

export default function ContactForm({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const body = isLoggedIn
      ? { subject, message }
      : { email, subject, message };

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong. Please try again.');
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="max-w-md sm:max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-green-200 p-8 text-center">
          <div className="text-4xl mb-3">&#10003;</div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Message sent</h2>
          <p className="text-sm text-gray-500">We'll get back to you as soon as possible.</p>
          <button
            onClick={() => { setSuccess(false); setEmail(''); setSubject(''); setMessage(''); }}
            className="mt-4 text-sm text-green-700 hover:underline"
          >
            Send another message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md sm:max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">Contact</h1>
      <p className="text-sm text-gray-500 mb-6">
        Get in touch with the site admin to ask any questions, report any issues or make suggestions
        to improve the site further. We will get back to you as soon as we can via email.
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {!isLoggedIn && (
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Your email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              placeholder="you@example.com"
            />
          </div>
        )}

        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
            Subject
          </label>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            placeholder="e.g. Query about my league"
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
            Message
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={5}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none"
            placeholder="Your message..."
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {loading ? 'Sending...' : 'Send message'}
        </button>
      </form>
    </div>
  );
}
