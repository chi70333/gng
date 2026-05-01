# 13. Legacy Member Backup

회원 마이그레이션 전에 레거시 MySQL에서 회원 관련 테이블을 별도 백업 파일로 보관한다.

## 레거시 사이트

- URL: `https://xn--ef5bt3fba.kr/`
- 응답 charset: `euc-kr`

백업 스크립트는 기본적으로 DB를 `euckr`로 읽고 다운로드 파일은 `utf-8`로 출력한다.

## 대상

기본 백업 스크립트: `scripts/legacy-member-backup.php`

기본 포함 테이블:

- `member`
- `social_member`
- `member_addrs`
- `member_withdraw`
- `point_table`

서버에 없는 테이블은 자동으로 건너뛴다. 특정 테이블만 받을 때는 `?action=download&tables=member,social_member`처럼 지정한다.
Next.js 마이그레이션에는 SQL이 아니라 `?action=download-json`으로 받는 NDJSON 파일을 사용한다.

## 절차

1. `scripts/legacy-member-backup.php`에서 `BACKUP_PASSWORD`를 임시 비밀번호로 바꾼다.
2. 레거시 서버의 웹 루트에 파일을 업로드한다.
3. 브라우저에서 `https://xn--ef5bt3fba.kr/legacy-member-backup.php`를 열고 로그인한다.
4. `마이그레이션용 NDJSON 다운로드`를 눌러 `gng_member_backup_YYYYMMDD_HHMMSS.ndjson`을 받는다. SQL 보관이 필요하면 별도로 `회원 관련 SQL 다운로드`를 받는다.
5. 다운로드 직후 서버에서 `legacy-member-backup.php`를 삭제한다.
6. 받은 백업 파일은 로컬의 `legacy-member-backups/` 같은 git ignored 폴더에 둔다.

## Next.js DB 적재

1. 백업 파일을 `legacy-member-backups/` 아래에 둔다.
2. 스테이징 DB 환경변수로 먼저 dry-run을 실행한다.

```bash
LEGACY_MEMBER_BACKUP_FILE=legacy-member-backups/gng_member_backup_YYYYMMDD_HHMMSS.ndjson \
LEGACY_MEMBER_MIGRATION_DRY_RUN=1 \
pnpm legacy:migrate-members
```

3. 리포트(`legacy-member-backups/reports/*.json`)의 충돌, 알 수 없는 소셜 계정, 비밀번호 재설정 필요 회원을 확인한다.
4. 스테이징 write 검증 후 운영 DB에서 fresh backup으로 dry-run을 다시 수행하고, 문제가 없으면 `LEGACY_MEMBER_MIGRATION_DRY_RUN=0`으로 실행한다.

## 주의

- 덤프에는 개인정보, 비밀번호 해시, 소셜 provider uid가 포함된다. Git에 커밋하지 않는다.
- `sns_login`, `talk_login`, `login_p` 같은 OAuth 설정/시크릿 테이블은 백업 대상에서 제외한다.
- Postgres에 직접 import하는 파일이 아니다. 신규 스키마 매핑은 `scripts/migrate-legacy-members.mjs`와 `docs/11-legacy-db-structure-map.md` 기준으로 별도 ETL에서 처리한다.
- 한글이 깨지면 스크립트 상단의 `DB_CHARSET`/`OUTPUT_CHARSET` 값을 확인하고 다시 내려받는다.
- 점검창 없이 백업하면 최종 백업 시점 이후 레거시 회원가입, 소셜 연결, 포인트 변경분은 포함되지 않는다.
