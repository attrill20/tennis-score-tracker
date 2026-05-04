export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/qptc-logo.jpg"
            alt="Queens Park Tennis Club"
            className="w-32 h-32 object-contain"
          />
        </div>
        {children}
      </div>
    </div>
  );
}
