import { auth } from '@/auth';
import { signOut } from '@/auth';

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-green-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-green-800">QPTC Score Tracker</h1>
            <p className="text-green-600 text-sm mt-0.5">Welcome back, {session?.user?.name}</p>
          </div>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Sign out
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-green-100 p-8 text-center text-gray-400">
          <p className="text-lg font-medium text-gray-600">Dashboard coming soon</p>
          <p className="text-sm mt-1">Leagues and scores will appear here</p>
        </div>
      </div>
    </div>
  );
}
