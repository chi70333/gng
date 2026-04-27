import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & {
      id?: string;
      userKind?: 'member' | 'admin';
      adminRole?: string;
      permissions?: string[];
      sessionVersion?: number;
    };
  }

  interface User {
    userKind?: 'member' | 'admin';
    adminRole?: string;
    permissions?: string[];
    sessionVersion?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userKind?: 'member' | 'admin';
    adminRole?: string;
    permissions?: string[];
    sessionVersion?: number;
  }
}
