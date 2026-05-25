import { auth, signOut } from '@/auth';
import Navbar from './Navbar';
import Footer from '@/components/Footer';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user?.role === 'admin' || session?.user?.role === 'super_admin';
  const isSuperAdmin = session?.user?.role === 'super_admin';

  async function handleSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} signOut={handleSignOut} />
      <main className="max-w-4xl mx-auto px-4 py-6 w-full flex-1">{children}</main>
      <Footer />
    </div>
  );
}
