import { z } from 'zod';

export const adminBoardFormSchema = z.object({
  id: z.coerce.bigint().optional(),
  code: z.string().trim().min(2, '게시판 코드를 입력해주세요.').max(40),
  name: z.string().trim().min(1, '게시판명을 입력해주세요.').max(80),
  type: z.enum(['free', 'notice', 'event', 'faq']).default('free'),
  isActive: z.coerce.boolean().default(false),
  redirectTo: z.string().trim().optional(),
});

export const adminPostFormSchema = z.object({
  id: z.coerce.bigint().optional(),
  boardId: z.coerce.bigint(),
  title: z.string().trim().min(1, '제목을 입력해주세요.').max(200),
  content: z.string().trim().min(1, '내용을 입력해주세요.').max(20000),
  isNotice: z.coerce.boolean().default(false),
  isSecret: z.coerce.boolean().default(false),
  redirectTo: z.string().trim().optional(),
});

export const adminPostDeleteSchema = z.object({
  postId: z.coerce.bigint(),
  redirectTo: z.string().trim().optional(),
});

export const adminProductQnaAnswerSchema = z.object({
  qnaId: z.coerce.bigint(),
  answer: z.string().trim().min(1, '상품문의 답변을 입력해주세요.').max(20000),
  redirectTo: z.string().trim().optional(),
});

export const adminInquiryAnswerSchema = z.object({
  inquiryId: z.coerce.bigint(),
  answer: z.string().trim().min(1, '1:1 문의 답변을 입력해주세요.').max(20000),
  redirectTo: z.string().trim().optional(),
});
