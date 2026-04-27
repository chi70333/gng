'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/server/auth';
import { deleteInquiry, saveInquiry } from '@/server/services/board.service';
import { inquiryDeleteSchema, inquiryFormSchema } from '@/schemas/board';

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function saveInquiryAction(formData: FormData) {
  const session = await auth();
  const parsed = inquiryFormSchema.parse({
    id: text(formData, 'id') || undefined,
    name: text(formData, 'name'),
    email: text(formData, 'email'),
    phone: text(formData, 'phone'),
    password: text(formData, 'password'),
    title: text(formData, 'title'),
    content: text(formData, 'content'),
  });
  const result = await saveInquiry(parsed, session?.user);
  redirect(`/help/inquiries/${result.id}`);
}

export async function deleteInquiryAction(formData: FormData) {
  const session = await auth();
  const parsed = inquiryDeleteSchema.parse({
    inquiryId: text(formData, 'inquiryId'),
    password: text(formData, 'password'),
  });
  await deleteInquiry({ ...parsed, sessionUser: session?.user });
  redirect('/help/inquiries');
}
