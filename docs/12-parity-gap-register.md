# 12. Legacy Parity Gap Register

> Updated: 2026-04-27 KST
> Purpose: track legacy-to-Next parity by field, validation, persistence, and follow-up behavior so a route is not marked complete while important customer behavior is still missing.

## Priority Rules

- P0: blocks signup, login, checkout, payment, or shipping.
- P1: causes customer support contact, account data loss, or repeated manual re-entry.
- P2: improves operational parity but does not block customer conversion.

## P1 Customer Conversion Audit

| Legacy PHP | Next route | 필드 | 필수 여부 | 검증 | 저장 위치 | 후속 동작 | 현재 상태 | 우선순위 |
|---|---|---|---|---|---|---|---|---|
| `member_join.php`, `member_join_ok.php` | `/join` | 아이디, 비밀번호, 이름, 이메일, 휴대전화 | 필수 | zod + DB unique | `User` | 가입 후 로그인 이동 | route done, core fields done | P0 |
| `member_join.php`, `member_join_ok.php` | `/join` | 우편번호, 주소, 상세주소 | 레거시 설정상 필수 가능, Next는 기본 필수 | zod + 우편번호 5자리 | `UserAddress` 기본 배송지 | 주문서 기본 배송지 자동 반영 | implemented in this pass | P0 |
| `member_join.php`, `member_join_ok.php` | `/join` | 메일링 수신, SMS 수신 | 선택 | `y/n` 정규화 | `User.marketingAgreedAt`, `User.smsAgreedAt` | 수신 동의 이력 보존 | implemented in this pass | P1 |
| `member_join.php`, `member_join_ok.php` | `/join` | 회사명, 대표자, 사업자번호, 업태, 종목, 사업장 주소 | 사업자회원 선택 시 필수 | zod 조건부 검증 | `User.memberType`, `UserBusinessProfile` | 사업자 회원 프로필 생성 | implemented in this pass | P1 |
| `social_join.php`, `social_join_ok.php` | `/join/social-connect` | 이름, 이메일, 휴대전화, 주소 | 필수 | zod | `User`, `UserAddress`, `UserSocialAccount` | 소셜 계정 연결 후 로그인 이동 | address/profile parity added; UX still basic | P0 |
| `social_join.php`, `social_join_ok.php` | `/join/social-connect` | 사업자 정보, 마케팅/SMS 수신 | 사업자 조건부/선택 | zod 조건부 검증 | `UserBusinessProfile`, consent timestamps | 소셜 가입도 일반 가입과 동일 정책 | implemented in this pass | P1 |
| `login.php`, `login_ok.php` | `/login`, NextAuth | 아이디 또는 이메일, 비밀번호 | 필수 | zod + argon2id/legacy hash | `User.lastLoginAt`, `User.loginCount` | 레거시 해시 첫 로그인 재해시 | route done, recover/id-check gaps remain | P1 |
| `order_sheet.php`, `order_table*.php` | `/order` | 주문자, 배송지, 연락처, 결제수단 | 필수 | zod | `Order`, `Payment`, `Shipment` | 주문 완료, 기본 배송지 사용 | route done; 가입 주소 연동 verified by data model | P0 |
| `mypage_addrs.php`, `mypage_addrs_ok.php` | `/mypage/addresses`, `/api/mypage/addresses` | 배송지명, 수령인, 연락처, 주소, 기본 여부 | 필수 | zod | `UserAddress` | 기본 배송지 정렬, 최대 10개 관리 | route done | P1 |
| `mypage_member.php`, `mypage_member_ok.php` | `/mypage/profile` | 이름, 이메일, 전화, 휴대전화, 비밀번호 변경, 마케팅 수신 | 필수/선택 혼합 | 미구현 | `User` | 회원정보 수정 | action missing | P1 |

## Next Audit Batches

| Batch | Scope | Output |
|---|---|---|
| Auth batch 2 | 아이디 찾기, 비밀번호 찾기, 가입 차단 IP/이메일, 아이디 중복 확인 | `/account/recover`, `/api/auth/check-id`, join-block service gap list |
| My page batch | 회원정보 수정, 탈퇴, 적립금, 쿠폰, 주문 상세 parity | field-level gap rows and tests |
| Admin customer batch | 회원 목록/수정, 사업자 정보, 배송지 조회 | admin parity rows and role checks |

## Acceptance Rule

A legacy route can be called complete only when all visible fields, server-side validation, persistence targets, and customer-visible follow-up behaviors have either been implemented or explicitly marked as intentionally removed with a reason.
