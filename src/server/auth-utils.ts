import type { Session } from 'next-auth';

export function canViewMemberPrice(session: Session | null): boolean {
  return session?.user?.userKind === 'member';
}
