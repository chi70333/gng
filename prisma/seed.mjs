import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

const argonOptions = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 65536,
  parallelism: 1,
};

const siteFooterSettings = {
  companyName: '이노테크(주)',
  companyCeo: '최한길',
  companyAddress: '경기도 광명시 가학동 광고대로 45',
  companyTel: '010-8964-5001',
  companyFax: '0503-112-7165',
  companyEmail: 'choi520530@gmail.com',
  privacyOfficer: '최한길',
  businessNumber: '332-87-01493',
  mailOrderNumber: '제2023-경기광명-1206호',
  customerCenterTel: '010-8964-5001',
  weekdayHours: '평일 09:00 - 17:00',
  saturdayHours: '토요일 09:00 - 14:00',
  lunchHours: '점심시간 12:00 - 13:00',
  bankName: '농협은행',
  bankLogoText: 'NH',
  bankAccount: '351-1090-4166-33',
};

const terms = `제1조 목적
본 약관은 회사가 운영하는 쇼핑몰에서 제공하는 서비스 이용 조건과 절차, 이용자와 회사의 권리와 의무를 정합니다.

제2조 서비스 제공
회사는 상품 정보 제공, 주문 접수, 결제, 배송, 교환 및 반품 접수 등 쇼핑몰 운영에 필요한 서비스를 제공합니다.

제3조 회원가입
이용자는 회사가 정한 가입 양식에 따라 회원 정보를 입력하고 약관에 동의함으로써 회원가입을 신청합니다.

제4조 주문, 배송, 취소 및 환불
주문과 결제, 배송, 청약철회, 교환 및 환불은 전자상거래 등에서의 소비자보호에 관한 법률과 회사 안내 기준을 따릅니다.

제5조 개인정보보호
회사는 서비스 제공에 필요한 최소한의 개인정보를 수집하며 개인정보처리방침에 따라 안전하게 보호합니다.`;

const privacy = `회사는 고객의 개인정보를 중요하게 생각하며 관련 법령을 준수합니다.

1. 수집 항목
회원가입, 주문, 배송, 상담을 위해 이름, 이메일, 휴대전화번호, 주소, 결제기록 등 필요한 정보를 수집할 수 있습니다.

2. 이용 목적
본인 확인, 주문 처리, 배송, 고객 상담, 공지 전달, 부정 이용 방지를 위해 개인정보를 이용합니다.

3. 보유 기간
개인정보는 수집 및 이용 목적이 달성되면 지체 없이 파기합니다. 관계 법령에 따라 보존이 필요한 정보는 정해진 기간 동안 보관합니다.

4. 이용자 권리
이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다.

개인정보 보호책임자: __GUARD__
연락처: __CEOTEL__
이메일: __CEOMAIL__`;

async function main() {
  await prisma.sitePolicy.upsert({
    where: { key: 'default' },
    update: {
      ...siteFooterSettings,
      terms,
      privacy,
      collectionConsent: '상품 구매 및 배송을 위해 이름, 연락처, 주소를 수집하며 법령에 따른 기간 동안 보관합니다.',
      companyInfo: '__CEONAME__은 건강식품, 생활용품, 종합 쇼핑몰 서비스를 운영합니다.',
      htmlEnabled: false,
    },
    create: {
      key: 'default',
      ...siteFooterSettings,
      terms,
      privacy,
      collectionConsent: '상품 구매 및 배송을 위해 이름, 연락처, 주소를 수집하며 법령에 따른 기간 동안 보관합니다.',
      companyInfo: '__CEONAME__은 건강식품, 생활용품, 종합 쇼핑몰 서비스를 운영합니다.',
      htmlEnabled: false,
    },
  });

  const [noticeBoard, generalBoard, eventBoard, faqBoard] = await Promise.all([
    prisma.board.upsert({
      where: { code: 'notice' },
      update: { name: '공지사항', type: 'notice', isActive: true },
      create: { code: 'notice', name: '공지사항', type: 'notice', isActive: true },
    }),
    prisma.board.upsert({
      where: { code: 'general' },
      update: { name: '자유게시판', type: 'free', isActive: true },
      create: { code: 'general', name: '자유게시판', type: 'free', isActive: true },
    }),
    prisma.board.upsert({
      where: { code: 'event' },
      update: { name: '이벤트', type: 'event', isActive: true },
      create: { code: 'event', name: '이벤트', type: 'event', isActive: true },
    }),
    prisma.board.upsert({
      where: { code: 'faq' },
      update: { name: 'FAQ', type: 'faq', isActive: true },
      create: { code: 'faq', name: 'FAQ', type: 'faq', isActive: true },
    }),
  ]);

  await prisma.post.upsert({
    where: { id: 1n },
    update: {},
    create: {
      id: 1n,
      boardId: noticeBoard.id,
      title: 'GNG Next 테스트 공지',
      content: '레거시 대비 기능 검증을 위한 테스트 공지입니다.',
      isNotice: true,
    },
  });

  await prisma.post.upsert({
    where: { id: 2n },
    update: {},
    create: {
      id: 2n,
      boardId: faqBoard.id,
      title: '배송은 얼마나 걸리나요?',
      content: '평일 오후 2시 이전 결제 완료 주문은 재고 확인 후 순차 출고됩니다.',
    },
  });

  await prisma.post.upsert({
    where: { id: 3n },
    update: {},
    create: {
      id: 3n,
      boardId: generalBoard.id,
      title: '게시판 이용 안내',
      content: '상품과 주문 관련 일반 문의를 남길 수 있는 게시판입니다.',
      isNotice: true,
    },
  });

  await prisma.post.upsert({
    where: { id: 4n },
    update: {},
    create: {
      id: 4n,
      boardId: eventBoard.id,
      title: '진행 중인 이벤트를 확인해 주세요',
      content: '이벤트 게시판에서 혜택과 상세 안내를 확인할 수 있습니다.',
      isNotice: true,
    },
  });

  await prisma.adminUser.upsert({
    where: { loginId: 'admin' },
    update: {},
    create: {
      loginId: 'admin',
      email: 'admin@gng.test',
      name: 'GNG Admin',
      passwordHash: await argon2.hash('Admin1234!', argonOptions),
      role: 'super_admin',
      permissions: [
        'admin.manage',
        'product.read',
        'product.write',
        'order.read',
        'order.write',
        'user.read',
        'user.write',
        'coupon.read',
        'coupon.write',
        'content.read',
        'content.write',
        'settings.read',
        'settings.write',
      ],
      status: 'active',
    },
  });

  const grade = await prisma.userGrade.upsert({
    where: { code: 'basic' },
    update: { name: '일반회원', pointPct: '1.00', discountPct: '0.00' },
    create: {
      code: 'basic',
      name: '일반회원',
      pointPct: '1.00',
      discountPct: '0.00',
      sortOrder: 1,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'test@gng.test' },
    update: { loginId: 'testuser', gradeId: grade.id },
    create: {
      loginId: 'testuser',
      email: 'test@gng.test',
      name: '테스트회원',
      phone: '01012345678',
      gradeId: grade.id,
      passwordHash: await argon2.hash('Password123!', argonOptions),
    },
  });

  await prisma.userPointHistory.upsert({
    where: { id: 1n },
    update: {},
    create: {
      id: 1n,
      userId: user.id,
      delta: 1000,
      balance: 1000,
      reason: '테스트 가입 포인트',
    },
  });

  const category = await prisma.category.upsert({
    where: { slug: 'test-category' },
    update: { name: '테스트 카테고리', isActive: true },
    create: {
      code: 'TEST',
      slug: 'test-category',
      name: '테스트 카테고리',
      depth: 0,
      sortOrder: 1,
      isActive: true,
    },
  });

  await prisma.categoryLegacyMap.upsert({
    where: { legacyIndex: 388 },
    update: {
      categoryId: category.id,
      legacyCode: category.code,
    },
    create: {
      legacyIndex: 388,
      legacyCode: category.code,
      categoryId: category.id,
    },
  });

  const product = await prisma.product.upsert({
    where: { slug: 'legacy-parity-test-product' },
    update: { status: 'active' },
    create: {
      sku: 'GNG-TEST-001',
      slug: 'legacy-parity-test-product',
      name: '레거시 비교 테스트 상품',
      summary: '장바구니, 주문, 검색 검증용 상품입니다.',
      description: '<p>레거시 상품 상세 흐름을 비교하기 위한 테스트 상품입니다.</p>',
      price: '30000',
      salePrice: '25000',
      status: 'active',
      thumbnail: null,
      categories: {
        create: {
          categoryId: category.id,
          sortOrder: 1,
        },
      },
      options: {
        create: {
          name: '색상',
          sortOrder: 1,
          values: ['블랙', '화이트'],
        },
      },
      skus: {
        create: [
          {
            code: 'GNG-TEST-001-BK',
            optionValues: { 색상: '블랙' },
            stock: 20,
            reserved: 0,
            isActive: true,
          },
          {
            code: 'GNG-TEST-001-WH',
            optionValues: { 색상: '화이트' },
            stock: 20,
            reserved: 0,
            isActive: true,
          },
        ],
      },
    },
  });

  await prisma.categoryOnProduct.upsert({
    where: {
      categoryId_productId: {
        categoryId: category.id,
        productId: product.id,
      },
    },
    update: {},
    create: {
      categoryId: category.id,
      productId: product.id,
      sortOrder: 1,
    },
  });

  const defaultSku = await prisma.productSku.findFirst({
    where: { productId: product.id, isActive: true },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (!defaultSku) throw new Error('Seed SKU not found for payment fixtures');

  const coupon = await prisma.coupon.upsert({
    where: { code: 'WELCOME-3000' },
    update: {
      name: '신규 회원 3,000원 할인',
      isActive: true,
      startAt: new Date('2026-01-01T00:00:00+09:00'),
      endAt: new Date('2026-12-31T23:59:59+09:00'),
    },
    create: {
      code: 'WELCOME-3000',
      name: '신규 회원 3,000원 할인',
      discountType: 'amount',
      discountValue: '3000',
      minOrderAmount: '20000',
      startAt: new Date('2026-01-01T00:00:00+09:00'),
      endAt: new Date('2026-12-31T23:59:59+09:00'),
      totalQuota: 1000,
      isActive: true,
    },
  });

  const existingIssue = await prisma.couponIssue.findFirst({
    where: { couponId: coupon.id, userId: user.id },
    select: { id: true },
  });
  if (!existingIssue) {
    await prisma.couponIssue.create({
      data: {
        couponId: coupon.id,
        userId: user.id,
        expireAt: coupon.endAt,
      },
    });
  }

  const seedOrderPresets = [
    {
      orderNo: 'GNG-SEED-ORDER-SUCCESS',
      orderStatus: 'paid',
      paymentStatus: 'approved',
      provider: 'ksnet',
      providerTxId: 'KSNET-TX-SEED-SUCCESS',
      responseCode: '0000',
      responseMessage: '승인완료',
    },
    {
      orderNo: 'GNG-SEED-ORDER-FAILED',
      orderStatus: 'cancelled',
      paymentStatus: 'failed',
      provider: 'kiwoompay',
      providerTxId: 'KIWOOM-TX-SEED-FAILED',
      responseCode: 'E001',
      responseMessage: '승인거절',
    },
    {
      orderNo: 'GNG-SEED-ORDER-CANCELLED',
      orderStatus: 'cancelled',
      paymentStatus: 'cancelled',
      provider: 'legacy-payaction',
      providerTxId: 'PAYACTION-TX-SEED-CANCEL',
      responseCode: 'CANCEL',
      responseMessage: '사용자 취소',
    },
  ];

  for (const preset of seedOrderPresets) {
    const order = await prisma.order.upsert({
      where: { orderNo: preset.orderNo },
      update: {
        userId: user.id,
        status: preset.orderStatus,
        subtotal: '25000',
        discount: '0',
        shippingFee: '3000',
        pointsUsed: 0,
        total: '28000',
        shippingAddress: {
          receiver: '시드 수령자',
          phone: '01011112222',
          zipCode: '06234',
          address1: '서울시 강남구 테헤란로 1',
          address2: '101호',
        },
        buyerInfo: {
          receiver: '시드 구매자',
          phone: '01011112222',
          channel: 'seed',
        },
        memo: '결제 콜백 호환성 검증용 시드 주문',
        items: {
          deleteMany: {},
          create: [
            {
              productId: product.id,
              skuId: defaultSku.id,
              productName: '레거시 호환성 시드 상품',
              skuCode: 'GNG-TEST-001-BK',
              optionSummary: '기본옵션',
              unitPrice: '25000',
              quantity: 1,
              totalPrice: '25000',
            },
          ],
        },
      },
      create: {
        orderNo: preset.orderNo,
        userId: user.id,
        status: preset.orderStatus,
        subtotal: '25000',
        discount: '0',
        shippingFee: '3000',
        pointsUsed: 0,
        total: '28000',
        shippingAddress: {
          receiver: '시드 수령자',
          phone: '01011112222',
          zipCode: '06234',
          address1: '서울시 강남구 테헤란로 1',
          address2: '101호',
        },
        buyerInfo: {
          receiver: '시드 구매자',
          phone: '01011112222',
          channel: 'seed',
        },
        memo: '결제 콜백 호환성 검증용 시드 주문',
        items: {
          create: [
            {
              productId: product.id,
              skuId: defaultSku.id,
              productName: '레거시 호환성 시드 상품',
              skuCode: 'GNG-TEST-001-BK',
              optionSummary: '기본옵션',
              unitPrice: '25000',
              quantity: 1,
              totalPrice: '25000',
            },
          ],
        },
      },
    });

    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.payment.create({
      data: {
        orderId: order.id,
        method: 'card',
        provider: preset.provider,
        providerTxId: preset.providerTxId,
        amount: '28000',
        status: preset.paymentStatus,
        rawResponse: {
          source: 'seed',
          responseCode: preset.responseCode,
          responseMessage: preset.responseMessage,
        },
        approvedAt: preset.paymentStatus === 'approved' ? new Date() : null,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
