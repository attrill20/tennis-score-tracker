import { put, list, del } from '@vercel/blob';
import sql from '@/lib/db';

const BACKUP_PREFIX = 'backups/prod/';
const RETENTION_COUNT = 14; // keep the last 14 nightly backups (~2 weeks)

async function dumpTables() {
  const [profiles, tournaments, leagues, leaguePlayers, matches, disputes] = await Promise.all([
    sql`SELECT * FROM profiles`,
    sql`SELECT * FROM tournaments`,
    sql`SELECT * FROM leagues`,
    sql`SELECT * FROM league_players`,
    sql`SELECT * FROM matches`,
    sql`SELECT * FROM disputes`,
  ]);

  return { profiles, tournaments, leagues, league_players: leaguePlayers, matches, disputes };
}

async function pruneOldBackups() {
  const { blobs } = await list({
    prefix: BACKUP_PREFIX,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  const stale = blobs
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
    .slice(RETENTION_COUNT);

  if (stale.length > 0) {
    await del(stale.map((blob) => blob.url), { token: process.env.BLOB_READ_WRITE_TOKEN });
  }

  return stale.length;
}

// Nightly logical backup of prod, independent of Neon's own (short) history
// window. Only ever reads from prod and writes to Blob - never touches the
// database, so it carries none of the write risk the dev-sync job does.
export async function backupProdDatabase() {
  const dump = await dumpTables();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const blob = await put(`${BACKUP_PREFIX}${timestamp}.json`, JSON.stringify(dump), {
    access: 'private',
    addRandomSuffix: false,
    contentType: 'application/json',
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  const pruned = await pruneOldBackups();

  return {
    url: blob.url,
    tables: Object.keys(dump),
    rowCounts: Object.fromEntries(
      Object.entries(dump).map(([table, rows]) => [table, (rows as unknown[]).length])
    ),
    pruned,
  };
}
