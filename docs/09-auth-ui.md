# 09. Auth UI Modernization

> **기능은 100% 동일하게 유지**하면서 UI만 현대화한다.
> 비즈니스 로직(`docs/03-legacy-map.md` P1 회원 항목)과 이 문서를 함께 참조할 것.

---

## 왜 이 문서가 필요한가

기존 auth 화면의 문제점:

| 레거시 패턴 | 문제 |
|---|---|
| `SCRIPT LANGUAGE="JavaScript"` + `alert()` | 구식, 모바일 UX 최악 (alert 블로킹) |
| `window.open()` 팝업 (아이디 찾기, 약관) | 모바일에서 팝업 차단·레이아웃 깨짐 |
| `opener.document.form.value =` | 팝업 의존 DOM 조작, 비표준 |
| 테이블 기반 레이아웃 | 반응형 불가 |
| `euc-kr` charset 메타태그 | 현대 브라우저 이상 동작 가능성 |
| `<meta http-equiv="X-UA-Compatible" content="IE=Edge">` | IE 잔재 |
| 카카오/네이버: 팝업 새창 → `curl_init()` 서버 토큰 교환 | 불안전 |
| 아이디 중복확인: 팝업 창 `idsearch.php` | 인라인 비동기로 대체 필요 |

**원칙: 팝업 → 인라인. alert → Toast/인라인 에러. 테이블 → Flex/Grid.**

---

## 1. 공통 컴포넌트 설계

모든 auth 페이지는 동일한 기반 위에 만든다.

### 1.1 AuthLayout

```
src/components/auth/AuthLayout.tsx
```

```
┌──────────────────────────────────┐  ← 모바일 기준 100vw, 최대 400px
│  [로고]                           │  ← 클릭 시 /
│                                  │
│  [페이지 제목]  (h1, text-xl bold) │
│  [서브 텍스트]  (text-sm neutral)  │
│                                  │
│  ┌────────────────────────────┐  │
│  │  컨텐츠 슬롯                │  │
│  └────────────────────────────┘  │
│                                  │
│  [하단 링크 영역]                 │
└──────────────────────────────────┘
```

- 배경은 흰색(라이트). 카드 구분 없이 전체 화면 사용(모바일).
- `md:` 이상에서는 중앙 카드 형태.

### 1.2 FormField 컴포넌트

```
src/components/auth/FormField.tsx
```

구성: `<label>` + `<input>` + 인라인 에러 메시지 + 우측 아이콘 슬롯

특성:
- `font-size: 16px` 강제 (iOS Safari 자동 zoom 방지)
- 에러 상태: 빨간 border + `role="alert"` 텍스트
- 포커스 링: `ring-2 ring-primary`
- 비밀번호: 우측 눈 아이콘으로 show/hide 토글

### 1.3 SocialLoginButton

```
src/components/auth/SocialLoginButton.tsx
```

|  | 카카오 | 네이버 |
|---|---|---|
| 배경색 | `#FEE500` | `#03C75A` |
| 글자색 | `#000000` | `#ffffff` |
| 아이콘 | 카카오 공식 SVG | 네이버 공식 SVG |
| 터치 타겟 | 44px 이상 | 44px 이상 |
| 텍스트 | "카카오로 계속하기" | "네이버로 계속하기" |

---

## 2. 로그인 페이지 (`/login`)

**레거시**: `login.php` — alert + `loginSendit()` JS + 팝업 아이디 찾기

### 화면 구조 (모바일 우선)

```
[AuthLayout]
  제목: "로그인"
  
  ─────────────────────────────
  [소셜 로그인 버튼 그룹]
    [카카오로 계속하기  ▶]       ← 황색 버튼, 전체 너비
    [네이버로 계속하기  ▶]       ← 초록 버튼, 전체 너비
  ─────────────────────────────
  
  [구분선]  ── 또는 ──
  
  [FormField] 아이디(이메일/아이디)
    inputMode="email", autoComplete="username"
    
  [FormField] 비밀번호
    type="password", autoComplete="current-password"
    우측: 👁 show/hide 토글 (44px 터치 타겟)
  
  [체크박스]  자동 로그인 (remember me)
  
  [버튼]  로그인   (전체 너비, h-12, 프라이머리)
  
  [링크 행]
    아이디 찾기  |  비밀번호 찾기  |  회원가입
    → 아이디/비밀번호 찾기는 팝업 대신 /account/recover 페이지로
```

### 변경 포인트 (레거시 대비)

| 레거시 | 신규 |
|---|---|
| `alert("아이디를 입력해 주십시오.")` | 인라인 에러 (`<p role="alert" className="text-red-500 text-sm">`) |
| `loginSendit()` → `form.submit()` | Server Action (`login` action) 또는 `<form>` POST |
| 카카오 팝업 새창 + JS | NextAuth.js `signIn('kakao')` redirect flow |
| 아이디 찾기 팝업 `searchId()` | 링크 → `/account/recover` (별도 페이지) |
| 로그인 실패 시 `alert()` | `sonner` toast 또는 form error state |

### 에러 처리

- 잘못된 아이디/비밀번호: 필드 에러 표시 (어느 쪽인지는 보안상 구분하지 않음 → "아이디 또는 비밀번호를 확인해 주세요.")
- 차단된 계정: 인라인 메시지 + 고객센터 링크
- 레이트리밋 초과: "잠시 후 다시 시도해 주세요. (N초)" 카운트다운

---

## 3. 회원가입 페이지 (`/join`)

**레거시**: `member_join.php` — 대형 HTML 폼, 팝업 약관, `joinSendit()` JS alert 검증

### 화면 구조: 스텝 분할

복잡한 단일 폼 대신 **3스텝 프로세스**로 분리 (모바일 UX 핵심).

```
[스텝 인디케이터]  ① 약관 → ② 정보입력 → ③ 완료
```

#### Step 1. 약관 동의

```
[약관 동의]

  ☑ 전체 동의
  ─────────────────
  ☑ (필수) 이용약관 동의          [전문 보기 ›]
  ☑ (필수) 개인정보 수집·이용 동의  [전문 보기 ›]
  ☐ (선택) 마케팅 수신 동의        [전문 보기 ›]
  ─────────────────
  
  [다음]  버튼 (필수 항목 미동의 시 disabled)
```

- 약관 전문은 **팝업이 아닌 인라인 펼치기** (accordion / sheet).
- "전체 동의" 체크 시 하위 전부 체크, 반대도 연동.
- 레거시의 `window.open('agree.php')` 팝업 제거.

#### Step 2. 정보 입력

```
[아이디]
  - 영문/숫자 조합, 6~16자
  - 입력 후 blur 또는 버튼 클릭 시 **인라인** 중복 확인
    "사용 가능한 아이디입니다 ✓" | "이미 사용 중인 아이디입니다 ✗"
  - 레거시의 팝업 idsearch.php → /api/auth/check-id?id= 비동기 GET

[비밀번호]
  - 8자 이상, 복잡도 안내 (인라인 강도 표시 바)
  - 👁 show/hide

[비밀번호 확인]
  - 실시간 일치 여부 표시

[이름]

[이메일]
  - 자유 입력 + 자동완성 제안 (naver.com, gmail.com, daum.net)

[휴대폰]
  - inputMode="tel"
  - 본인인증 또는 SMS 인증 버튼 (레거시 okname 본인인증 대응)

[생년월일]  (선택)
  - inputMode="numeric", 세 필드(년/월/일) or date picker

[성별]  (선택)
  - 라디오 버튼 (남/여/선택안함)

[추천인 아이디]  (선택)

[가입]  버튼
```

#### Step 3. 가입 완료

```
✅ 가입을 환영합니다!
"(이름)님, GNG 회원이 되셨습니다."

[쇼핑 시작하기]  →  /
[로그인하러 가기]  →  /login
```

### 변경 포인트 (레거시 대비)

| 레거시 | 신규 |
|---|---|
| 단일 거대 폼 | 3스텝 (약관 → 입력 → 완료) |
| 약관 팝업 `window.open('agree.php')` | 인라인 accordion/bottom sheet |
| 아이디 중복확인 팝업 `idsearch.php` | 인라인 비동기 (`/api/auth/check-id`) |
| `alert()` 검증 | 인라인 필드 에러 + zod 스키마 |
| 완료 후 새로고침 | `/join/complete` 전용 페이지 |
| 단계 없음 | 스텝 인디케이터로 진행 상황 표시 |

---

## 4. 아이디/비밀번호 찾기 (`/account/recover`)

**레거시**: `id_loss.php`, `idsearch.php` — `window.open` 팝업, 별도 작은 창

### 화면 구조: 탭 전환

```
[탭]  아이디 찾기  |  비밀번호 찾기

─── 아이디 찾기 탭 ───
  [이름]
  [이메일] 또는 [휴대폰] (라디오로 방법 선택)
  [찾기] 버튼
  → 결과: 인라인 표시 "가입하신 아이디는 xxx 입니다."

─── 비밀번호 찾기 탭 ───
  [아이디]
  [이메일] 또는 [휴대폰]
  [인증번호 발송] 버튼
  [인증번호 입력] + 타이머 (3분 카운트다운)
  [새 비밀번호] + [확인]
  [변경] 버튼
```

### 변경 포인트

| 레거시 | 신규 |
|---|---|
| `window.open()` 새창 팝업 | `/account/recover` 전용 페이지 |
| `opener.document.loginForm.userids.value =` | URL 파라미터 또는 세션 스토리지 전달 |
| 팝업 `self.close()` | 완료 후 `/login?prefill=xxxxx` redirect |
| 결과 새 창 `alert()` | 인라인 카드 표시 |

---

## 5. 소셜 로그인 연동 페이지

**레거시**: `social_login.php`, `oauth_naver.php`, `kakao_ajax.php` — curl 직접 OAuth 처리

신규는 **NextAuth.js** 가 흡수. 별도 페이지 필요 없음.

```ts
// src/server/auth.ts
providers: [
  KakaoProvider({ clientId: ..., clientSecret: ... }),
  NaverProvider({ clientId: ..., clientSecret: ... }),
]
```

#### 소셜 계정 미가입 → 가입 연결 흐름

```
소셜 로그인 최초 시 → 해당 이메일로 기존 계정 없으면:
  /join/social-connect 페이지로 이동 (레거시: social_join.php)
  
  "카카오 계정으로 간편 가입"
  이름: [소셜에서 받은 값, 수정 가능]
  이메일: [소셜에서 받은 값, 수정 가능]
  (선택) 휴대폰 인증
  [가입 완료] 버튼
```

---

## 6. 내 정보 수정 (`/mypage/profile`)

**레거시**: `mypage_member.php`, `mypage_member_ok.php`

### 화면 구조

```
[섹션] 기본 정보
  이름, 이메일, 휴대폰 (각 인라인 수정 or 수정 버튼)

[섹션] 비밀번호 변경
  현재 비밀번호
  새 비밀번호
  새 비밀번호 확인
  [변경] 버튼

[섹션] 연결된 소셜 계정
  카카오: 연결됨 / [연결해제]
  네이버: [연결하기]

[섹션] 알림 수신 설정
  마케팅 이메일 [toggle]
  SMS 수신 [toggle]

[섹션 하단, 빨간 텍스트]
  [회원 탈퇴]
```

---

## 7. 회원 탈퇴 (`/mypage/withdraw`)

**레거시**: 단순 링크/confirm

```
경고 문구 + 영향 항목 나열
(보유 쿠폰/포인트 소멸 등)

[비밀번호 확인] (소셜 전용 계정이면 생략)
[탈퇴 사유 선택] (선택)

[탈퇴하기] 버튼 (빨간 destructive 버튼)
  → 클릭 시 confirm modal ("정말 탈퇴하시겠습니까?")
  → 서버에서 개인정보 즉시 익명화 (PIPA 의무)
```

---

## 8. 구현 가이드

### 8.1 유효성 검사 원칙

- 실시간(blur): 필드 단위 에러
- 제출: 전체 필드 zod parse → 첫 번째 에러 스크롤
- `alert()` 절대 금지
- toast는 성공/서버에러 등 비-필드 메시지에만 (`sonner`)

### 8.2 로딩 상태

- 버튼: 제출 중 `disabled` + 스피너 아이콘 (Lucide `Loader2`)
- 비동기 중복확인: 인풋 우측 스피너
- Server Action의 `useFormStatus` 활용

### 8.3 상태 관리

- 폼 상태: `react-hook-form` + `@hookform/resolvers/zod`
- 스텝: `useState` (Zustand 불필요)
- 세션: NextAuth.js `useSession`

### 8.4 접근성

- 모든 폼 input: `id` + `<label htmlFor>` 연결
- 에러 메시지: `aria-describedby` + `role="alert"`
- 소셜 버튼: `aria-label="카카오로 로그인"`
- 비밀번호 토글: `aria-label="비밀번호 표시"` / `aria-label="비밀번호 숨기기"`
- 포커스 순서: tab 순서가 논리적이어야 함

### 8.5 레거시 비즈니스 로직 100% 보존 항목

| 항목 | 레거시 파일 | 신규 위치 |
|---|---|---|
| 아이디 차단 목록 (admin, test 등) | `member_join.php` JS 배열 + 서버 검증 | `schemas/auth.ts` zod + `services/auth/register.ts` |
| 가입 차단 IP/이메일 | `lib/join_block_check.php` | `services/auth/join-block.ts` (동일 로직) |
| 아이디 중복 확인 | `idsearch.php` | `/api/auth/check-id` Route Handler |
| 비밀번호 복잡도 규칙 | `member_join.php` JS | `schemas/auth.ts` zod refine |
| 소셜 로그인 가입/연결 분기 | `social_join.php`, `social_login.php` | NextAuth callbacks + `services/auth/social.ts` |
| 이메일/SMS 인증 흐름 | `smsmember.php`, `okname` | `services/auth/otp.ts` + Upstash QStash |
| 자동 로그인 (remember me) | `login_ok.php` 쿠키 | NextAuth session `maxAge` 조건부 |

---

## 9. 파일 구조 목표

```
src/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx                  AuthLayout
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── join/
│   │   │   ├── page.tsx                Step 1 (약관)
│   │   │   ├── info/page.tsx           Step 2 (정보 입력)
│   │   │   └── complete/page.tsx       Step 3 (완료)
│   │   ├── join/social-connect/
│   │   │   └── page.tsx
│   │   └── account/
│   │       └── recover/
│   │           └── page.tsx            탭: 아이디 찾기 / 비번 찾기
│   └── mypage/
│       ├── profile/page.tsx
│       └── withdraw/page.tsx
├── components/
│   └── auth/
│       ├── AuthLayout.tsx
│       ├── FormField.tsx
│       ├── PasswordInput.tsx           show/hide 포함
│       ├── SocialLoginButton.tsx
│       ├── StepIndicator.tsx
│       ├── TermsAccordion.tsx          약관 인라인 펼치기
│       └── IdCheckInput.tsx            인라인 중복 확인
├── schemas/
│   └── auth.ts                        zod (login/register/recover)
└── server/
    └── services/
        └── auth/
            ├── register.ts
            ├── login.ts
            ├── social.ts
            ├── otp.ts
            └── join-block.ts          legacy/join_block_check.php 로직 이식
```

---

## 10. UI 시안 참고 레퍼런스

구현 시 아래 스타일을 참고. shadcn/ui 컴포넌트 기반으로 구성.

- **로그인**: 카카오 계정 로그인 페이지, 당근마켓 로그인
- **회원가입**: 오늘의집, 무신사 가입 UX (스텝 + 인라인 검증)
- **찾기**: 네이버 아이디/비밀번호 찾기 (탭 전환, 인라인 결과)
- **공통**: `shadcn/ui` Button, Input, Label, Checkbox, Tabs, Accordion, Sheet

---

> 이 문서를 받은 에이전트는 **반드시 `AGENTS.md` 를 먼저 읽은 후** 작업을 시작해야 한다.
> 기능 변경 없이 UI만 교체. 동작이 달라지는 경우 이 문서에 먼저 기록하고 확인 후 진행.
