import { z } from 'zod';

export const boardCodeSchema = z
  .string()
  .trim()
  .min(2, '게시판을 찾을 수 없습니다.')
  .max(40)
  .regex(/^[a-z0-9_-]+$/, '게시판을 찾을 수 없습니다.');

export const postIdSchema = z.coerce.bigint();

export const publicPostFormSchema = z.object({
  id: z.coerce.bigint().optional(),
  boardCode: boardCodeSchema,
  authorName: z.string().trim().min(1, '작성자명을 입력해 주세요.').max(40),
  authorEmail: z
    .string()
    .trim()
    .email('이메일 형식을 확인해 주세요.')
    .optional()
    .or(z.literal('')),
  password: z.string().min(4, '비밀번호는 4자 이상 입력해 주세요.').max(100).optional().or(z.literal('')),
  title: z.string().trim().min(1, '제목을 입력해 주세요.').max(200),
  content: z.string().trim().min(1, '내용을 입력해 주세요.').max(20000),
  isSecret: z.coerce.boolean().default(false),
});

export const publicPostDeleteSchema = z.object({
  postId: postIdSchema,
  boardCode: boardCodeSchema,
  password: z.string().optional().or(z.literal('')),
});

export const commentFormSchema = z.object({
  postId: postIdSchema,
  boardCode: boardCodeSchema,
  authorName: z.string().trim().min(1, '작성자명을 입력해 주세요.').max(40),
  password: z.string().min(4, '비밀번호는 4자 이상 입력해 주세요.').max(100).optional().or(z.literal('')),
  content: z.string().trim().min(1, '댓글 내용을 입력해 주세요.').max(2000),
});

export const commentDeleteSchema = z.object({
  postId: postIdSchema,
  commentId: postIdSchema,
  boardCode: boardCodeSchema,
  password: z.string().optional().or(z.literal('')),
});

export const inquiryFormSchema = z.object({
  id: z.coerce.bigint().optional(),
  name: z.string().trim().min(1, '이름을 입력해 주세요.').max(40),
  email: z.string().trim().email('이메일 형식을 확인해 주세요.').max(120),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  password: z.string().min(4, '비밀번호는 4자 이상 입력해 주세요.').max(100).optional().or(z.literal('')),
  title: z.string().trim().min(1, '제목을 입력해 주세요.').max(200),
  content: z.string().trim().min(1, '문의 내용을 입력해 주세요.').max(20000),
});

export const inquiryDeleteSchema = z.object({
  inquiryId: postIdSchema,
  password: z.string().optional().or(z.literal('')),
});

export type PublicPostFormInput = z.infer<typeof publicPostFormSchema>;
export type CommentFormInput = z.infer<typeof commentFormSchema>;
export type InquiryFormInput = z.infer<typeof inquiryFormSchema>;
