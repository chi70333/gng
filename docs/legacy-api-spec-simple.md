# [GNG] 레거시 연동 API 간단 명세

## 공통

- 응답 형식: JSON
- 캐시: `Cache-Control: no-store`
- 인증: `LEGACY_API_TOKEN` 값과 일치해야 함
- 인증 전달 방식:
  - Header: `X-API-Key: <token>`
  - Header: `Authorization: Bearer <token>`
  - Query: `?token=<token>` 또는 `?api_key=<token>` 또는 `?key=<token>`
- 인증 실패:

```json
{ "success": false, "message": "Unauthorized Access: Key Mismatch" }
```

## 1. GNP API

### 기본 URL

```txt
/api/gnp-api.php
```

### 회원 목록 조회

```http
GET /api/gnp-api.php?action=list_members&page=1&limit=50&search=hong
```

Query:

| 이름 | 필수 | 설명 |
|---|---:|---|
| `action` | 예 | `list_members` |
| `page` | 아니오 | 페이지 번호, 기본값 `1` |
| `limit` | 아니오 | 조회 개수, 기본값 `50`, 최대 `200` |
| `search` | 아니오 | 아이디/이름/이메일/휴대폰 검색어 |

성공 응답:

```json
{
  "success": true,
  "total": 1,
  "page": 1,
  "limit": 50,
  "members": [
    {
      "userid": "hong01",
      "name": "홍길동",
      "email": "hong@example.com",
      "hp": "01012345678",
      "mileage": 1200,
      "regdate": "2026-04-26T00:00:00.000Z"
    }
  ]
}
```

잘못된 action:

```json
{ "success": false, "message": "No Action" }
```

### 회원 등록

```http
POST /api/gnp-api.php?action=register_member
Content-Type: application/json
```

Body:

```json
{
  "userid": "hong01",
  "password": "Password123!",
  "name": "홍길동",
  "email": "hong@example.com",
  "hp": "010-1234-5678"
}
```

성공 응답:

```json
{ "success": true }
```

실패 응답:

```json
{ "success": false, "message": "Missing fields" }
```

```json
{ "success": false, "message": "Already exists" }
```

### 포인트 동기화

```http
POST /api/gnp-api.php
Content-Type: application/json
```

Body:

```json
{
  "userid": "hong01",
  "amount": 500,
  "new_balance": 1700,
  "reason": "외부 포인트 연동"
}
```

성공 응답:

```json
{ "success": true, "message": "Success" }
```

실패 응답:

```json
{ "success": false, "message": "User not found" }
```

## 2. Point Sync API

### 기본 URL

```txt
/api/point_sync.php
```

### 회원 목록 조회

```http
GET /api/point_sync.php?action=list_members&page=1&limit=50&search=hong
```

응답 형식은 `/api/gnp-api.php?action=list_members`와 동일하다.

잘못된 action:

```json
{ "success": false, "message": "No valid action or data provided." }
```

### 회원 등록

```http
POST /api/point_sync.php?action=register_member
Content-Type: application/json
```

Body:

```json
{
  "userid": "hong01",
  "password": "Password123!",
  "name": "홍길동",
  "email": "hong@example.com",
  "hp": "010-1234-5678"
}
```

성공 응답:

```json
{ "success": true, "message": "Member registered successfully" }
```

실패 응답:

```json
{ "success": false, "message": "Missing required fields (userid, password)" }
```

```json
{ "success": false, "message": "User already exists" }
```

### 포인트 동기화

```http
POST /api/point_sync.php
Content-Type: application/json
```

Body:

```json
{
  "userid": "hong01",
  "amount": 500,
  "new_balance": 1700,
  "reason": "외부 포인트 연동"
}
```

성공 응답:

```json
{ "success": true, "message": "Point Synchronized Successfully" }
```

실패 응답:

```json
{ "success": false, "message": "User not found" }
```

## 레거시와 다른 점

- `gnp-api.php` 레거시는 API Key가 틀려도 실제 차단하지 않았지만, 신규는 보안상 `401`로 차단한다.
- `point_sync.php` 신규는 `OPTIONS` preflight를 추가 지원한다.
- 신규 응답은 UTF-8 JSON 기준이다.
- 없는 회원의 포인트 동기화는 신규에서 `User not found`로 실패 처리한다.
