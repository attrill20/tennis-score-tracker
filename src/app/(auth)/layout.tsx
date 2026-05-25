import Footer from '@/components/Footer';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/qptc-logo.jpg"
              alt="Queens Park Tennis Club"
              className="w-32 h-32 aspect-square shrink-0 rounded-full object-cover"
            />
            <p className="mt-3 font-semibold text-green-900 text-lg">Score Tracker</p>
          </div>
          {children}
        </div>
      </div>
      <Footer />
    </div>
  );
}
