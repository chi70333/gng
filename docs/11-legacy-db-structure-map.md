# 11. Legacy DB Structure Map

Source dump: `gng_full_db_backup_20260427_200821.sql` (2026-04-27 KST)

This document records structure mapping only. Do not import member rows unless explicitly requested.

## Core Table Mapping

| Legacy table | New schema | Notes |
|---|---|---|
| `member` | `User`, `UserBusinessProfile`, `UserRefundAccount`, `UserPointHistory` | Keep `member.idx` in `User.legacyMemberId`; keep `member.userid` in `User.loginId`. Password goes to `legacyPasswordHash` until first login rehash. |
| `member_addrs` | `UserAddress` | Keep `member_addrs.seq` in `UserAddress.legacySeq`; `member_id` maps to `User.loginId`. |
| `member_withdraw` | `User.status = withdrawn`, anonymized fields | Structure only. Personal data should not be restored into active user rows. |
| `social_member` | `UserSocialAccount` plus existing `User` | Keep `social_member.uid` in `UserSocialAccount.legacyUid` when provider identity is known. |
| `sns_login`, `talk_login`, `login_p` | environment variables / OAuth config | Do not commit historical OAuth secrets. |
| `point_table` | `UserPointHistory` | `member.point` can be stored as `User.legacyPointBalance` during migration and reconciled with the latest ledger balance. |
| `goods` | `Product`, `ProductImage`, `ProductOption`, `ProductSku`, `CategoryOnProduct` | Existing `Product.legacyId` already maps `goods.idx`; legacy admin-only fields remain in `Product.attributes.legacyAdmin`. |
| `category` | `Category`, `CategoryLegacyMap` | Existing `CategoryLegacyMap.legacyIndex` maps `category.idx`. |
| `cart` | Redis cart plus optional order draft data | Keep live carts in Redis; only migrate if business requires active legacy carts. |
| `trade` | `Order`, `Payment`, `Shipment`, `OrderStatusHistory` | Keep `trade.idx` in `Order.legacyId` and `trade.tradecode` in `Order.legacyTradeCode`. |
| `trade_goods` | `OrderItem` | Keep `trade_goods.idx` in `OrderItem.legacyId`; use `legacyTradeCode` for joining during ETL. |
| `coupon` | `Coupon` | Keep `coupon.idx` in `Coupon.legacyId`. |
| `coupon_list` | `CouponIssue` | Keep `coupon_list.idx` in `CouponIssue.legacyId`. |
| `admin_list` | `AdminUser` | Keep `admin_list.idx` in `AdminUser.legacyId`; passwords must be migrated as legacy hashes and rehashed after login. |
| `admin` | `SitePolicy` and payment/shipping settings | Extract public company, bank, shipping, policy text fields only. Secret PG keys stay in environment variables. |

## Member Structure Notes

The legacy `member` table contains customer, business, refund, and marketing fields in one row:

- Identity: `idx`, `userid`, `name`, `nickname`, `email`, `hand`, `tel`, `birth`, `sex`.
- Auth: `pwd` should map to `legacyPasswordHash` with `legacyPasswordAlgo` documented by migration code.
- Status: `part`, `bDeal`, `nearDay`, `mb_leave_date` style fields map to modern status/member type decisions.
- Address: `zip`, `address1`, `address2` may create a default `UserAddress`.
- Business: `companyname`, `ceoname`, `upjongtype`, `jongmok`, `ceonum`, `ceo_zip`, `ceo_address1`, `ceo_address2` map to `UserBusinessProfile`.
- Refund: `refund_bank`, `refund_name`, `refund_account` map to `UserRefundAccount`.
- Marketing: `bMail`, `bSms` map to `marketingAgreedAt` and `smsAgreedAt` if the consent timestamp can be established.
- Points: `point` is a snapshot only; use `point_table` as the ledger source and reconcile before cutover.

## Safety Rules

- Do not copy legacy secrets from `admin`, `sns_login`, `talk_login`, or `login_p` into source files.
- Do not import withdrawn member personal data into active tables. Use anonymized rows or status markers.
- Treat `0000-00-00` and `0000-00-00 00:00:00` as `NULL`.
- Keep money in `Decimal` columns in the modern schema, even when the legacy table stores integer won amounts.
