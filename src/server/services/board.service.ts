// Legacy sources: board_list.php, board_view.php, board_write.php,
// board_edit.php, board_comment_ajax.php, board_event_list.php, ask_list.php.
// Cache: public board lists use ISR/RSC cache 5m; write/edit/delete paths are no-cache.

import 'server-only';
import argon2 from 'argon2';
import { revalidatePath, revalidateTag, unstable_cache, unstable_noStore as noStore } from 'next/cache';
import { TTL } from '@/lib/cache';
import { prisma } from '@/server/db';
import { keys, redis } from '@/server/redis';
import { AuthError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import type {
  CommentFormInput,
  InquiryFormInput,
  PublicPostFormInput,
} from '@/schemas/board';

export type BoardPostSummary = {
  id: string;
  boardCode: string;
  title: string;
  authorName: string;
  isNotice: boolean;
  isSecret: boolean;
  createdAt: string;
  viewCount: number;
  commentCount: number;
};

export type BoardInfo = {
  code: string;
  name: string;
  type: string;
};

export type BoardListResult = {
  board: BoardInfo;
  posts: BoardPostSummary[];
};

export type BoardPostDetail = BoardPostSummary & {
  content: string;
  canEdit: boolean;
  comments: Array<{
    id: string;
    authorName: string;
    content: string;
    createdAt: string;
    canDelete: boolean;
  }>;
};

export type InquirySummary = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  answeredAt: string | null;
};

export type InquiryDetail = InquirySummary & {
  name: string;
  email: string;
  phone: string | null;
  content: string;
  answer: string | null;
  canEdit: boolean;
};

type SessionUser = {
  id?: string;
  email?: string | null;
  name?: string | null;
};

const argonOptions = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

function normalizeOptional(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanPassword(value?: string | null): string | null {
  return normalizeOptional(value);
}

async function hashPassword(password: string | null): Promise<string | null> {
  return password ? argon2.hash(password, argonOptions) : null;
}

async function verifyPassword(hash: string | null, password?: string | null): Promise<boolean> {
  if (!hash) return false;
  const clean = cleanPassword(password);
  if (!clean) return false;
  return argon2.verify(hash, clean);
}

async function getSessionUserId(sessionUser?: SessionUser): Promise<bigint | null> {
  if (sessionUser?.id) return BigInt(sessionUser.id);
  if (!sessionUser?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: sessionUser.email },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function getBoardByCode(code: string) {
  const board = await prisma.board.findFirst({
    where: { code, isActive: true },
    select: { id: true, code: true, name: true, type: true },
  });
  if (!board) throw new NotFoundError('게시판을 찾을 수 없습니다.');
  return board;
}

async function getBoardPosts(code: string, limit: number): Promise<BoardListResult> {
  const board = await getBoardByCode(code);
  const rows = await prisma.post.findMany({
    where: {
      boardId: board.id,
      deletedAt: null,
    },
    orderBy: [{ isNotice: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      title: true,
      authorName: true,
      isNotice: true,
      isSecret: true,
      createdAt: true,
      viewCount: true,
      _count: { select: { comments: { where: { deletedAt: null } } } },
    },
  });

  return {
    board: { code: board.code, name: board.name, type: board.type },
    posts: rows.map((row) => ({
      id: row.id.toString(),
      boardCode: board.code,
      title: row.title,
      authorName: row.authorName,
      isNotice: row.isNotice,
      isSecret: row.isSecret,
      createdAt: row.createdAt.toISOString(),
      viewCount: row.viewCount,
      commentCount: row._count.comments,
    })),
  };
}

export function getCachedBoardList(code: string, limit = 30): Promise<BoardListResult> {
  return unstable_cache(
    async () => {
      const cacheKey = keys.boardList(code, limit);
      const staleKey = `${cacheKey}:stale`;
      const refreshLockKey = `${cacheKey}:refresh-lock`;
      let staleValue: BoardListResult | null = null;
      let hasRefreshLock = false;

      try {
        const hit = await redis.get<BoardListResult>(cacheKey);
        if (hit) return hit;
        staleValue = await redis.get<BoardListResult>(staleKey);
        if (staleValue) {
          const lock = await redis.set(refreshLockKey, '1', {
            ex: TTL.REFRESH_LOCK,
            nx: true,
          });
          hasRefreshLock = lock === 'OK';
          if (!hasRefreshLock) return staleValue;
        }
      } catch (err) {
        // Redis는 보조 캐시이므로 실패해도 DB/Next cache 경로를 유지한다.
        console.warn('board Redis cache failed', err);
      }

      try {
        const value = await getBoardPosts(code, limit);
        redis
          .set(cacheKey, value, { ex: TTL.BOARD_LIST })
          .catch((err: unknown) => console.warn('board Redis set failed', err));
        redis
          .set(staleKey, value, { ex: TTL.STALE_READ })
          .catch((err: unknown) => console.warn('board stale Redis set failed', err));
        return value;
      } catch {
        if (staleValue) return staleValue;
        return {
          board: { code, name: code, type: 'default' },
          posts: [],
        };
      } finally {
        if (hasRefreshLock) {
          redis
            .del(refreshLockKey)
            .catch((err: unknown) => console.warn('board refresh lock cleanup failed', err));
        }
      }
    },
    [`board-list:${code}:${limit}`],
    { revalidate: TTL.BOARD_LIST, tags: [`board:${code}`] },
  )();
}

export async function getCachedBoardPosts(
  code: string,
  limit = 30,
): Promise<BoardPostSummary[]> {
  const result = await getCachedBoardList(code, limit);
  return result.posts;
}

export async function getBoardPostDetail(params: {
  boardCode: string;
  postId: bigint;
  password?: string | null;
  sessionUser?: SessionUser;
}): Promise<BoardPostDetail> {
  noStore();
  const sessionUserId = await getSessionUserId(params.sessionUser);
  const post = await prisma.post.findFirst({
    where: {
      id: params.postId,
      deletedAt: null,
      board: { code: params.boardCode, isActive: true },
    },
    select: {
      id: true,
      userId: true,
      authorName: true,
      title: true,
      content: true,
      isNotice: true,
      isSecret: true,
      password: true,
      createdAt: true,
      viewCount: true,
      board: { select: { code: true } },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          userId: true,
          authorName: true,
          content: true,
          password: true,
          createdAt: true,
        },
      },
      _count: { select: { comments: { where: { deletedAt: null } } } },
    },
  });
  if (!post) throw new NotFoundError('게시글을 찾을 수 없습니다.');

  const ownsPost = Boolean(sessionUserId && post.userId === sessionUserId);
  const passwordOk = await verifyPassword(post.password, params.password);
  if (post.isSecret && !ownsPost && !passwordOk) {
    throw new ForbiddenError('비밀글 비밀번호를 확인해 주세요.');
  }

  await prisma.post.update({
    where: { id: post.id },
    data: { viewCount: { increment: 1 } },
    select: { id: true },
  });

  return {
    id: post.id.toString(),
    boardCode: post.board.code,
    title: post.title,
    authorName: post.authorName,
    content: post.content,
    isNotice: post.isNotice,
    isSecret: post.isSecret,
    createdAt: post.createdAt.toISOString(),
    viewCount: post.viewCount + 1,
    commentCount: post._count.comments,
    canEdit: ownsPost || passwordOk,
    comments: post.comments.map((comment) => ({
      id: comment.id.toString(),
      authorName: comment.authorName,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      canDelete:
        Boolean(sessionUserId && comment.userId === sessionUserId) ||
        !comment.password,
    })),
  };
}

export async function savePublicPost(
  input: PublicPostFormInput,
  sessionUser?: SessionUser,
): Promise<{ id: string; boardCode: string }> {
  noStore();
  const board = await getBoardByCode(input.boardCode);
  const userId = await getSessionUserId(sessionUser);
  const password = cleanPassword(input.password);
  if (!userId && !password) {
    throw new ValidationError('비회원 글은 수정과 삭제를 위해 비밀번호가 필요합니다.');
  }

  const data = {
    boardId: board.id,
    userId,
    authorName: input.authorName,
    authorEmail: normalizeOptional(input.authorEmail),
    password: await hashPassword(password),
    title: input.title,
    content: input.content,
    isSecret: input.isSecret,
  };

  const post = input.id
    ? await updatePublicPost(input.id, data, password, userId)
    : await prisma.post.create({ data, select: { id: true } });

  revalidateTag(`board:${board.code}`);
  revalidatePath(`/board/${board.code}`);
  if (board.type === 'event') revalidatePath('/event');
  return { id: post.id.toString(), boardCode: board.code };
}

async function updatePublicPost(
  postId: bigint,
  data: {
    boardId: bigint;
    userId: bigint | null;
    authorName: string;
    authorEmail: string | null;
    password: string | null;
    title: string;
    content: string;
    isSecret: boolean;
  },
  plainPassword: string | null,
  sessionUserId: bigint | null,
) {
  const current = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
    select: { id: true, boardId: true, userId: true, password: true },
  });
  if (!current) throw new NotFoundError('게시글을 찾을 수 없습니다.');
  if (current.boardId !== data.boardId) throw new ForbiddenError('게시판을 변경할 수 없습니다.');

  const ownsPost = Boolean(sessionUserId && current.userId === sessionUserId);
  const passwordOk = await verifyPassword(current.password, plainPassword);
  if (!ownsPost && !passwordOk) throw new ForbiddenError('게시글 수정 권한이 없습니다.');

  return prisma.post.update({
    where: { id: current.id },
    data: {
      authorName: data.authorName,
      authorEmail: data.authorEmail,
      password: data.password ?? current.password,
      title: data.title,
      content: data.content,
      isSecret: data.isSecret,
    },
    select: { id: true },
  });
}

export async function deletePublicPost(params: {
  postId: bigint;
  boardCode: string;
  password?: string | null;
  sessionUser?: SessionUser;
}): Promise<void> {
  noStore();
  const sessionUserId = await getSessionUserId(params.sessionUser);
  const post = await prisma.post.findFirst({
    where: { id: params.postId, deletedAt: null, board: { code: params.boardCode } },
    select: { id: true, userId: true, password: true, board: { select: { code: true, type: true } } },
  });
  if (!post) throw new NotFoundError('게시글을 찾을 수 없습니다.');

  const ownsPost = Boolean(sessionUserId && post.userId === sessionUserId);
  const passwordOk = await verifyPassword(post.password, params.password);
  if (!ownsPost && !passwordOk) throw new ForbiddenError('게시글 삭제 권한이 없습니다.');

  await prisma.post.update({ where: { id: post.id }, data: { deletedAt: new Date() } });
  revalidateTag(`board:${post.board.code}`);
  revalidatePath(`/board/${post.board.code}`);
  if (post.board.type === 'event') revalidatePath('/event');
}

export async function createComment(
  input: CommentFormInput,
  sessionUser?: SessionUser,
): Promise<void> {
  noStore();
  const userId = await getSessionUserId(sessionUser);
  const password = cleanPassword(input.password);
  if (!userId && !password) {
    throw new ValidationError('비회원 댓글은 삭제를 위해 비밀번호가 필요합니다.');
  }

  const post = await prisma.post.findFirst({
    where: { id: input.postId, deletedAt: null, board: { code: input.boardCode } },
    select: { id: true },
  });
  if (!post) throw new NotFoundError('게시글을 찾을 수 없습니다.');

  await prisma.comment.create({
    data: {
      postId: post.id,
      userId,
      authorName: input.authorName,
      password: await hashPassword(password),
      content: input.content,
    },
  });
}

export async function deleteComment(params: {
  commentId: bigint;
  postId: bigint;
  boardCode: string;
  password?: string | null;
  sessionUser?: SessionUser;
}): Promise<void> {
  noStore();
  const sessionUserId = await getSessionUserId(params.sessionUser);
  const comment = await prisma.comment.findFirst({
    where: {
      id: params.commentId,
      postId: params.postId,
      deletedAt: null,
      post: { board: { code: params.boardCode } },
    },
    select: { id: true, userId: true, password: true },
  });
  if (!comment) throw new NotFoundError('댓글을 찾을 수 없습니다.');

  const ownsComment = Boolean(sessionUserId && comment.userId === sessionUserId);
  const passwordOk = await verifyPassword(comment.password, params.password);
  if (!ownsComment && !passwordOk) throw new ForbiddenError('댓글 삭제 권한이 없습니다.');

  await prisma.comment.update({ where: { id: comment.id }, data: { deletedAt: new Date() } });
}

export async function getMyInquiries(sessionUser?: SessionUser): Promise<InquirySummary[]> {
  noStore();
  if (!sessionUser?.email) return [];
  const userId = await getSessionUserId(sessionUser);
  const ownerFilters = userId
    ? [{ email: sessionUser.email }, { userId }]
    : [{ email: sessionUser.email }];

  const rows = await prisma.inquiry.findMany({
    where: { deletedAt: null, OR: ownerFilters },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { id: true, title: true, status: true, createdAt: true, answeredAt: true },
  });

  return rows.map((row) => ({
    id: row.id.toString(),
    title: row.title,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    answeredAt: row.answeredAt?.toISOString() ?? null,
  }));
}

export async function getInquiryDetail(params: {
  inquiryId: bigint;
  password?: string | null;
  sessionUser?: SessionUser;
}): Promise<InquiryDetail> {
  noStore();
  const sessionUserId = await getSessionUserId(params.sessionUser);
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: params.inquiryId, deletedAt: null },
    select: {
      id: true,
      userId: true,
      name: true,
      email: true,
      phone: true,
      password: true,
      title: true,
      content: true,
      status: true,
      answer: true,
      createdAt: true,
      answeredAt: true,
    },
  });
  if (!inquiry) throw new NotFoundError('문의를 찾을 수 없습니다.');

  const ownsInquiry =
    Boolean(sessionUserId && inquiry.userId === sessionUserId) ||
    Boolean(params.sessionUser?.email && inquiry.email === params.sessionUser.email);
  const passwordOk = await verifyPassword(inquiry.password, params.password);
  if (!ownsInquiry && !passwordOk) throw new AuthError('문의 비밀번호를 확인해 주세요.');

  return {
    id: inquiry.id.toString(),
    name: inquiry.name,
    email: inquiry.email,
    phone: inquiry.phone,
    title: inquiry.title,
    content: inquiry.content,
    status: inquiry.status,
    answer: inquiry.answer,
    createdAt: inquiry.createdAt.toISOString(),
    answeredAt: inquiry.answeredAt?.toISOString() ?? null,
    canEdit: ownsInquiry || passwordOk,
  };
}

export async function saveInquiry(
  input: InquiryFormInput,
  sessionUser?: SessionUser,
): Promise<{ id: string }> {
  noStore();
  const userId = await getSessionUserId(sessionUser);
  const password = cleanPassword(input.password);
  if (!userId && !password) {
    throw new ValidationError('비회원 문의는 수정과 삭제를 위해 비밀번호가 필요합니다.');
  }

  const data = {
    userId,
    name: input.name,
    email: input.email,
    phone: normalizeOptional(input.phone),
    password: await hashPassword(password),
    title: input.title,
    content: input.content,
    status: 'open',
    answer: null,
    answeredAt: null,
  };

  const inquiry = input.id
    ? await updateInquiry(input.id, data, password, userId, sessionUser)
    : await prisma.inquiry.create({ data, select: { id: true } });

  revalidatePath('/help/inquiries');
  return { id: inquiry.id.toString() };
}

async function updateInquiry(
  inquiryId: bigint,
  data: {
    userId: bigint | null;
    name: string;
    email: string;
    phone: string | null;
    password: string | null;
    title: string;
    content: string;
    status: string;
    answer: null;
    answeredAt: null;
  },
  plainPassword: string | null,
  sessionUserId: bigint | null,
  sessionUser?: SessionUser,
) {
  const current = await prisma.inquiry.findFirst({
    where: { id: inquiryId, deletedAt: null },
    select: { id: true, userId: true, email: true, password: true },
  });
  if (!current) throw new NotFoundError('문의를 찾을 수 없습니다.');

  const ownsInquiry =
    Boolean(sessionUserId && current.userId === sessionUserId) ||
    Boolean(sessionUser?.email && current.email === sessionUser.email);
  const passwordOk = await verifyPassword(current.password, plainPassword);
  if (!ownsInquiry && !passwordOk) throw new ForbiddenError('문의 수정 권한이 없습니다.');

  return prisma.inquiry.update({
    where: { id: current.id },
    data: { ...data, password: data.password ?? current.password },
    select: { id: true },
  });
}

export async function deleteInquiry(params: {
  inquiryId: bigint;
  password?: string | null;
  sessionUser?: SessionUser;
}): Promise<void> {
  noStore();
  const sessionUserId = await getSessionUserId(params.sessionUser);
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: params.inquiryId, deletedAt: null },
    select: { id: true, userId: true, email: true, password: true },
  });
  if (!inquiry) throw new NotFoundError('문의를 찾을 수 없습니다.');

  const ownsInquiry =
    Boolean(sessionUserId && inquiry.userId === sessionUserId) ||
    Boolean(params.sessionUser?.email && inquiry.email === params.sessionUser.email);
  const passwordOk = await verifyPassword(inquiry.password, params.password);
  if (!ownsInquiry && !passwordOk) throw new ForbiddenError('문의 삭제 권한이 없습니다.');

  await prisma.inquiry.update({ where: { id: inquiry.id }, data: { deletedAt: new Date() } });
  revalidatePath('/help/inquiries');
}
