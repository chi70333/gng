# [GNG] 레거시 연동 API 간단 명세

> 현재 운영 전환 정책(2026-04-28 KST): `/api/gnp-api.php`, `/api/point_sync.php`는 레거시 호출자가 URL만 새 도메인으로 바꿔도 동작해야 하므로 API Token 검사를 임시 비활성화했다. `X-API-Key`, `Authorization`, `token` query가 없어도 처리한다.

## 공통

- 운영 도메인: `https://gng-gngshop.vercel.app`
- 응답 형식: JSON
- 캐시: `Cache-Control: no-store`
- 인증: 현재 임시 비활성화
- CORS: `Access-Control-Allow-Origin: *`

## 1. GNP API

### 기본 URL

```txt
https://gng-gngshop.vercel.app/api/gnp-api.php
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
| `userid` / `loginId` | 아니오 | 회원 아이디 조회조건 |
| `name` | 아니오 | 이름 조회조건 |
| `email` | 아니오 | 이메일 조회조건 |
| `hp` / `phone` | 아니오 | 휴대폰 번호 조회조건 |

`search`는 아이디/이름/이메일/휴대폰 통합검색으로 적용하고, `userid`, `name`, `email`, `hp` 같은 개별 요청 파라미터는 추가 조회조건으로 함께 적용한다.

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
https://gng-gngshop.vercel.app/api/point_sync.php
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

### 포인트 추가 적립

`action`이 `add`이고 `new_balance`가 없으면 현재 잔액에 `amount`를 더한다.

```http
POST /api/point_sync.php
Content-Type: application/json
```

Body:

```json
{
  "action": "add",
  "userid": "kakao-4858866013",
  "amount": 10000000,
  "reason": "일괄 포인트 수신 (+10,000,000P)"
}
```

성공 응답:

```json
{ "success": true, "message": "Point Synchronized Successfully" }
```

## 레거시와 다른 점

- 현재 운영 전환 기간에는 API Token 검사를 하지 않는다.
- `point_sync.php` 신규 구현은 `OPTIONS` preflight를 추가 지원한다.
- 신규 응답은 UTF-8 JSON 기준이다.
- 없는 회원의 포인트 동기화는 신규에서 `User not found`로 실패 처리한다.
