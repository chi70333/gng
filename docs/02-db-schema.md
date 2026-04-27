# 02. DB Schema

## DBMS: PostgreSQL 16 (Neon)

선택 이유:
- 동시성(MVCC) 우수 → 트래픽 폭증 시 락 경합 적음
- JSONB로 가변 속성(상품 옵션 등) 유연 처리
- `pg_trgm` + `unaccent` 로 한글 부분검색 가능 (보조 인덱스용; 메인 검색은 Meilisearch)
- Neon: 서버리스, Vercel과 region 매칭 쉬움, 자동 브랜칭

## 설계 원칙

1. PK는 모두 `BigInt` (`@id @default(autoincrement())`).
2. soft delete: `deletedAt DateTime?`
3. audit: `createdAt`, `updatedAt`, 필요시 `createdBy`, `updatedBy`.
4. 금액: `Decimal @db.Decimal(12, 2)` — Float 금지.
5. 코드/상태: 문자열 + 화이트리스트 검증 (혹은 enum, 단 변경 빈번하면 코드테이블).
6. 가변 속성: `attributes Json` (JSONB).
7. 인덱스: 외래키, 자주 쓰는 WHERE/ORDER BY, 파셜 인덱스 활용.
8. 시간 컬럼: 모두 UTC 저장, 표시 시점에 KST 변환.

## 핵심 도메인

| 도메인 | 주요 테이블 |
|---|---|
| 회원 | `User`, `UserGrade`, `UserAddress`, `UserSocialAccount`, `UserPoint`, `UserPointHistory`, `UserLoginLog` |
| 상품 | `Product`, `ProductOption`, `ProductSku`, `ProductImage`, `Category`, `CategoryOnProduct`, `Brand`, `Inventory` |
| 가격/프로모션 | `Coupon`, `CouponIssue`, `Promotion`, `PriceRule` |
| 장바구니 | (Redis 기본) + `CartSnapshot` (백업/머지용) |
| 주문/결제 | `Order`, `OrderItem`, `OrderStatusHistory`, `Payment`, `Shipment`, `Refund` |
| 게시판/문의 | `Board`, `Post`, `Comment`, `Inquiry`, `ProductReview`, `ProductQna` |
| 시스템 | `Code`, `AuditLog`, `Notification`, `FileObject` |

## 비밀번호 마이그레이션

```prisma
model User {
  passwordHash       String?  // argon2id (신규)
  legacyPasswordHash String?  // 레거시 (md5/sha1/bcrypt 등)
  legacyPasswordAlgo String?  // 'md5' | 'sha1' | 'bcrypt' 등
}
```

첫 로그인 시:
1. `passwordHash` 있으면 argon2id로 검증.
2. 없으면 `legacyPasswordHash` 로 검증 → 성공 시 argon2id로 재해시 후 `passwordHash` 저장, legacy 컬럼 NULL.

## 인덱스 핵심 예시

```sql
CREATE INDEX idx_product_active ON "Product" ("status", "createdAt" DESC) WHERE "deletedAt" IS NULL;
CREATE INDEX idx_order_user ON "Order" ("userId", "createdAt" DESC);
CREATE INDEX idx_product_name_trgm ON "Product" USING gin ("name" gin_trgm_ops);
```

## 파티셔닝 (3개월 운영 후 검토)
- `Order`, `OrderItem`, `AuditLog`: 월별 RANGE 파티션
- `UserLoginLog`: 일별 + 90일 후 자동 DROP

## 마이그레이션 (legacy MySQL → Postgres)

도구: `pgloader` (1차 일괄) + 자체 ETL 스크립트(보정).
인코딩: euc-kr → UTF-8 변환 필요. 텍스트 컬럼은 `iconv` 적용.

ETL 단계:
1. 스키마 매핑 정의 (legacy 컬럼명 → 신규 모델)
2. 1차 dry-run (count/체크섬 비교)
3. 2차 실데이터 적재 (read-only 시점 잡고)
4. CDC(이중 쓰기 또는 Debezium)로 컷오버까지 동기화
5. 검증 → 컷오버 → 일정 기간 구 DB 보존
