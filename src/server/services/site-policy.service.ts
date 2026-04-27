// Legacy sources: agree.php, privacy.php, member_article.php, company.php
// Cache: ISR 1h. Policies are public settings with legacy placeholder replacement.

import { unstable_cache } from 'next/cache';
import { prisma } from '@/server/db';

export type SitePolicyView = {
  companyName: string;
  companyCeo: string;
  companyAddress: string;
  companyTel: string;
  companyFax: string | null;
  companyEmail: string;
  privacyOfficer: string;
  businessNumber: string;
  mailOrderNumber: string;
  customerCenterTel: string;
  weekdayHours: string;
  saturdayHours: string;
  lunchHours: string;
  bankName: string;
  bankLogoText: string;
  bankAccount: string;
  terms: string;
  privacy: string;
  collectionConsent: string;
  companyInfo: string;
  htmlEnabled: boolean;
};

const FALLBACK_TERMS = `제1조(목적)
이 약관은 __CEONAME__가 운영하는 지앤지(이하 "몰"이라 한다)에서 제공하는 인터넷 관련 서비스(이하 "서비스"라 한다)를 이용함에 있어 사이버 몰과 이용자의 권리의무 및 책임사항을 규정함을 목적으로 합니다.

제2조(정의)
1. "몰"이란 회사가 재화 또는 용역을 이용자에게 제공하기 위하여 컴퓨터 등 정보통신설비를 이용하여 재화 등을 거래할 수 있도록 설정한 가상의 영업장을 말합니다.
2. "이용자"란 "몰"에 접속하여 이 약관에 따라 "몰"이 제공하는 서비스를 받는 회원 및 비회원을 말합니다.
3. "회원"이라 함은 "몰"에 개인정보를 제공하여 회원등록을 한 자로서, "몰"의 정보를 지속적으로 제공받으며 "몰"이 제공하는 서비스를 계속적으로 이용할 수 있는 자를 말합니다.
4. "비회원"이라 함은 회원에 가입하지 않고 "몰"이 제공하는 서비스를 이용하는 자를 말합니다.

제3조(약관의 명시와 개정)
"몰"은 이 약관의 내용과 상호, 대표자 성명, 영업소 소재지, 전화번호, 전자우편주소, 사업자등록번호, 통신판매업신고번호, 개인정보관리책임자를 이용자가 쉽게 알 수 있도록 게시합니다. "몰"은 관련 법령을 위배하지 않는 범위에서 이 약관을 개정할 수 있으며, 개정 시 적용일자 및 개정사유를 명시하여 공지합니다.

제4조(서비스의 제공 및 변경)
"몰"은 재화 또는 용역에 대한 정보 제공 및 구매계약의 체결, 구매계약이 체결된 재화 또는 용역의 배송, 기타 "몰"이 정하는 업무를 수행합니다. 품절 또는 기술적 사양 변경 등의 사유가 있는 경우 제공할 재화 또는 용역의 내용을 변경할 수 있습니다.

제5조(회원가입)
이용자는 "몰"이 정한 가입 양식에 따라 회원정보를 기입한 후 이 약관에 동의한다는 의사표시를 함으로써 회원가입을 신청합니다. "몰"은 등록 내용에 허위, 기재누락, 오기가 있거나 회원으로 등록하는 것이 기술상 현저히 지장이 있다고 판단되는 경우 승낙하지 않을 수 있습니다.

제6조(회원 탈퇴 및 자격 상실)
회원은 언제든지 탈퇴를 요청할 수 있으며 "몰"은 즉시 회원탈퇴를 처리합니다. 회원이 허위 내용을 등록하거나 타인의 이용을 방해하는 등 약관과 법령을 위반한 경우 회원자격을 제한 또는 정지할 수 있습니다.

제7조(구매신청 및 계약의 성립)
이용자는 상품 선택, 주문자 및 배송지 정보 입력, 결제방법 선택, 약관 확인 절차에 따라 구매를 신청합니다. "몰"의 승낙이 이용자에게 도달한 시점에 계약이 성립한 것으로 봅니다.

제8조(결제, 배송, 취소 및 환불)
상품의 결제, 배송, 취소, 교환 및 환불은 전자상거래 등에서의 소비자보호에 관한 법률 등 관련 법령과 "몰"의 안내 기준에 따릅니다.

제9조(개인정보보호)
"몰"은 이용자의 개인정보 수집 시 서비스 제공에 필요한 최소한의 정보를 수집하며, 개인정보처리방침에 따라 개인정보를 보호합니다.

제10조(분쟁해결)
"몰"은 이용자가 제기하는 정당한 의견이나 불만을 반영하고 피해를 보상처리하기 위하여 필요한 절차를 마련합니다. 이 약관에 정하지 아니한 사항은 관련 법령 및 상관례에 따릅니다.`;

const FALLBACK_PRIVACY = `__CEONAME__ (이하 "회사")는 고객님의 개인정보를 중요시하며 정보통신망 이용촉진 및 정보보호 등에 관한 법률 등 관련 법령을 준수하고 있습니다. 회사는 개인정보처리방침을 통하여 고객님께서 제공하시는 개인정보가 어떠한 용도와 방식으로 이용되고 있으며 개인정보보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.

본 방침은 2007년 10월 01일부터 시행됩니다.

1. 수집하는 개인정보 항목
회사는 서비스 상담, 신청, 회원가입, 주문 및 배송을 위해 아래와 같은 개인정보를 수집합니다.
- 수집항목: 이름, 휴대전화번호, 이메일, 쿠키, 결제기록
- 개인정보 수집방법: 홈페이지 회원가입, 주문, 견적문의

2. 개인정보의 수집 및 이용목적
회사는 회원제 서비스 이용에 따른 본인확인, 개인 식별, 불량회원의 부정 이용 방지와 비인가 사용 방지, 가입 의사 확인, 불만처리 등 민원처리, 고지사항 전달, 이벤트 등 광고성 정보 전달, 접속 빈도 파악 또는 회원의 서비스 이용 통계에 개인정보를 활용합니다.

3. 개인정보의 보유 및 이용기간
원칙적으로 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단 관계법령의 규정에 의하여 보존할 필요가 있는 경우 회사는 정한 기간 동안 회원정보를 보관합니다.
- 계약 또는 청약철회 등에 관한 기록: 5년
- 대금결제 및 재화 등의 공급에 관한 기록: 5년
- 소비자의 불만 또는 분쟁처리에 관한 기록: 3년
- 결제기록: 3년

4. 개인정보의 파기절차 및 방법
목적이 달성된 개인정보는 별도의 DB로 옮겨져 내부 방침 및 관련 법령에 따른 보유기간 경과 후 파기됩니다. 전자적 파일형태로 저장된 개인정보는 기록을 재생할 수 없는 기술적 방법으로 삭제합니다.

5. 개인정보 제공
회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만 이용자가 사전에 동의한 경우 또는 법령에 따라 수사기관의 요구가 있는 경우에는 예외로 합니다.

6. 수집한 개인정보의 위탁
위탁 대상자: 없음

7. 이용자 및 법정대리인의 권리와 행사방법
이용자는 언제든지 등록된 개인정보를 조회하거나 수정할 수 있으며 가입해지를 요청할 수 있습니다. 개인정보관리책임자에게 서면, 전화 또는 이메일로 연락하시면 지체없이 조치하겠습니다.

8. 개인정보 자동수집 장치의 설치, 운영 및 거부
회사는 쿠키를 사용하여 회원과 비회원의 접속 빈도, 방문 시간, 관심분야 등을 분석할 수 있습니다. 이용자는 웹브라우저 옵션을 통해 쿠키 저장을 거부할 수 있으며, 이 경우 일부 서비스 이용에 어려움이 있을 수 있습니다.

9. 개인정보에 관한 민원서비스
고객서비스담당 부서: 관리부
전화번호: __CEOTEL__
이메일: __CEOMAIL__
개인정보관리책임자 성명: __GUARD__

기타 개인정보침해 상담은 개인정보 분쟁조정위원회, 경찰청 사이버안전국, 개인정보 침해신고센터에 문의하실 수 있습니다.`;

const FALLBACK_POLICY: SitePolicyView = {
  companyName: '휴먼테크(주)',
  companyCeo: '최한수',
  companyAddress: '경기도 광명시 가학동 도고내로 45',
  companyTel: '010-8964-5001',
  companyFax: '0503-112-7165',
  companyEmail: 'choi520530@gmail.com',
  privacyOfficer: '최한수',
  businessNumber: '332-87-01493',
  mailOrderNumber: '제 2023 - 경기광명 - 1206호',
  customerCenterTel: '010-8964-5001',
  weekdayHours: 'AM 09:00 - PM 17:00',
  saturdayHours: 'AM 09:00 - PM 14:00',
  lunchHours: '점심시간: 12:00 - 13:00',
  bankName: '농협은행',
  bankLogoText: 'NH',
  bankAccount: '351-1090-4166-33',
  terms: FALLBACK_TERMS,
  privacy: FALLBACK_PRIVACY,
  collectionConsent: '제품구매 본인여부 확인|이름,이메일,전화번호,주소|법령에 정한 기간',
  companyInfo:
    '__CEONAME__는 건강식품, 생활용품, 종합 쇼핑몰 지앤지를 운영합니다.',
  htmlEnabled: false,
};

function applyLegacyPlaceholders(policy: SitePolicyView, value: string): string {
  return value
    .replaceAll('__CEONAME__', policy.companyName)
    .replaceAll('__CEOTEL__', policy.companyTel)
    .replaceAll('__CEOMAIL__', policy.companyEmail)
    .replaceAll('__GUARD__', policy.privacyOfficer);
}

async function getSitePolicy(): Promise<SitePolicyView> {
  const row = await prisma.sitePolicy
    .findUnique({
      where: { key: 'default' },
      select: {
        companyName: true,
        companyCeo: true,
        companyAddress: true,
        companyTel: true,
        companyFax: true,
        companyEmail: true,
        privacyOfficer: true,
        businessNumber: true,
        mailOrderNumber: true,
        customerCenterTel: true,
        weekdayHours: true,
        saturdayHours: true,
        lunchHours: true,
        bankName: true,
        bankLogoText: true,
        bankAccount: true,
        terms: true,
        privacy: true,
        collectionConsent: true,
        companyInfo: true,
        htmlEnabled: true,
      },
    })
    .catch(() => null);

  const policy = row
    ? {
        ...row,
        terms: row.terms.length < 300 ? FALLBACK_POLICY.terms : row.terms,
        privacy: row.privacy.length < 500 ? FALLBACK_POLICY.privacy : row.privacy,
        collectionConsent: row.collectionConsent.includes('|')
          ? row.collectionConsent
          : FALLBACK_POLICY.collectionConsent,
      }
    : FALLBACK_POLICY;
  return {
    ...policy,
    terms: applyLegacyPlaceholders(policy, policy.terms),
    privacy: applyLegacyPlaceholders(policy, policy.privacy),
    collectionConsent: applyLegacyPlaceholders(policy, policy.collectionConsent),
    companyInfo: applyLegacyPlaceholders(policy, policy.companyInfo),
  };
}

export const getCachedSitePolicy = unstable_cache(
  getSitePolicy,
  ['site-policy:default'],
  { revalidate: 3600, tags: ['site-policy'] },
);
