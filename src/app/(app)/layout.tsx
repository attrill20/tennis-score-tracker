import { auth, signOut } from '@/auth';
import Link from 'next/link';
import AdminDropdown from './AdminDropdown';
import MobileNav from './MobileNav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'super_admin';
  const isSuperAdmin = session?.user?.role === 'super_admin';

  async function handleSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-green-900 text-white px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/qptc-logo.jpg" alt="QPTC" className="w-9 h-9 aspect-square shrink-0 rounded-full object-cover" />
            </Link>
            <Link href="/dashboard" className="font-semibold text-sm">
              Score Tracker
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4 text-sm">
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
              <AdminDropdown isSuperAdmin={isSuperAdmin} />
            )}
            <form action={handleSignOut}>
              <button type="submit" className="hover:text-green-300 transition-colors">
                Sign out
              </button>
            </form>
          </div>

          {/* Mobile burger menu */}
          <MobileNav isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} signOut={handleSignOut} />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
