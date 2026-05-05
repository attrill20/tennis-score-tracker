import { auth, signOut } from '@/auth';
import Link from 'next/link';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'super_admin';

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-green-900 text-white px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/qptc-logo.jpg" alt="QPTC" className="w-9 h-9 rounded-full object-cover" />
            <Link href="/dashboard" className="font-semibold text-sm">
              Score Tracker
            </Link>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <Link href="/leagues" className="hover:text-green-300 transition-colors">
              Leagues
            </Link>
            <Link href="/profile" className="hover:text-green-300 transition-colors">
              Profile
            </Link>
            <Link href="/contact" className="hover:text-green-300 transition-colors">
              Contact
            </Link>
            {isAdmin && (
              <div className="relative group">
                <button className="hover:text-green-300 transition-colors">Admin ▾</button>
                <div className="absolute right-0 top-6 hidden group-hover:flex flex-col bg-green-900 border border-green-700 rounded-lg overflow-hidden min-w-36 z-10 shadow-lg">
                  <Link href="/admin/leagues" className="px-4 py-2.5 text-sm hover:bg-green-800 transition-colors">Leagues</Link>
                  <Link href="/admin/disputes" className="px-4 py-2.5 text-sm hover:bg-green-800 transition-colors">Disputes</Link>
                  {session?.user?.role === 'super_admin' && (
                    <Link href="/admin/users" className="px-4 py-2.5 text-sm hover:bg-green-800 transition-colors">Users</Link>
                  )}
                </div>
              </div>
            )}
            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button type="submit" className="hover:text-green-300 transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
