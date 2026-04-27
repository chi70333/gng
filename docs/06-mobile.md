# 06. Mobile-First Guide

> 주 사용자는 모바일이다. 모든 페이지는 모바일에서 먼저 검증한다.

## 디자인 원칙

- **단일 반응형 코드베이스**. 기존 `/m/` 같은 별도 라우트 만들지 않는다.
- Tailwind 클래스는 모바일이 기본, `sm:` `md:` `lg:` 로 확장.
- 기준 뷰포트: **360 / 390 / 414 / 768 / 1280px**.
- 컨텐츠 폭은 항상 `max-w-screen-md` 이내(상품 상세는 `max-w-screen-sm`).

## 터치/인터랙션

- 터치 타겟 최소 **44×44px** (Tailwind: `min-h-11 min-w-11`).
- 버튼/링크 간 최소 8px gap.
- iOS Safari 입력시 자동 zoom 방지: input `font-size: 16px` 이상.
- pull-to-refresh, 스와이프 제스처가 충돌하지 않도록 모달은 `body` 스크롤 잠금.
- 키보드 올라올 때 입력칸 가려지지 않게 `scrollIntoView({ block: 'center' })`.

## 성능 (모바일 4G 기준)

| 지표 | 목표 |
|---|---|
| LCP | ≤ 2.5s |
| INP | ≤ 200ms |
| CLS | ≤ 0.1 |
| TTI | ≤ 3.5s |
| JS 초기 번들 | 페이지당 ≤ 170KB gzip |

전략:
- **Server Components 기본**, Client는 최소화.
- 동적 import (`next/dynamic`) + `ssr: false` 는 정말 필요한 곳만.
- `next/image`: `priority` 는 LCP 이미지 1개만, 나머지는 `loading="lazy"`.
- 폰트: `next/font/local` + 한글 서브셋, `display: 'swap'`.
- 상품 카드 리스트는 가상스크롤 (`@tanstack/react-virtual`) 검토.
- 결제 SDK는 `next/script` `strategy="lazyOnload"`.

## 이미지

- 업로드 시 서버에서 webp/avif 변환 후 R2 저장.
- 표시: `<Image fill sizes="(max-width: 768px) 100vw, 50vw" />` 처럼 `sizes` 필수.
- 상품 썸네일은 정사각 1:1, lossy webp 80%.
- placeholder는 `blur` + 4-6px LQIP.

## 폼/입력

- 기본 키보드 타입 명시:
  - 전화 `inputMode="tel"`
  - 이메일 `inputMode="email"`
  - 우편번호 `inputMode="numeric"`
  - 검색 `inputMode="search"`
- 자동완성: `autoComplete` 정확히 (`email`, `tel`, `street-address`, `postal-code`, `cc-number` 등).
- 한국 주소 검색은 다음(카카오) 우편번호 API + 모달.

## 네비게이션

- 하단 고정 탭바 (홈/카테고리/검색/장바구니/마이) 권장.
- 상단 헤더는 스크롤 시 sticky + 축소.
- 뒤로가기 시 스크롤 복원: `scroll-restoration: auto` 활용 + Next 기본 동작.

## 접근성

- 모든 인터랙티브 요소는 키보드 포커스 + ring 표시.
- 다크 모드는 1차 출시에서 제외(추후), 단 색상 대비 4.5:1 이상.
- VoiceOver/TalkBack 라벨 필수.

## 검증 체크리스트 (PR 머지 전)

- [ ] Chrome DevTools 360×640, 390×844, 412×915 에서 깨짐 없음
- [ ] Lighthouse 모바일 Performance ≥ 85
- [ ] 입력 시 zoom-in 없음
- [ ] 터치 타겟 44px 이상
- [ ] 이미지 sizes 지정
- [ ] 초기 JS bundle 170KB 이하
- [ ] 네트워크 Fast 3G 시뮬레이션에서 LCP ≤ 4s
