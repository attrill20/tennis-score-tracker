import Link from 'next/link';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-green-900 bg-green-900">
      <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-white">
        <span>&copy; {year} Queen's Park Tennis Club</span>

        <Link
          href="/contact"
          className="px-3 py-1 rounded-full bg-white text-green-900 font-medium hover:bg-green-100 transition-colors"
        >
          Contact us
        </Link>

        <span>
          Made by{' '}
          <a
            href="https://github.com/attrill20"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white font-medium hover:underline"
          >
            James Attrill
          </a>
        </span>
      </div>
    </footer>
  );
}
