# GNP/point_sync 응답 비교표

현재 운영 전환 정책(2026-04-28 KST): URL만 변경하는 레거시 호출 호환을 우선하여 `/api/gnp-api.php`, `/api/point_sync.php`의 API Token 검사를 임시 비활성화했다. 따라서 현재 `/api/legacy/gnp-api`, `/api/legacy/point-sync`는 `X-API-Key`/`Authorization`/query token 없이도 처리한다.

실제 파트너 API 키 값은 코드, 문서, 테스트 fixture에 기록하지 않는다. 신규 구현은 인증 재활성화 시 `LEGACY_API_TOKEN` 환경변수만 읽도록 되돌린다. 레거시 PHP 원본에 남아 있는 과거 리터럴은 이관 대상이 아니며 새 코드로 복사하지 않는다.

| 요청 | 레거시 `gnp-api.php` | 현재 `/api/legacy/gnp-api` | 레거시 `point_sync.php` | 현재 `/api/legacy/point-sync` | 차이/결정 |
|---|---|---|---|---|---|
| `OPTIONS` preflight | `204`, `Access-Control-Allow-Origin: *`, `Allow-Methods: GET, POST, OPTIONS`, `Allow-Headers: Content-Type, X-API-Key, Authorization` | 동일 + `Cache-Control: no-store` | 별도 `OPTIONS` 처리 없음. 인증 전에 `Access-Control-Allow-Origin: *`만 설정하고 토큰 없으면 `401` | `204`, GNP와 동일한 CORS 헤더 + `no-store` | 신규는 브라우저/프록시 호환을 위해 양쪽 모두 preflight 허용 |
| 인증 헤더 | `X-API-Key`를 읽지만 실제 불일치 차단 없음 | `X-API-Key`, `Authorization: Bearer`, `api_key/token/key` 쿼리 중 하나가 `LEGACY_API_TOKEN`과 일치해야 함. 실패 시 `401` + `{"success":false,"message":"Unauthorized Access: Key Mismatch"}` | `X-API-Key`, `x-api-key`, `Authorization: Bearer ...` 검사. 실패 시 `401` + 동일 메시지 | GNP와 동일 | `gnp-api.php`의 무인증 동작은 취약점이라 신규에서는 허용하지 않음 |
| `GET action=list_members` 성공 | `200`, `{"success":true,"total":n,"page":p,"limit":l,"members":[{"userid","name","email","hp","mileage","regdate"}]}`. 이름은 DB EUC-KR 값을 UTF-8로 변환 | 같은 JSON shape. Prisma 사용자와 최근 포인트 이력 기준 | 같은 JSON shape. 이름 변환 없이 DB 값을 그대로 JSON화 | 같은 JSON shape. Prisma 사용자와 최근 포인트 이력 기준 | 응답 필드명/타입을 고정 테스트로 검증 |
| `GET` action 없음/불일치 | `200`, `{"success":false,"message":"No Action"}` | 동일 | `200`, `{"success":false,"message":"No valid action or data provided."}` | 동일 | 엔드포인트별 메시지 차이를 유지 |
| `POST action=register_member` 필수값 누락 | `200`, `{"success":false,"message":"Missing fields"}` | 동일 | `200`, `{"success":false,"message":"Missing required fields (userid, password)"}` | 동일 | 엔드포인트별 메시지 차이를 유지 |
| `POST action=register_member` 중복 | `200`, `{"success":false,"message":"Already exists"}` | 동일 | `200`, `{"success":false,"message":"User already exists"}` | 동일 | 엔드포인트별 메시지 차이를 유지 |
| `POST action=register_member` 성공 | `200`, `{"success":true}` | 동일 | `200`, `{"success":true,"message":"Member registered successfully"}` | 동일 | 테스트에서 두 응답을 분리 검증 |
| 포인트 동기화 성공 | `200`, `{"success":true,"message":"Success"}` | 동일 | `200`, `{"success":true,"message":"Point Synchronized Successfully"}` | 동일 | 테스트에서 두 응답을 분리 검증 |
| 포인트 동기화 대상 없음 | 레거시는 `UPDATE` 영향 행 수를 확인하지 않아 성공처럼 응답 가능 | `200`, `{"success":false,"message":"User not found"}` | 레거시는 `UPDATE` 영향 행 수를 확인하지 않아 성공처럼 응답 가능 | `200`, `{"success":false,"message":"User not found"}` | 신규는 데이터 정합성을 위해 없는 회원을 실패로 고정 |
| DB 오류 | `gnp-api.php`: `DB Error`, `point_sync.php`: `Database insert error` 또는 `Database error` | `gnp-api.php`: `500` + `DB Error` | `point_sync.php`: insert 실패 시 `500` + `Database insert error` | `500` + `Database error` | Prisma 오류는 상세를 노출하지 않고 레거시 문구 계열만 반환 |
| 이름 인코딩 | `gnp-api.php` 등록 시 UTF-8 이름을 EUC-KR로 저장하고 목록에서 UTF-8로 변환. `point_sync.php`는 변환 없이 저장/응답 | 신규는 UTF-8만 저장/응답 | 변환 없음 | 신규는 UTF-8만 저장/응답 | 테스트 fixture에서 EUC-KR 바이트를 UTF-8 기대 이름으로 복원하고, Route Handler 입력/출력은 UTF-8 유지 확인 |
