import { DUMMY_PASSWORD } from "@/lib/constants";
import { createOAuthUser, getUser } from "@/lib/db/queries";
import { compare } from "bcrypt-ts";
import type { Account, Profile } from "next-auth";
import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { authConfig } from "./auth.config";

export type UserType = "regular";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    type: UserType;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET
  }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials.email ?? "");
        const password = String(credentials.password ?? "");
        const users = await getUser(email);

        if (users.length === 0) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const [user] = users;

        if (!user.password) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const passwordsMatch = await compare(password, user.password);

        if (!passwordsMatch) {
          return null;
        }

        return { ...user, type: "regular" };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") {
        return true;
      }

      const email = user.email?.trim();

      if (!email) {
        return false;
      }

      const resolvedUser = await resolveGoogleUser({
        user,
        account,
        profile,
      });

      user.id = resolvedUser.id;
      user.email = resolvedUser.email;
      user.name = resolvedUser.name ?? user.name ?? null;
      user.image = resolvedUser.image ?? user.image ?? null;
      user.type = "regular";

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
      }

      return session;
    },
  },
});

async function resolveGoogleUser({
  user,
  account,
  profile,
}: {
  user: {
    email?: string | null;
    name?: string | null;
    image?: string | null;
  };
  account?: Account | null;
  profile?: Profile;
}) {
  if (account?.provider !== "google") {
    throw new Error("Unsupported OAuth provider");
  }

  const email = user.email?.trim();

  if (!email) {
    throw new Error("Google account did not provide an email address");
  }

  const existingUsers = await getUser(email);
  const [existingUser] = existingUsers;

  if (existingUser) {
    return {
      id: existingUser.id,
      email: existingUser.email,
      name: existingUser.name,
      image: existingUser.image,
    };
  }

  return createOAuthUser({
    email,
    name: user.name ?? profile?.name ?? null,
    image: user.image ?? null,
  });
}
