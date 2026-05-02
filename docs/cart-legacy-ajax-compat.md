# [GNG] 장바구니 레거시 AJAX 호환 메모

## 로컬 legacy 추적 결과

- `cart_count.php`는 루트 파일이 없고 `legacy/www/m/cart_count.php`만 존재한다.
- 운영 헤더/상세 JS 호출은 `/m/cart_count.php`를 사용하며 jQuery `$.ajax({ url: '/m/cart_count.php' })`라서 실제 메서드는 `GET`이다.
- `legacy/www/cart.php`의 수량 변경은 `POST cart_ok_ajax.php`에 `mode=chang_cnt&idx=<cart_idx>&tar=cnt&cnt=<qty>`를 보낸다.
- `legacy/www/cart.php`의 단건 삭제는 `POST cart_del_ajax.php?idx=<cart_idx>`, 선택 삭제는 `POST cart_del_ajax.php?mode=arr&idx=1,2`를 보낸다.
- `legacy/www/cart_ok_ajax.php`의 주요 응답은 성공 `"1"`, 재고 부족 JSON `{"error":1,"msg":<stock>}`, 담기 성공 `"0||<cart_idx>"`, 중복 확인 `"total|update|insert"`이다.

## Next.js 호환 구현

- 신규 JSON API `/api/cart`는 `{ ok, data }` 응답을 유지한다.
- 레거시 어댑터는 같은 Redis 장바구니를 사용하면서 텍스트 응답을 반환한다.
- 운영 정책상 장바구니와 주문 수량은 항상 `1`로 정규화한다. 중복 담기, 수량 변경, guest→user merge 모두 기존 라인의 수량을 늘리지 않는다.
- 비회원 쿠키는 `gng_cart_id`, Redis key는 `cart:guest:<cookieId>`, 회원 key는 `cart:user:<email>`이다.
- Redis write는 `ex: 60 * 60 * 24 * 30`으로 30일 TTL을 건다.
- 로그인 상태에서 guest cookie가 함께 오면 guest 장바구니를 user 장바구니로 merge하고 guest key를 삭제한다.
- 현재 Next 장바구니에는 별도 cart row id가 없으므로 레거시 `idx`는 `skuId`로 해석한다.

## 추가 엔드포인트

- `/cart_ok_ajax.php`
- `/cart_del_ajax.php`
- `/cart_ok.php`
- `/m/cart_count.php`
