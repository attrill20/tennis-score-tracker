import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import sql from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        const rows = await sql`
          SELECT id, email, full_name, password_hash, role
          FROM profiles
          WHERE email = ${credentials.email as string}
        `;

        const user = rows[0];
        if (!user) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password_hash as string
        );

        if (!passwordMatch) return null;

        return {
          id: user.id as string,
          email: user.email as string,
          name: user.full_name as string,
          role: user.role as 'super_admin' | 'admin' | 'member',
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: 'super_admin' | 'admin' | 'member' }).role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as 'super_admin' | 'admin' | 'member';
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
