import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

export default auth((req: NextRequest & { auth: unknown }) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isAuthPage = pathname === '/login' || pathname === '/register' ||
    pathname === '/forgot-password' || pathname === '/reset-password' ||
    pathname === '/verify-email';

  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)'],
};
