import { auth } from '@/auth';
import sql from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import RegistrationForm from '@/components/RegistrationForm';
import type { RegistrationQuestion } from '@/lib/registration';

export default async function TournamentRegisterPage({ params }: { params: Promise<{ tournamentId: string }> }) {
  const { tournamentId } = await params;
  const session = await auth();
  if (!session) redirect('/login');
  const userId = session.user.id;

  const [tournament] = await sql`
    SELECT id, name, format, status, has_registration_form, max_registrations, registration_questions
    FROM tournaments WHERE id = ${tournamentId}
  `;
  if (!tournament || !tournament.has_registration_form) notFound();

  const [profile] = await sql`SELECT first_name, last_name, phone, email FROM profiles WHERE id = ${userId}`;

  const [registration] = await sql`
    SELECT r.*, l.name AS assigned_league_name
    FROM tournament_registrations r
    LEFT JOIN leagues l ON l.id = r.assigned_league_id
    WHERE r.tournament_id = ${tournamentId} AND r.player_id = ${userId}
  `;

  let registrationCount = 0;
  if (tournament.format === 'multi' && tournament.max_registrations !== null) {
    const [{ count }] = await sql`SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id = ${tournamentId}`;
    registrationCount = Number(count);
  }
  const isFull = tournament.max_registrations !== null && registrationCount >= Number(tournament.max_registrations) && !registration;
  const questions = (tournament.registration_questions as RegistrationQuestion[] | null) ?? [];

  const backHref = tournament.format === 'multi' ? `/tournaments/multi/${tournament.id}` : '/tournaments';

  return (
    <div>
      <Link href={backHref} className="text-sm text-green-700 hover:underline">&larr; Back to {tournament.name as string}</Link>
      <h1 className="text-2xl font-bold text-gray-800 mt-2 mb-1">Register for {tournament.name as string}</h1>

      {tournament.status !== 'upcoming' ? (
        <p className="mt-4 text-sm text-gray-500 bg-white border border-gray-200 rounded-xl p-4">
          Registration for this tournament is no longer open.
        </p>
      ) : registration?.assigned_league_id ? (
        <p className="mt-4 text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl p-4">
          You&apos;ve been placed in <span className="font-medium">{registration.assigned_league_name as string}</span>.
        </p>
      ) : isFull ? (
        <p className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-4">
          Registration is full for this tournament.
        </p>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">
            Tell us a bit about your tennis so we can place you in the right division. You can edit this until an admin assigns you to your starting division.
          </p>
          <RegistrationForm
            tournamentId={tournament.id as string}
            profile={{
              fullName: `${profile.first_name as string} ${profile.last_name as string}`,
              phone: (profile.phone as string | null) ?? null,
              email: profile.email as string,
            }}
            questions={questions}
            redirectHref={backHref}
            initial={registration ? {
              abilityLevel: registration.ability_level as string,
              answers: (registration.answers as Record<string, string> | null) ?? {},
            } : null}
          />
        </>
      )}
    </div>
  );
}
