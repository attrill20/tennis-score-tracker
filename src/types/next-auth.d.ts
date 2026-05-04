import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: 'super_admin' | 'admin' | 'member';
    };
  }

  interface User {
    role: 'super_admin' | 'admin' | 'member';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'super_admin' | 'admin' | 'member';
  }
}
