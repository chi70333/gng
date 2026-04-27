import type {
  Category,
  CategoryOnProduct,
  Product,
  ProductImage,
  ProductSku,
} from '@prisma/client';
import type { ReactNode } from 'react';
import { saveAdminProduct } from '../../actions';
import { ProductImageFields } from './ProductImageFields';

type ProductForForm =
  | (Pick<
      Product,
      | 'id'
      | 'sku'
      | 'slug'
      | 'name'
      | 'summary'
      | 'description'
      | 'price'
      | 'salePrice'
      | 'costPrice'
      | 'status'
      | 'thumbnail'
      | 'attributes'
    > & {
      skus: Pick<ProductSku, 'stock'>[];
      categories: Pick<CategoryOnProduct, 'categoryId'>[];
      images: Pick<ProductImage, 'url' | 'alt' | 'sortOrder' | 'isMain'>[];
    })
  | null;

type LegacyAdminAttributes = {
  display: '1' | '0';
  isEmpty: '0' | '1';
  useStock: '1' | '2';
  pointRate: number;
  expectedShipDays: number;
  buyMin: number;
  buyUseMax: '1' | '0';
  buyMax: number | null;
  priceReplacementText: string;
  searchKeywords: string;
  importFlag: 'Y' | 'N';
  quantityDiscountVisible: 'Y' | 'N';
};

const DEFAULT_LEGACY_ADMIN: LegacyAdminAttributes = {
  display: '1',
  isEmpty: '0',
  useStock: '1',
  pointRate: 0,
  expectedShipDays: 0,
  buyMin: 1,
  buyUseMax: '1',
  buyMax: null,
  priceReplacementText: '',
  searchKeywords: '',
  importFlag: 'N',
  quantityDiscountVisible: 'N',
};

const inputClass =
  'mt-1.5 min-h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-950 shadow-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10 md:min-h-10';
const textareaClass =
  'mt-1.5 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm outline-none focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10';
const sectionClass = 'overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function legacyChoice(value: unknown, allowed: readonly string[], fallback: string): string {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}

function legacyNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function legacyText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function getLegacyAdmin(attributes: unknown): LegacyAdminAttributes {
  const legacyAdmin =
    isRecord(attributes) && isRecord(attributes.legacyAdmin) ? attributes.legacyAdmin : {};

  return {
    display: legacyChoice(legacyAdmin.display, ['1', '0'], DEFAULT_LEGACY_ADMIN.display) as
      | '1'
      | '0',
    isEmpty: legacyChoice(legacyAdmin.isEmpty, ['0', '1'], DEFAULT_LEGACY_ADMIN.isEmpty) as
      | '0'
      | '1',
    useStock: legacyChoice(legacyAdmin.useStock, ['1', '2'], DEFAULT_LEGACY_ADMIN.useStock) as
      | '1'
      | '2',
    pointRate: legacyNumber(legacyAdmin.pointRate, DEFAULT_LEGACY_ADMIN.pointRate),
    expectedShipDays: legacyNumber(
      legacyAdmin.expectedShipDays,
      DEFAULT_LEGACY_ADMIN.expectedShipDays,
    ),
    buyMin: legacyNumber(legacyAdmin.buyMin, DEFAULT_LEGACY_ADMIN.buyMin),
    buyUseMax: legacyChoice(legacyAdmin.buyUseMax, ['1', '0'], DEFAULT_LEGACY_ADMIN.buyUseMax) as
      | '1'
      | '0',
    buyMax: legacyAdmin.buyMax === null ? null : legacyNumber(legacyAdmin.buyMax, 0) || null,
    priceReplacementText: legacyText(legacyAdmin.priceReplacementText),
    searchKeywords: legacyText(legacyAdmin.searchKeywords),
    importFlag: legacyChoice(
      legacyAdmin.importFlag,
      ['Y', 'N'],
      DEFAULT_LEGACY_ADMIN.importFlag,
    ) as 'Y' | 'N',
    quantityDiscountVisible: legacyChoice(
      legacyAdmin.quantityDiscountVisible,
      ['Y', 'N'],
      DEFAULT_LEGACY_ADMIN.quantityDiscountVisible,
    ) as 'Y' | 'N',
  };
}

function FieldLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="text-xs font-extrabold text-neutral-700">
      {children}
      {required ? <span className="text-red-600"> *</span> : null}
    </span>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={sectionClass}>
      <div className="border-b border-neutral-100 bg-neutral-50/70 px-4 py-3">
        <h2 className="text-sm font-extrabold text-neutral-950">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-neutral-500">{description}</p> : null}
      </div>
      <div className="grid gap-3 p-4">{children}</div>
    </section>
  );
}

function RadioCard({
  name,
  value,
  defaultChecked,
  children,
}: {
  name: string;
  value: string;
  defaultChecked: boolean;
  children: ReactNode;
}) {
  return (
    <label className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-sm font-bold text-neutral-800 shadow-sm md:min-h-10">
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} />
      {children}
    </label>
  );
}

export function ProductForm({
  product,
  categories,
}: {
  product: ProductForForm;
  categories: Pick<Category, 'id' | 'name' | 'depth'>[];
}) {
  const legacy = getLegacyAdmin(product?.attributes);
  const selected = product?.categories.map((item) => item.categoryId.toString()) ?? [];
  const selectedSet = new Set(selected);
  const primaryCategoryId = selected[0] ?? '';
  const stock = product?.skus.reduce((sum, sku) => sum + sku.stock, 0) ?? 0;
  const images =
    product?.images && product.images.length > 0
      ? product.images
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((image) => ({ url: image.url, alt: image.alt ?? '' }))
      : product?.thumbnail
        ? [{ url: product.thumbnail, alt: product.name }]
        : [];
  const mainImageIndex = product?.images.findIndex((image) => image.isMain) ?? 0;

  return (
    <form action={saveAdminProduct} className="space-y-4">
      {product ? <input type="hidden" name="id" value={product.id.toString()} /> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <Section
            title="상품 기본 정보"
            description="관리자가 가장 자주 수정하는 상품명, 코드, 주소를 먼저 배치했습니다."
          >
            <label className="block">
              <FieldLabel required>상품명</FieldLabel>
              <input
                name="name"
                defaultValue={product?.name ?? ''}
                required
                placeholder="상품명을 입력하세요"
                className={inputClass}
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <FieldLabel required>상품 코드</FieldLabel>
                <input
                  name="sku"
                  defaultValue={product?.sku ?? ''}
                  required
                  className={inputClass}
                />
              </label>
              <label className="block">
                <FieldLabel required>상품 주소</FieldLabel>
                <input
                  name="slug"
                  defaultValue={product?.slug ?? ''}
                  required
                  placeholder="sample-product"
                  className={inputClass}
                />
              </label>
            </div>

            <label className="block">
              <FieldLabel>상품 주요 특징</FieldLabel>
              <textarea
                name="summary"
                defaultValue={product?.summary ?? ''}
                rows={2}
                maxLength={500}
                className={textareaClass}
              />
            </label>
          </Section>

          <Section
            title="카테고리와 검색"
            description="대표 카테고리와 추가 노출 카테고리, 검색 메모를 관리합니다."
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,320px)_1fr]">
              <label className="block">
                <FieldLabel required>대표 카테고리</FieldLabel>
                <select
                  name="categoryIds"
                  defaultValue={primaryCategoryId}
                  required
                  className={inputClass}
                >
                  <option value="">카테고리 선택</option>
                  {categories.map((category) => (
                    <option key={category.id.toString()} value={category.id.toString()}>
                      {'-'.repeat(category.depth)} {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <FieldLabel>추가 카테고리</FieldLabel>
                <div className="mt-1.5 grid max-h-40 gap-x-3 gap-y-1 overflow-auto rounded-md border border-neutral-300 bg-white p-2 md:grid-cols-2">
                  {categories.map((category) => (
                    <label
                      key={category.id.toString()}
                      className="flex min-h-8 items-center gap-2 rounded px-1 text-sm hover:bg-neutral-50"
                    >
                      <input
                        type="checkbox"
                        name="categoryIds"
                        value={category.id.toString()}
                        defaultChecked={selectedSet.has(category.id.toString())}
                        className="h-4 w-4 accent-neutral-900"
                      />
                      <span className="truncate" style={{ paddingLeft: category.depth * 10 }}>
                        {category.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_160px]">
              <label className="block">
                <FieldLabel>검색어/제조사 메모</FieldLabel>
                <textarea
                  name="searchKeywords"
                  defaultValue={legacy.searchKeywords}
                  rows={2}
                  maxLength={400}
                  placeholder="검색어를 줄 단위로 입력"
                  className={textareaClass}
                />
              </label>
              <label className="block">
                <FieldLabel>예상 출고일</FieldLabel>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    name="expectedShipDays"
                    type="number"
                    min={0}
                    max={99}
                    defaultValue={legacy.expectedShipDays}
                    className={inputClass.replace('mt-1.5', '')}
                  />
                  <span className="whitespace-nowrap text-sm text-neutral-500">일</span>
                </div>
              </label>
            </div>
          </Section>

          <Section
            title="상품 이미지"
            description="대표 이미지를 먼저 지정하고, 필요한 이미지 설명을 함께 저장합니다."
          >
            <ProductImageFields
              initialImages={images}
              initialMainIndex={mainImageIndex >= 0 ? mainImageIndex : 0}
            />
          </Section>

          <Section title="상세 설명" description="상품 안내 문구와 상세 설명을 입력합니다.">
            <label className="block">
              <FieldLabel>상품 안내</FieldLabel>
              <textarea
                name="description"
                defaultValue={product?.description ?? ''}
                rows={10}
                className={textareaClass}
              />
            </label>
          </Section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Section title="판매 상태" description="노출, 품절, 판매 상태를 빠르게 확인합니다.">
            <label className="block">
              <FieldLabel required>판매 상태</FieldLabel>
              <select
                name="status"
                defaultValue={product?.status ?? 'draft'}
                className={inputClass}
              >
                <option value="draft">임시저장</option>
                <option value="active">판매중</option>
                <option value="sold_out">품절</option>
                <option value="hidden">숨김</option>
              </select>
            </label>

            <div>
              <FieldLabel>상품 노출</FieldLabel>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <RadioCard name="display" value="1" defaultChecked={legacy.display === '1'}>
                  노출
                </RadioCard>
                <RadioCard name="display" value="0" defaultChecked={legacy.display === '0'}>
                  미노출
                </RadioCard>
              </div>
            </div>

            <div>
              <FieldLabel>일시 품절</FieldLabel>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <RadioCard name="isEmpty" value="0" defaultChecked={legacy.isEmpty === '0'}>
                  판매중
                </RadioCard>
                <RadioCard name="isEmpty" value="1" defaultChecked={legacy.isEmpty === '1'}>
                  일시 품절
                </RadioCard>
              </div>
            </div>
          </Section>

          <Section
            title="가격과 재고"
            description="금액, 재고, 마일리지와 주문 수량을 한곳에서 조정합니다."
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="block">
                <FieldLabel required>판매가</FieldLabel>
                <input
                  name="price"
                  inputMode="decimal"
                  defaultValue={product?.price.toString() ?? '0'}
                  required
                  className={inputClass}
                />
              </label>
              <label className="block">
                <FieldLabel>할인 판매가</FieldLabel>
                <input
                  name="salePrice"
                  inputMode="decimal"
                  defaultValue={product?.salePrice?.toString() ?? ''}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <FieldLabel>원가</FieldLabel>
                <input
                  name="costPrice"
                  inputMode="decimal"
                  defaultValue={product?.costPrice?.toString() ?? ''}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <FieldLabel>판매가 대체 문구</FieldLabel>
                <input
                  name="priceReplacementText"
                  defaultValue={legacy.priceReplacementText}
                  placeholder="예: 견적문의"
                  className={inputClass}
                />
              </label>
            </div>

            <div>
              <FieldLabel>재고 수량</FieldLabel>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <RadioCard name="useStock" value="1" defaultChecked={legacy.useStock === '1'}>
                  무제한
                </RadioCard>
                <RadioCard name="useStock" value="2" defaultChecked={legacy.useStock === '2'}>
                  수량관리
                </RadioCard>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <label className="block">
                <FieldLabel>재고</FieldLabel>
                <input
                  name="stock"
                  type="number"
                  min={0}
                  defaultValue={stock}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <FieldLabel>마일리지 적립률</FieldLabel>
                <div className="mt-1.5 flex items-center gap-2">
                  <input
                    name="pointRate"
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    defaultValue={legacy.pointRate}
                    className={inputClass.replace('mt-1.5', '')}
                  />
                  <span className="text-sm text-neutral-500">%</span>
                </div>
              </label>
              <label className="block">
                <FieldLabel>최소 주문 수량</FieldLabel>
                <input
                  name="buyMin"
                  type="number"
                  min={1}
                  defaultValue={legacy.buyMin}
                  className={inputClass}
                />
              </label>
            </div>

            <div>
              <FieldLabel>최대 주문 수량</FieldLabel>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <RadioCard name="buyUseMax" value="1" defaultChecked={legacy.buyUseMax === '1'}>
                  제한 없음
                </RadioCard>
                <RadioCard name="buyUseMax" value="0" defaultChecked={legacy.buyUseMax === '0'}>
                  제한
                </RadioCard>
              </div>
            </div>

            <label className="block">
              <FieldLabel>최대 수량</FieldLabel>
              <input
                name="buyMax"
                type="number"
                min={1}
                defaultValue={legacy.buyMax ?? ''}
                className={inputClass}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div>
                <FieldLabel>해외 판매</FieldLabel>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <RadioCard name="importFlag" value="Y" defaultChecked={legacy.importFlag === 'Y'}>
                    노출
                  </RadioCard>
                  <RadioCard name="importFlag" value="N" defaultChecked={legacy.importFlag === 'N'}>
                    미노출
                  </RadioCard>
                </div>
              </div>
              <div>
                <FieldLabel>수량별 할인표</FieldLabel>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  <RadioCard
                    name="quantityDiscountVisible"
                    value="Y"
                    defaultChecked={legacy.quantityDiscountVisible === 'Y'}
                  >
                    노출
                  </RadioCard>
                  <RadioCard
                    name="quantityDiscountVisible"
                    value="N"
                    defaultChecked={legacy.quantityDiscountVisible === 'N'}
                  >
                    미노출
                  </RadioCard>
                </div>
              </div>
            </div>
          </Section>
        </aside>
      </div>

      <div className="sticky bottom-0 -mx-2 border-t border-neutral-200 bg-white/95 p-3 backdrop-blur">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <a
            href="/admin/products"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-neutral-300 bg-white px-5 text-sm font-bold text-neutral-800 shadow-sm hover:bg-neutral-50 md:min-h-10"
          >
            목록
          </a>
          <button className="min-h-11 rounded-md bg-neutral-900 px-6 text-sm font-extrabold text-white shadow-sm hover:bg-neutral-800 md:min-h-10">
            상품 저장
          </button>
        </div>
      </div>
    </form>
  );
}
