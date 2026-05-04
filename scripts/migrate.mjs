import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

// Parse .env.local
const env = readFileSync('.env.local', 'utf8');
env.split('\n').forEach(line => {
  const match = line.match(/^([^#][^=]*)="?([^"]*)"?$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
});

const sql = neon(process.env.DATABASE_URL);

const statements = [
  // ENUM types — safe to re-run
  `DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'member');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    CREATE TYPE league_status AS ENUM ('upcoming', 'active', 'completed');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    CREATE TYPE match_status AS ENUM ('confirmed', 'disputed', 'overridden');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
    CREATE TYPE dispute_status AS ENUM ('open', 'resolved');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  // Tables
  `CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'member',
    strength_rating NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS leagues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    season_start DATE NOT NULL,
    season_end DATE NOT NULL,
    status league_status NOT NULL DEFAULT 'upcoming',
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS league_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    final_position INT,
    UNIQUE(league_id, player_id)
  )`,

  `CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    player1_id UUID NOT NULL REFERENCES profiles(id),
    player2_id UUID NOT NULL REFERENCES profiles(id),
    submitted_by UUID NOT NULL REFERENCES profiles(id),
    score_player1 INT NOT NULL,
    score_player2 INT NOT NULL,
    status match_status NOT NULL DEFAULT 'confirmed',
    played_at DATE NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    raised_by UUID NOT NULL REFERENCES profiles(id),
    reason TEXT NOT NULL,
    resolved_by UUID REFERENCES profiles(id),
    resolved_at TIMESTAMPTZ,
    status dispute_status NOT NULL DEFAULT 'open'
  )`,
];

async function migrate() {
  for (const stmt of statements) {
    await sql.query(stmt);
    const label = stmt.trim().split('\n')[0].substring(0, 60);
    console.log(`✓ ${label}`);
  }
  console.log('\nMigration complete!');
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
