'use client';

import { useMemo, useRef, useState, type PointerEvent } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useMemberSession } from '@/hooks/use-member-session';
import type { ProductImage } from '@/server/repositories/product.repository';

type GalleryImage = Pick<ProductImage, 'id' | 'url' | 'alt' | 'isMain'>;

type ProductImageGalleryProps = {
  productName: string;
  thumbnail: string | null;
  images: ProductImage[];
  discountPct: number;
};

export default function ProductImageGallery({
  productName,
  thumbnail,
  images,
  discountPct,
}: ProductImageGalleryProps) {
  const { isMember } = useMemberSession();
  const galleryImages = useMemo<GalleryImage[]>(() => {
    if (images.length > 0) return images;
    if (!thumbnail) return [];

    return [
      {
        id: 'thumbnail',
        url: thumbnail,
        alt: productName,
        isMain: true,
      },
    ];
  }, [images, productName, thumbnail]);

  const initialIndex = Math.max(
    0,
    galleryImages.findIndex((image) => image.isMain),
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const activeImage = galleryImages[activeIndex];
  const hasMultipleImages = galleryImages.length > 1;
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  function showPreviousImage() {
    setActiveIndex((current) =>
      current === 0 ? galleryImages.length - 1 : current - 1,
    );
  }

  function showNextImage() {
    setActiveIndex((current) =>
      current === galleryImages.length - 1 ? 0 : current + 1,
    );
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!hasMultipleImages || event.pointerType === 'mouse') return;
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic browser tests may not register an active pointer before dispatching.
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || !hasMultipleImages || event.pointerType === 'mouse') return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) {
      return;
    }

    if (deltaX < 0) {
      showNextImage();
    } else {
      showPreviousImage();
    }
  }

  return (
    <div className="w-full shrink-0 md:w-[420px]">
      <div
        className="relative aspect-square w-full touch-pan-y select-none overflow-hidden rounded-2xl bg-neutral-100"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          swipeStartRef.current = null;
        }}
        onLostPointerCapture={() => {
          swipeStartRef.current = null;
        }}
      >
        {activeImage ? (
          <Image
            src={activeImage.url}
            alt={activeImage.alt ?? productName}
            fill
            sizes="(max-width: 768px) 100vw, 420px"
            className="object-cover"
            draggable={false}
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-300">
            <Package size={48} aria-hidden="true" />
          </div>
        )}

        {isMember && discountPct > 0 && (
          <span className="absolute left-3 top-3 rounded-lg bg-red-500 px-2 py-1 text-sm font-bold text-white">
            {discountPct}% 할인
          </span>
        )}

        {hasMultipleImages && (
          <>
            <button
              type="button"
              aria-label="이전 상품 이미지"
              onClick={showPreviousImage}
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-sm transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="다음 상품 이미지"
              onClick={showNextImage}
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-sm transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2"
            >
              <ChevronRight size={22} aria-hidden="true" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-neutral-900/75 px-2.5 py-1 text-xs font-semibold text-white">
              {activeIndex + 1} / {galleryImages.length}
            </span>
          </>
        )}
      </div>

      {hasMultipleImages && (
        <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
          {galleryImages.map((image, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                key={image.id}
                type="button"
                aria-label={`${index + 1}번째 상품 이미지 보기`}
                aria-current={isActive ? 'true' : undefined}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-neutral-100 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2',
                  isActive ? 'border-neutral-900' : 'border-transparent',
                )}
              >
                <Image
                  src={image.url}
                  alt={image.alt ?? productName}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
