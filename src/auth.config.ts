import type { NextAuthConfig } from "next-auth"

export default {
  providers: [],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id   = user.id
        token.role = (user as { role?: string }).role
      }
      return token
    },
    session({ session, token }) {
      if (token.id)   session.user.id   = token.id   as string
      if (token.role) session.user.role = token.role as string
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnLogin  = nextUrl.pathname === "/login"

      if (!isLoggedIn) {
        return isOnLogin ? true : false
      }
      if (isOnLogin) {
        return Response.redirect(new URL("/dashboard", nextUrl))
      }

      // TEACHER cannot reach /admin/* or /teachers/*
      const role = (auth.user as { role?: string }).role
      if (role === "TEACHER") {
        const restricted =
          nextUrl.pathname.startsWith("/admin") ||
          nextUrl.pathname.startsWith("/teachers")
        if (restricted) {
          return Response.redirect(new URL("/dashboard", nextUrl))
        }
      }

      return true
    },
  },
} satisfies NextAuthConfig
