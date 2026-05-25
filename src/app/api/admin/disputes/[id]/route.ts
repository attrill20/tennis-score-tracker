import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import sql from '@/lib/db';
import nodemailer from 'nodemailer';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== 'admin' && session?.user?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: disputeId } = await params;
  const { matchId, override, score_player1, score_player2, set_scores } = await req.json();

  if (override) {
    if (score_player1 === undefined || score_player2 === undefined) {
      return NextResponse.json({ error: 'Scores required for override' }, { status: 400 });
    }
    if (score_player1 === score_player2) {
      return NextResponse.json({ error: 'Scores cannot be a draw' }, { status: 400 });
    }
    await sql`
      UPDATE matches
      SET score_player1 = ${score_player1}, score_player2 = ${score_player2},
          set_scores = ${set_scores ? JSON.stringify(set_scores) : null},
          status = 'overridden'
      WHERE id = ${matchId}
    `;
  } else {
    await sql`UPDATE matches SET status = 'confirmed' WHERE id = ${matchId}`;
  }

  await sql`
    UPDATE disputes
    SET status = 'resolved', resolved_by = ${session.user.id}, resolved_at = NOW()
    WHERE id = ${disputeId}
  `;

  // Fetch match and player details for notification emails
  const matchRows = await sql`
    SELECT
      m.score_player1, m.score_player2, m.league_id,
      (p1.first_name || ' ' || p1.last_name) AS player1_name, p1.email AS player1_email,
      (p2.first_name || ' ' || p2.last_name) AS player2_name, p2.email AS player2_email,
      l.name AS league_name
    FROM matches m
    JOIN profiles p1 ON p1.id = m.player1_id
    JOIN profiles p2 ON p2.id = m.player2_id
    JOIN leagues l ON l.id = m.league_id
    WHERE m.id = ${matchId}
  `;
  const match = matchRows[0];

  if (match && process.env.CONTACT_EMAIL && process.env.CONTACT_EMAIL_PASSWORD) {
    const finalP1 = match.score_player1 as number;
    const finalP2 = match.score_player2 as number;
    const p1Name = match.player1_name as string;
    const p2Name = match.player2_name as string;
    const leagueName = match.league_name as string;
    const winner = finalP1 > finalP2 ? p1Name : p2Name;
    const outcomeText = override
      ? `The admin has reviewed the dispute and updated the score.`
      : `The admin has reviewed the dispute and confirmed the original score.`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.CONTACT_EMAIL,
        pass: process.env.CONTACT_EMAIL_PASSWORD,
      },
    });

    const emailFor = (recipientName: string, myScore: number, theirScore: number, opponentName: string) => `
      <p>Hi ${recipientName},</p>
      <p>${outcomeText}</p>
      <p>
        <strong>League:</strong> ${leagueName}<br/>
        <strong>Final score:</strong> ${recipientName} ${myScore} - ${theirScore} ${opponentName}<br/>
        <strong>Outcome:</strong> ${winner} wins
      </p>
      <p>You can view the match result in the <a href="${process.env.NEXTAUTH_URL ?? 'https://qptc.vercel.app'}">QPTC Score Tracker</a>.</p>
      <p>- QPTC Score Tracker</p>
    `;

    await Promise.allSettled([
      transporter.sendMail({
        from: `"QPTC Score Tracker" <${process.env.CONTACT_EMAIL}>`,
        to: match.player1_email as string,
        subject: `[QPTC] Dispute resolved - ${p1Name} vs ${p2Name}`,
        html: emailFor(p1Name, finalP1, finalP2, p2Name),
      }),
      transporter.sendMail({
        from: `"QPTC Score Tracker" <${process.env.CONTACT_EMAIL}>`,
        to: match.player2_email as string,
        subject: `[QPTC] Dispute resolved - ${p1Name} vs ${p2Name}`,
        html: emailFor(p2Name, finalP2, finalP1, p1Name),
      }),
    ]);
  }

  return NextResponse.json({ success: true });
}
