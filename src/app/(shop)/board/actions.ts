'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import {
  createComment,
  deleteComment,
  deletePublicPost,
  savePublicPost,
} from '@/server/services/board.service';
import {
  commentDeleteSchema,
  commentFormSchema,
  publicPostDeleteSchema,
  publicPostFormSchema,
} from '@/schemas/board';

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function savePostAction(formData: FormData) {
  const session = await auth();
  const parsed = publicPostFormSchema.parse({
    id: text(formData, 'id') || undefined,
    boardCode: text(formData, 'boardCode'),
    authorName: text(formData, 'authorName'),
    authorEmail: text(formData, 'authorEmail'),
    password: text(formData, 'password'),
    title: text(formData, 'title'),
    content: text(formData, 'content'),
    isSecret: formData.has('isSecret'),
  });
  const result = await savePublicPost(parsed, session?.user);
  redirect(`/board/${result.boardCode}/${result.id}`);
}

export async function deletePostAction(formData: FormData) {
  const session = await auth();
  const parsed = publicPostDeleteSchema.parse({
    postId: text(formData, 'postId'),
    boardCode: text(formData, 'boardCode'),
    password: text(formData, 'password'),
  });
  await deletePublicPost({ ...parsed, sessionUser: session?.user });
  redirect(`/board/${parsed.boardCode}`);
}

export async function createCommentAction(formData: FormData) {
  const session = await auth();
  const parsed = commentFormSchema.parse({
    postId: text(formData, 'postId'),
    boardCode: text(formData, 'boardCode'),
    authorName: text(formData, 'authorName'),
    password: text(formData, 'password'),
    content: text(formData, 'content'),
  });
  await createComment(parsed, session?.user);
  redirect(`/board/${parsed.boardCode}/${parsed.postId.toString()}`);
}

export async function deleteCommentAction(formData: FormData) {
  const session = await auth();
  const parsed = commentDeleteSchema.parse({
    postId: text(formData, 'postId'),
    commentId: text(formData, 'commentId'),
    boardCode: text(formData, 'boardCode'),
    password: text(formData, 'password'),
  });
  await deleteComment({ ...parsed, sessionUser: session?.user });
  redirect(`/board/${parsed.boardCode}/${parsed.postId.toString()}`);
}
