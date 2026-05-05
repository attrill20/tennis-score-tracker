import { auth } from '@/auth';
import sql from '@/lib/db';
import ProfileForm from './ProfileForm';

export default async function ProfilePage() {
  const session = await auth();

  const rows = await sql`
    SELECT title, first_name, last_name, email FROM profiles WHERE id = ${session!.user.id}
  `;
  const profile = rows[0];

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Your profile</h1>
      <ProfileForm
        initialTitle={(profile.title as string) ?? ''}
        initialFirstName={(profile.first_name as string) ?? ''}
        initialLastName={(profile.last_name as string) ?? ''}
        initialEmail={profile.email as string}
      />
    </div>
  );
}
