'use client';

import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Heading2,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { adminSecondaryButtonClass } from '@/components/admin/AdminUI';
import { cn } from '@/lib/cn';

type PresignResponse =
  | {
      ok: true;
      data: {
        key: string;
        uploadUrl: string;
        publicUrl: string;
        headers: Record<string, string>;
      };
    }
  | {
      ok: false;
      error: { message: string };
    };

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

function toolbarButtonClass(isActive = false) {
  return cn(
    adminSecondaryButtonClass,
    'h-10 w-10 px-0 md:h-9 md:w-9',
    isActive && 'border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800',
  );
}

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function ProductDescriptionEditor({
  name,
  initialValue,
}: {
  name: string;
  initialValue: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);
  const [imageKeys, setImageKeys] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        autolink: true,
        defaultProtocol: 'https',
        openOnClick: false,
        protocols: ['http', 'https', 'mailto', 'tel'],
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          loading: 'lazy',
        },
      }),
    ],
    content: initialValue || '<p></p>',
    editorProps: {
      attributes: {
        'aria-label': '상품 상세 설명',
        class:
          'min-h-[320px] outline-none text-sm leading-6 text-neutral-950 [&_a]:font-semibold [&_a]:text-blue-700 [&_blockquote]:border-l-4 [&_blockquote]:border-neutral-300 [&_blockquote]:pl-3 [&_blockquote]:text-neutral-600 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-extrabold [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-extrabold [&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      setValue(currentEditor.getHTML());
    },
  });

  function runEditorCommand(action: () => void) {
    if (!editor) return;
    action();
    setValue(editor.getHTML());
  }

  function setLink() {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const nextUrl = window.prompt('연결할 URL을 입력하세요.', previousUrl ?? '');
    if (nextUrl === null) return;

    const normalized = normalizeUrl(nextUrl);
    if (!normalized) {
      runEditorCommand(() => editor.chain().focus().extendMarkRange('link').unsetLink().run());
      return;
    }
    runEditorCommand(() =>
      editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run(),
    );
  }

  async function uploadImage(file: File | undefined) {
    if (!file || !editor) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('jpg, png, webp, avif, gif 이미지만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('이미지는 10MB 이하로 업로드해 주세요.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const presignResponse = await fetch('/api/admin/product-images/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      const presign = (await presignResponse.json()) as PresignResponse;
      if (!presign.ok) throw new Error(presign.error.message);

      const uploadResponse = await fetch(presign.data.uploadUrl, {
        method: 'PUT',
        headers: presign.data.headers,
        body: file,
      });
      if (!uploadResponse.ok) throw new Error('CDN 업로드에 실패했습니다.');

      const alt = file.name.replace(/\.[^.]+$/, '');
      runEditorCommand(() =>
        editor
          .chain()
          .focus()
          .setImage({
            src: presign.data.publicUrl,
            alt,
            title: alt,
          })
          .run(),
      );
      setImageKeys((current) => [...current, presign.data.key]);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : '이미지 업로드에 실패했습니다.',
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <textarea name={name} value={value} readOnly hidden />
      {imageKeys.map((key) => (
        <input key={key} type="hidden" name="descriptionImageKeys" value={key} />
      ))}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          uploadImage(file);
        }}
      />

      <div className="flex flex-wrap gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 p-2">
        <button
          type="button"
          className={toolbarButtonClass(editor?.isActive('bold'))}
          title="굵게"
          aria-label="굵게"
          onClick={() => runEditorCommand(() => editor?.chain().focus().toggleBold().run())}
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass(editor?.isActive('italic'))}
          title="기울임"
          aria-label="기울임"
          onClick={() => runEditorCommand(() => editor?.chain().focus().toggleItalic().run())}
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass(editor?.isActive('underline'))}
          title="밑줄"
          aria-label="밑줄"
          onClick={() => runEditorCommand(() => editor?.chain().focus().toggleUnderline().run())}
        >
          <UnderlineIcon size={16} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass(editor?.isActive('heading', { level: 2 }))}
          title="제목"
          aria-label="제목"
          onClick={() =>
            runEditorCommand(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())
          }
        >
          <Heading2 size={16} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass(editor?.isActive('blockquote'))}
          title="인용"
          aria-label="인용"
          onClick={() => runEditorCommand(() => editor?.chain().focus().toggleBlockquote().run())}
        >
          <Quote size={16} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass(editor?.isActive('bulletList'))}
          title="글머리 목록"
          aria-label="글머리 목록"
          onClick={() => runEditorCommand(() => editor?.chain().focus().toggleBulletList().run())}
        >
          <List size={16} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass(editor?.isActive('orderedList'))}
          title="번호 목록"
          aria-label="번호 목록"
          onClick={() => runEditorCommand(() => editor?.chain().focus().toggleOrderedList().run())}
        >
          <ListOrdered size={16} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass(editor?.isActive('link'))}
          title="링크"
          aria-label="링크"
          onClick={setLink}
        >
          <LinkIcon size={16} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass()}
          title="상세 이미지 추가"
          aria-label="상세 이미지 추가"
          disabled={uploading || !editor}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus size={16} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass()}
          title="서식 지우기"
          aria-label="서식 지우기"
          onClick={() =>
            runEditorCommand(() => editor?.chain().focus().unsetAllMarks().clearNodes().run())
          }
        >
          <RemoveFormatting size={16} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass()}
          title="되돌리기"
          aria-label="되돌리기"
          onClick={() => runEditorCommand(() => editor?.chain().focus().undo().run())}
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass()}
          title="다시 실행"
          aria-label="다시 실행"
          onClick={() => runEditorCommand(() => editor?.chain().focus().redo().run())}
        >
          <Redo2 size={16} />
        </button>
      </div>

      <div className="rounded-md border border-neutral-300 bg-white px-3 py-3 shadow-inner shadow-neutral-950/[0.025] transition focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <EditorContent editor={editor} />
      </div>
      {uploading ? (
        <p className="text-xs font-semibold text-neutral-500">상세 이미지를 업로드하는 중입니다.</p>
      ) : null}
      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
