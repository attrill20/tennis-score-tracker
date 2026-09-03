import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import { isValidAbilityLevel, validateAnswers, type RegistrationQuestion } from '@/lib/registration';

export async function POST(req: NextRequest, { params }: { params: Promise<{ tournamentId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tournamentId } = await params;
  const body = await req.json();
  const { abilityLevel, answers } = body;

  const [tournament] = await sql`
    SELECT format, status, has_registration_form, max_registrations, registration_questions
    FROM tournaments WHERE id = ${tournamentId}
  `;
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  if (!tournament.has_registration_form) {
    return NextResponse.json({ error: 'This tournament does not have a registration form' }, { status: 400 });
  }
  if (tournament.status !== 'upcoming') {
    return NextResponse.json({ error: 'Registration is closed for this tournament' }, { status: 400 });
  }

  if (!isValidAbilityLevel(abilityLevel)) {
    return NextResponse.json({ error: 'Please select your ability level' }, { status: 400 });
  }

  const questions = (tournament.registration_questions as RegistrationQuestion[] | null) ?? [];
  const cleanedAnswers = validateAnswers(questions, answers ?? {});
  if (cleanedAnswers === 'invalid') {
    return NextResponse.json({ error: 'Please answer all required questions' }, { status: 400 });
  }

  const [existing] = await sql`
    SELECT id, assigned_league_id FROM tournament_registrations
    WHERE tournament_id = ${tournamentId} AND player_id = ${session.user.id}
  `;
  if (existing?.assigned_league_id) {
    return NextResponse.json({ error: "You've already been placed into a division - contact an admin if this needs to change" }, { status: 400 });
  }

  if (!existing && tournament.format === 'multi' && tournament.max_registrations !== null) {
    const [{ count }] = await sql`SELECT COUNT(*) FROM tournament_registrations WHERE tournament_id = ${tournamentId}`;
    if (Number(count) >= Number(tournament.max_registrations)) {
      return NextResponse.json({ error: 'Registration is full for this tournament' }, { status: 400 });
    }
  }

  await sql`
    INSERT INTO tournament_registrations (tournament_id, player_id, ability_level, answers)
    VALUES (${tournamentId}, ${session.user.id}, ${abilityLevel}, ${JSON.stringify(cleanedAnswers)})
    ON CONFLICT (tournament_id, player_id) DO UPDATE SET
      ability_level = EXCLUDED.ability_level,
      answers = EXCLUDED.answers,
      updated_at = now()
  `;

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ tournamentId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { tournamentId } = await params;

  const [tournament] = await sql`SELECT status FROM tournaments WHERE id = ${tournamentId}`;
  if (!tournament) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
  if (tournament.status !== 'upcoming') {
    return NextResponse.json({ error: 'You can only withdraw a registration while the tournament is upcoming' }, { status: 400 });
  }

  const [existing] = await sql`
    SELECT assigned_league_id FROM tournament_registrations
    WHERE tournament_id = ${tournamentId} AND player_id = ${session.user.id}
  `;
  if (!existing) return NextResponse.json({ error: 'You are not registered for this tournament' }, { status: 400 });
  if (existing.assigned_league_id) {
    return NextResponse.json({ error: "You've already been placed into a division - contact an admin if you need to withdraw" }, { status: 400 });
  }

  await sql`DELETE FROM tournament_registrations WHERE tournament_id = ${tournamentId} AND player_id = ${session.user.id}`;

  return NextResponse.json({ success: true });
}
