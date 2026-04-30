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

const luxuryBagImages = [
  'https://images.unsplash.com/photo-1705909237050-7a7625b47fac?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1682745230951-8a5aa9a474a0?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1600857062241-98e5dba7f214?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1559563458-527698bf5295?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1614179689702-355944cd0918?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1683921590274-a83862cb11c3?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1589731119540-c4586781dae1?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1713746834176-04c0069d6593?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1613482184847-44483b792eeb?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1566150902887-9679ecc155ba?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1683921470299-b8f0f3331657?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1605733513597-a8f8341084e6?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1751242864911-1461a0b3a2aa?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1564139615082-01535600057f?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1760624295064-2de890f64524?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1598532163257-ae3c6b2524b6?auto=format&fit=crop&w=900&q=80&crop=entropy',
  'https://images.unsplash.com/photo-1605733513597-a8f8341084e6?auto=format&fit=crop&w=900&q=80&crop=entropy',
];

const luxuryBagProducts = [
  ['premium-quilted-chain-shoulder-bag', '프리미엄 퀼팅 체인 숄더백', 'GNG-LUX-BAG-001', 'GNG Luxe', 'GNG-LUXE', '328000', '289000', '아이보리'],
  ['classic-black-top-handle-bag', '클래식 블랙 탑핸들백', 'GNG-LUX-BAG-002', 'Atelier Noir', 'ATELIER-NOIR', '298000', '259000', '블랙'],
  ['camel-leather-crossbody-bag', '카멜 레더 크로스백', 'GNG-LUX-BAG-003', 'Maison GNG', 'MAISON-GNG', '248000', '219000', '카멜'],
  ['woven-leather-chain-tote', '위빙 레더 체인 토트백', 'GNG-LUX-BAG-004', 'GNG Luxe', 'GNG-LUXE', '388000', '349000', '브라운'],
  ['mini-flap-evening-bag', '미니 플랩 이브닝백', 'GNG-LUX-BAG-005', 'Belle Atelier', 'BELLE-ATELIER', '198000', '169000', '핑크'],
  ['soft-grey-satchel-bag', '소프트 그레이 사첼백', 'GNG-LUX-BAG-006', 'Atelier Noir', 'ATELIER-NOIR', '228000', '199000', '그레이'],
  ['structured-office-tote-bag', '스트럭처 오피스 토트백', 'GNG-LUX-BAG-007', 'Maison GNG', 'MAISON-GNG', '268000', '239000', '블랙'],
  ['pink-mini-lock-bag', '핑크 미니 락백', 'GNG-LUX-BAG-008', 'Belle Atelier', 'BELLE-ATELIER', '188000', '159000', '핑크'],
  ['blue-leather-hobo-bag', '블루 레더 호보백', 'GNG-LUX-BAG-009', 'GNG Luxe', 'GNG-LUXE', '258000', '229000', '블루'],
  ['white-lady-top-handle-bag', '화이트 레이디 탑핸들백', 'GNG-LUX-BAG-010', 'Maison GNG', 'MAISON-GNG', '358000', '319000', '화이트'],
  ['pearl-grey-mini-satchel', '펄 그레이 미니 사첼백', 'GNG-LUX-BAG-011', 'Atelier Noir', 'ATELIER-NOIR', '208000', '179000', '그레이'],
  ['urban-white-shoulder-bag', '어반 화이트 숄더백', 'GNG-LUX-BAG-012', 'Belle Atelier', 'BELLE-ATELIER', '238000', '209000', '화이트'],
  ['tabletop-small-leather-purse', '스몰 레더 퍼스백', 'GNG-LUX-BAG-013', 'GNG Luxe', 'GNG-LUXE', '178000', '149000', '브라운'],
  ['handheld-grey-purse', '핸드헬드 그레이 퍼스', 'GNG-LUX-BAG-014', 'Atelier Noir', 'ATELIER-NOIR', '218000', '189000', '그레이'],
  ['yellow-studio-black-bag', '스튜디오 블랙 미니백', 'GNG-LUX-BAG-015', 'Maison GNG', 'MAISON-GNG', '198000', '169000', '블랙'],
  ['boutique-black-display-bag', '부티크 블랙 디스플레이백', 'GNG-LUX-BAG-016', 'GNG Luxe', 'GNG-LUXE', '288000', '249000', '블랙'],
  ['brown-flower-tote-bag', '브라운 플라워 토트백', 'GNG-LUX-BAG-017', 'Belle Atelier', 'BELLE-ATELIER', '238000', '199000', '브라운'],
  ['teal-everyday-leather-bag', '틸 에브리데이 레더백', 'GNG-LUX-BAG-018', 'Maison GNG', 'MAISON-GNG', '268000', '229000', '틸'],
  ['modern-chain-pouch-bag', '모던 체인 파우치백', 'GNG-LUX-BAG-019', 'Atelier Noir', 'ATELIER-NOIR', '318000', '279000', '브라운'],
  ['compact-grey-buckle-bag', '컴팩트 그레이 버클백', 'GNG-LUX-BAG-020', 'GNG Luxe', 'GNG-LUXE', '208000', '179000', '그레이'],
];

const colorCodeMap = {
  아이보리: 'IVORY',
  블랙: 'BLACK',
  카멜: 'CAMEL',
  브라운: 'BROWN',
  핑크: 'PINK',
  그레이: 'GREY',
  블루: 'BLUE',
  화이트: 'WHITE',
  틸: 'TEAL',
};

const additionalTestCategories = [
  { code: 'TEST_SKINCARE', slug: 'test-skincare', name: '테스트 스킨케어', sortOrder: 10 },
  { code: 'TEST_HEALTH', slug: 'test-health-food', name: '테스트 건강식품', sortOrder: 11 },
  { code: 'TEST_LIVING', slug: 'test-living', name: '테스트 생활용품', sortOrder: 12 },
  { code: 'TEST_SEASON', slug: 'test-season', name: '테스트 시즌상품', sortOrder: 13 },
];

const additionalTestProducts = [
  {
    categorySlug: 'test-skincare',
    slug: 'test-deep-hydra-toner',
    sku: 'GNG-TEST-SKIN-001',
    name: '테스트 딥 하이드라 토너',
    brandName: 'GNG Lab',
    brandCode: 'GNG-LAB',
    price: '22000',
    salePrice: '17800',
    thumbnail: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=900&q=80',
    optionName: '용량',
    optionValues: ['150ml', '300ml'],
  },
  {
    categorySlug: 'test-skincare',
    slug: 'test-bright-care-serum',
    sku: 'GNG-TEST-SKIN-002',
    name: '테스트 브라이트 케어 세럼',
    brandName: 'GNG Lab',
    brandCode: 'GNG-LAB',
    price: '36000',
    salePrice: '29800',
    thumbnail: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=900&q=80',
    optionName: '타입',
    optionValues: ['기본형', '대용량'],
  },
  {
    categorySlug: 'test-skincare',
    slug: 'test-barrier-moisture-cream',
    sku: 'GNG-TEST-SKIN-003',
    name: '테스트 배리어 수분 크림',
    brandName: 'GNG Lab',
    brandCode: 'GNG-LAB',
    price: '32000',
    salePrice: '25900',
    thumbnail: 'https://images.unsplash.com/photo-1570194065650-d99fb4d8a609?auto=format&fit=crop&w=900&q=80',
    optionName: '향',
    optionValues: ['무향', '시트러스'],
  },
  {
    categorySlug: 'test-health-food',
    slug: 'test-daily-vita-pack',
    sku: 'GNG-TEST-HEALTH-001',
    name: '테스트 데일리 비타팩',
    brandName: 'Good Table',
    brandCode: 'GOOD-TABLE',
    price: '29000',
    salePrice: '23900',
    thumbnail: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=900&q=80',
    optionName: '구성',
    optionValues: ['30일분', '60일분'],
  },
  {
    categorySlug: 'test-health-food',
    slug: 'test-protein-grain-shake',
    sku: 'GNG-TEST-HEALTH-002',
    name: '테스트 단백 곡물 쉐이크',
    brandName: 'Good Table',
    brandCode: 'GOOD-TABLE',
    price: '42000',
    salePrice: '34900',
    thumbnail: 'https://images.unsplash.com/photo-1514995428455-447d4443fa7f?auto=format&fit=crop&w=900&q=80',
    optionName: '맛',
    optionValues: ['고소한 곡물', '초코'],
  },
  {
    categorySlug: 'test-health-food',
    slug: 'test-red-ginseng-jelly',
    sku: 'GNG-TEST-HEALTH-003',
    name: '테스트 홍삼 젤리스틱',
    brandName: 'Good Table',
    brandCode: 'GOOD-TABLE',
    price: '38000',
    salePrice: '31900',
    thumbnail: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=900&q=80',
    optionName: '포장',
    optionValues: ['일반', '선물박스'],
  },
  {
    categorySlug: 'test-living',
    slug: 'test-cotton-soft-towel-set',
    sku: 'GNG-TEST-LIVING-001',
    name: '테스트 코튼 소프트 타월 세트',
    brandName: 'GNG Home',
    brandCode: 'GNG-HOME',
    price: '26000',
    salePrice: '19900',
    thumbnail: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=900&q=80',
    optionName: '색상',
    optionValues: ['아이보리', '그레이'],
  },
  {
    categorySlug: 'test-living',
    slug: 'test-kitchen-storage-set',
    sku: 'GNG-TEST-LIVING-002',
    name: '테스트 주방 보관용기 세트',
    brandName: 'GNG Home',
    brandCode: 'GNG-HOME',
    price: '34000',
    salePrice: '27900',
    thumbnail: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80',
    optionName: '구성',
    optionValues: ['6종', '10종'],
  },
  {
    categorySlug: 'test-season',
    slug: 'test-cooling-summer-pillow',
    sku: 'GNG-TEST-SEASON-001',
    name: '테스트 쿨링 여름 베개',
    brandName: 'GNG Home',
    brandCode: 'GNG-HOME',
    price: '45000',
    salePrice: '36900',
    thumbnail: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=900&q=80',
    optionName: '사이즈',
    optionValues: ['기본', '라지'],
  },
  {
    categorySlug: 'test-season',
    slug: 'test-warm-fleece-blanket',
    sku: 'GNG-TEST-SEASON-002',
    name: '테스트 웜 플리스 담요',
    brandName: 'GNG Home',
    brandCode: 'GNG-HOME',
    price: '31000',
    salePrice: '24800',
    thumbnail: 'https://images.unsplash.com/photo-1616627989910-2c47523c77d9?auto=format&fit=crop&w=900&q=80',
    optionName: '색상',
    optionValues: ['베이지', '차콜'],
  },
];

async function seedLuxuryBagProducts() {
  const category = await prisma.category.upsert({
    where: { slug: 'luxury-bags' },
    update: { name: '명품가방', isActive: true, sortOrder: 2 },
    create: {
      code: 'LUXURY_BAGS',
      slug: 'luxury-bags',
      name: '명품가방',
      depth: 0,
      sortOrder: 2,
      isActive: true,
    },
  });

  for (const [index, item] of luxuryBagProducts.entries()) {
    const [slug, name, sku, brandName, brandCode, price, salePrice, baseColor] = item;
    const baseColorCode = colorCodeMap[baseColor] ?? 'BASE';
    const brand = await prisma.brand.upsert({
      where: { code: brandCode },
      update: { name: brandName },
      create: { code: brandCode, name: brandName },
    });
    const thumbnail = luxuryBagImages[index];

    const product = await prisma.product.upsert({
      where: { slug },
      update: {
        sku,
        name,
        summary: '테스트 진열용 프리미엄 가방 상품입니다.',
        description: `<p>${name}은 모바일 상품 목록과 상세 화면 검증을 위한 테스트 상품입니다.</p>`,
        brandId: brand.id,
        price,
        salePrice,
        status: 'active',
        thumbnail,
        attributes: {
          seed: true,
          source: 'unsplash',
          material: '합성가죽',
          color: baseColor,
        },
      },
      create: {
        sku,
        slug,
        name,
        summary: '테스트 진열용 프리미엄 가방 상품입니다.',
        description: `<p>${name}은 모바일 상품 목록과 상세 화면 검증을 위한 테스트 상품입니다.</p>`,
        brandId: brand.id,
        price,
        salePrice,
        status: 'active',
        thumbnail,
        attributes: {
          seed: true,
          source: 'unsplash',
          material: '합성가죽',
          color: baseColor,
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
      update: { sortOrder: index + 1 },
      create: {
        categoryId: category.id,
        productId: product.id,
        sortOrder: index + 1,
      },
    });

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.createMany({
      data: [
        { productId: product.id, url: thumbnail, alt: name, sortOrder: 1, isMain: true },
        {
          productId: product.id,
          url: luxuryBagImages[(index + 5) % luxuryBagImages.length],
          alt: `${name} 상세 이미지`,
          sortOrder: 2,
          isMain: false,
        },
      ],
    });

    await prisma.productOption.deleteMany({ where: { productId: product.id } });
    await prisma.productOption.create({
      data: {
        productId: product.id,
        name: '색상',
        sortOrder: 1,
        values: [baseColor, '블랙'],
      },
    });

    await Promise.all([
      prisma.productSku.upsert({
        where: { code: `${sku}-${baseColorCode}` },
        update: {
          optionValues: { 색상: baseColor },
          stock: 30,
          reserved: 0,
          isActive: true,
        },
        create: {
          productId: product.id,
          code: `${sku}-${baseColorCode}`,
          optionValues: { 색상: baseColor },
          stock: 30,
          reserved: 0,
          isActive: true,
        },
      }),
      prisma.productSku.upsert({
        where: { code: `${sku}-BLACK` },
        update: {
          optionValues: { 색상: '블랙' },
          stock: 20,
          reserved: 0,
          isActive: true,
        },
        create: {
          productId: product.id,
          code: `${sku}-BLACK`,
          optionValues: { 색상: '블랙' },
          stock: 20,
          reserved: 0,
          isActive: true,
        },
      }),
    ]);
  }
}

async function seedAdditionalTestCatalog() {
  const categoryBySlug = new Map();

  for (const categorySeed of additionalTestCategories) {
    const category = await prisma.category.upsert({
      where: { slug: categorySeed.slug },
      update: {
        name: categorySeed.name,
        sortOrder: categorySeed.sortOrder,
        isActive: true,
      },
      create: {
        ...categorySeed,
        depth: 0,
        isActive: true,
      },
    });

    categoryBySlug.set(categorySeed.slug, category);
  }

  for (const [index, productSeed] of additionalTestProducts.entries()) {
    const category = categoryBySlug.get(productSeed.categorySlug);
    if (!category) throw new Error(`Seed category not found: ${productSeed.categorySlug}`);

    const brand = await prisma.brand.upsert({
      where: { code: productSeed.brandCode },
      update: { name: productSeed.brandName },
      create: { code: productSeed.brandCode, name: productSeed.brandName },
    });

    const product = await prisma.product.upsert({
      where: { slug: productSeed.slug },
      update: {
        sku: productSeed.sku,
        name: productSeed.name,
        summary: '목록, 상세, 주문 흐름 검증을 위한 테스트 상품입니다.',
        description: `<p>${productSeed.name}은 카테고리, 옵션, 재고, 이미지 노출을 함께 확인하기 위한 테스트 데이터입니다.</p>`,
        brandId: brand.id,
        price: productSeed.price,
        salePrice: productSeed.salePrice,
        status: 'active',
        thumbnail: productSeed.thumbnail,
        attributes: {
          seed: true,
          purpose: 'catalog-test',
          category: productSeed.categorySlug,
        },
      },
      create: {
        sku: productSeed.sku,
        slug: productSeed.slug,
        name: productSeed.name,
        summary: '목록, 상세, 주문 흐름 검증을 위한 테스트 상품입니다.',
        description: `<p>${productSeed.name}은 카테고리, 옵션, 재고, 이미지 노출을 함께 확인하기 위한 테스트 데이터입니다.</p>`,
        brandId: brand.id,
        price: productSeed.price,
        salePrice: productSeed.salePrice,
        status: 'active',
        thumbnail: productSeed.thumbnail,
        attributes: {
          seed: true,
          purpose: 'catalog-test',
          category: productSeed.categorySlug,
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
      update: { sortOrder: index + 1 },
      create: {
        categoryId: category.id,
        productId: product.id,
        sortOrder: index + 1,
      },
    });

    await prisma.productImage.deleteMany({ where: { productId: product.id } });
    await prisma.productImage.create({
      data: {
        productId: product.id,
        url: productSeed.thumbnail,
        alt: productSeed.name,
        sortOrder: 1,
        isMain: true,
      },
    });

    await prisma.productOption.deleteMany({ where: { productId: product.id } });
    await prisma.productOption.create({
      data: {
        productId: product.id,
        name: productSeed.optionName,
        sortOrder: 1,
        values: productSeed.optionValues,
      },
    });

    await Promise.all(
      productSeed.optionValues.map((optionValue, optionIndex) =>
        prisma.productSku.upsert({
          where: { code: `${productSeed.sku}-${optionIndex + 1}` },
          update: {
            optionValues: { [productSeed.optionName]: optionValue },
            stock: 25 + optionIndex * 10,
            reserved: 0,
            isActive: true,
          },
          create: {
            productId: product.id,
            code: `${productSeed.sku}-${optionIndex + 1}`,
            optionValues: { [productSeed.optionName]: optionValue },
            stock: 25 + optionIndex * 10,
            reserved: 0,
            isActive: true,
          },
        }),
      ),
    );
  }
}

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
        'api.read',
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

  await seedLuxuryBagProducts();
  await seedAdditionalTestCatalog();

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
