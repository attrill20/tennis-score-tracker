import { put, del } from '@vercel/blob';
import { auth } from '@/auth';
import sql from '@/lib/db';

export async function DELETE() {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await sql`SELECT avatar_url FROM profiles WHERE id = ${session.user.id}`;
  const avatarUrl = rows[0]?.avatar_url as string | null;

  if (avatarUrl) {
    try { await del(avatarUrl, { token: process.env.BLOB_READ_WRITE_TOKEN }); } catch { /* ignore */ }
  }

  await sql`UPDATE profiles SET avatar_url = NULL WHERE id = ${session.user.id}`;
  return Response.json({ success: true });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('avatar') as File | null;

  if (!file || file.size === 0) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    return Response.json({ error: 'Only JPEG, PNG, WebP or GIF files are allowed' }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: 'File too large - maximum size is 5MB' }, { status: 400 });
  }

  const rows = await sql`SELECT avatar_url FROM profiles WHERE id = ${session.user.id}`;
  const oldUrl = rows[0]?.avatar_url as string | null;

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');

  let blob;
  try {
    blob = await put(`avatars/${session.user.id}.${ext}`, file, {
      access: 'public',
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
  } catch (err) {
    console.error('Blob upload failed:', err);
    return Response.json({ error: (err as Error).message ?? 'Upload failed' }, { status: 500 });
  }

  await sql`UPDATE profiles SET avatar_url = ${blob.url} WHERE id = ${session.user.id}`;

  if (oldUrl && oldUrl !== blob.url) {
    try { await del(oldUrl); } catch { /* ignore if already gone */ }
  }

  return Response.json({ url: blob.url });
}
