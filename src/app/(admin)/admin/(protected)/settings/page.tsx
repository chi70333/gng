// Legacy sources: wb_admin/adm.php, wb_admin/company.php, wb_admin/adm_etc.php
// Cache: no-store. Settings affect public policies and operational behavior.

import type { Metadata } from 'next';
import { Building2, Clock3, FileText, Save, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
import {
  AdminDataGrid,
  AdminMobileCard,
  AdminMobileField,
  adminGridButtonClass,
  adminGridCellClass,
  adminGridStickyCellClass,
} from '@/components/admin/AdminDataGrid';
import {
  compareAdminValues,
  createAdminSortHref,
  parseAdminSort,
} from '@/components/admin/admin-grid-sort';
import {
  AdminPageHeader,
  AdminSection,
  adminFieldClass,
  adminPrimaryButtonClass,
  adminTextareaClass,
} from '@/components/admin/AdminUI';
import { saveAdminAccount, saveAdminSettings } from '../../actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '사이트 설정',
};

const ADMIN_ROLES = [
  { value: 'super_admin', label: '최고관리자' },
  { value: 'manager', label: '매니저' },
  { value: 'operator', label: '운영자' },
  { value: 'viewer', label: '조회전용' },
];

const ADMIN_PERMISSIONS = [
  { value: 'product.read', label: '상품 조회' },
  { value: 'product.write', label: '상품 수정' },
  { value: 'order.read', label: '주문 조회' },
  { value: 'order.write', label: '주문 수정' },
  { value: 'user.read', label: '회원 조회' },
  { value: 'user.write', label: '회원 수정' },
  { value: 'coupon.read', label: '쿠폰 조회' },
  { value: 'coupon.write', label: '쿠폰 수정' },
  { value: 'content.read', label: '게시판 조회' },
  { value: 'content.write', label: '게시판 수정' },
  { value: 'settings.read', label: '설정 조회' },
  { value: 'settings.write', label: '설정 수정' },
  { value: 'admin.manage', label: '관리자 관리' },
];

function permissionValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

const ADMIN_ACCOUNT_SORT_KEYS = [
  'no',
  'loginId',
  'email',
  'name',
  'role',
  'status',
  'lastLoginAt',
] as const;

type SettingsSearchParams = {
  sort?: string;
  dir?: string;
};

function TextInput({
  name,
  label,
  value,
  required,
}: {
  name: string;
  label: string;
  value: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-center">
      <span className="text-xs font-bold text-neutral-600">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </span>
      <input name={name} defaultValue={value} required={required} className={adminFieldClass} />
    </label>
  );
}

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: SettingsSearchParams;
}) {
  await requireAdmin('settings.read');
  const [policy, adminUsers] = await Promise.all([
    prisma.sitePolicy.findUnique({ where: { key: 'default' } }),
    prisma.adminUser.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        loginId: true,
        email: true,
        name: true,
        role: true,
        permissions: true,
        status: true,
        lastLoginAt: true,
      },
    }),
  ]);
  const sortState = parseAdminSort(searchParams, ADMIN_ACCOUNT_SORT_KEYS);
  const effectiveSort = sortState.sort ?? 'no';
  const sortedAdminUsers = [...adminUsers].sort((a, b) => {
    if (effectiveSort === 'no') return compareAdminValues(a.id, b.id, sortState.dir);
    return compareAdminValues(a[effectiveSort], b[effectiveSort], sortState.dir);
  });
  const params = new URLSearchParams();
  if (sortState.sort) {
    params.set('sort', sortState.sort);
    params.set('dir', sortState.dir);
  }

  return (
    <div className="min-w-0 space-y-4">
      <AdminPageHeader
        title="사이트 설정"
        description="회사정보, 고객센터, 입금계좌, 약관 정보를 관리합니다."
      />

      <form action={saveAdminSettings} className="grid gap-4 xl:grid-cols-2">
        <AdminSection
          title="회사 정보"
          description="사업자 표시와 개인정보 책임자 정보를 입력합니다."
          icon={Building2}
        >
          <div className="grid gap-2.5">
            <TextInput
              name="companyName"
              label="회사명"
              value={policy?.companyName ?? ''}
              required
            />
            <TextInput name="companyCeo" label="대표자" value={policy?.companyCeo ?? ''} />
            <TextInput
              name="businessNumber"
              label="사업자등록번호"
              value={policy?.businessNumber ?? ''}
            />
            <TextInput
              name="mailOrderNumber"
              label="통신판매 신고번호"
              value={policy?.mailOrderNumber ?? ''}
            />
            <TextInput
              name="companyAddress"
              label="회사 주소"
              value={policy?.companyAddress ?? ''}
            />
            <TextInput
              name="companyTel"
              label="대표 전화"
              value={policy?.companyTel ?? ''}
              required
            />
            <TextInput name="companyFax" label="팩스" value={policy?.companyFax ?? ''} />
            <TextInput
              name="companyEmail"
              label="대표 이메일"
              value={policy?.companyEmail ?? ''}
              required
            />
            <TextInput
              name="privacyOfficer"
              label="개인정보 책임자"
              value={policy?.privacyOfficer ?? ''}
              required
            />
          </div>
        </AdminSection>

        <AdminSection
          title="운영 정보"
          description="고객센터 운영시간과 무통장 입금 정보를 관리합니다."
          icon={Clock3}
        >
          <div className="grid gap-2.5">
            <TextInput
              name="customerCenterTel"
              label="고객센터 전화"
              value={policy?.customerCenterTel ?? ''}
            />
            <TextInput
              name="weekdayHours"
              label="평일 운영시간"
              value={policy?.weekdayHours ?? ''}
            />
            <TextInput
              name="saturdayHours"
              label="토요일 운영시간"
              value={policy?.saturdayHours ?? ''}
            />
            <TextInput name="lunchHours" label="점심시간" value={policy?.lunchHours ?? ''} />
            <TextInput name="bankName" label="입금 은행" value={policy?.bankName ?? ''} />
            <TextInput
              name="bankLogoText"
              label="입금계좌 표시명"
              value={policy?.bankLogoText ?? ''}
            />
            <TextInput name="bankAccount" label="입금 계좌" value={policy?.bankAccount ?? ''} />
            <label className="grid gap-1.5 sm:grid-cols-[132px_minmax(0,1fr)] sm:items-center">
              <span className="text-xs font-bold text-neutral-600">약관 HTML</span>
              <span className="inline-flex h-9 items-center gap-2 rounded border border-neutral-300 bg-neutral-50/80 px-2.5 text-[13px] font-bold text-neutral-800 shadow-inner shadow-neutral-950/[0.025]">
                <input
                  type="checkbox"
                  name="htmlEnabled"
                  defaultChecked={policy?.htmlEnabled ?? false}
                  className="h-4 w-4 rounded border-neutral-300 accent-neutral-900"
                />
                렌더링 허용
              </span>
            </label>
          </div>
        </AdminSection>

        <AdminSection
          title="약관 문서"
          description="고객에게 노출되는 정책 문서입니다."
          icon={FileText}
          className="xl:col-span-2"
        >
          <div className="grid gap-3 xl:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold text-neutral-600">이용약관</span>
              <textarea
                name="terms"
                defaultValue={policy?.terms ?? ''}
                rows={7}
                required
                className={`mt-1.5 ${adminTextareaClass}`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-neutral-600">개인정보처리방침</span>
              <textarea
                name="privacy"
                defaultValue={policy?.privacy ?? ''}
                rows={7}
                required
                className={`mt-1.5 ${adminTextareaClass}`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-neutral-600">개인정보 수집 동의</span>
              <textarea
                name="collectionConsent"
                defaultValue={policy?.collectionConsent ?? ''}
                rows={6}
                required
                className={`mt-1.5 ${adminTextareaClass}`}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-neutral-600">회사소개</span>
              <textarea
                name="companyInfo"
                defaultValue={policy?.companyInfo ?? ''}
                rows={6}
                required
                className={`mt-1.5 ${adminTextareaClass}`}
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end border-t border-neutral-100 pt-3">
            <button className={adminPrimaryButtonClass}>
              <Save size={15} />
              설정 저장
            </button>
          </div>
        </AdminSection>
      </form>

      <AdminSection
        title="관리자 계정"
        description="계정, 역할, 권한, 상태를 한 화면에서 관리합니다."
        icon={UsersRound}
      >
        <form action={saveAdminAccount} className="grid gap-3 border-b border-neutral-200 pb-3">
          <div className="grid gap-2 md:grid-cols-[140px_minmax(190px,1fr)_120px_150px_140px_120px]">
            <input name="loginId" placeholder="관리자 ID" className={adminFieldClass} required />
            <input
              name="email"
              type="email"
              placeholder="이메일"
              className={adminFieldClass}
              required
            />
            <input name="name" placeholder="이름" className={adminFieldClass} required />
            <input
              name="password"
              type="password"
              placeholder="초기 비밀번호"
              className={adminFieldClass}
              required
            />
            <select name="role" defaultValue="operator" className={adminFieldClass}>
              {ADMIN_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <select name="status" defaultValue="active" className={adminFieldClass}>
              <option value="active">사용</option>
              <option value="inactive">중지</option>
              <option value="blocked">차단</option>
            </select>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {ADMIN_PERMISSIONS.map((permission) => (
              <label
                key={permission.value}
                className="flex h-8 items-center gap-2 rounded border border-neutral-200 bg-neutral-50/80 px-2 text-xs font-semibold text-neutral-700 shadow-sm shadow-neutral-950/[0.025]"
              >
                <input
                  type="checkbox"
                  name="permissions"
                  value={permission.value}
                  className="h-3.5 w-3.5 rounded border-neutral-300 accent-neutral-900"
                />
                {permission.label}
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <button className={adminPrimaryButtonClass}>
              <UserPlus size={15} />
              관리자 등록
            </button>
          </div>
        </form>

        <div className="mt-3">
          <AdminDataGrid
            caption="관리자 계정 목록"
            columns={[
              { key: 'no', label: 'No', align: 'right', widthClassName: 'w-14', sortKey: 'no' },
              {
                key: 'loginId',
                label: '관리자 ID',
                widthClassName: 'w-32',
                priority: 'primary',
                sortKey: 'loginId',
              },
              { key: 'email', label: '이메일', widthClassName: 'w-60', sortKey: 'email' },
              { key: 'name', label: '이름', widthClassName: 'w-36', sortKey: 'name' },
              { key: 'password', label: '비밀번호', widthClassName: 'w-44' },
              { key: 'role', label: '역할', widthClassName: 'w-36', sortKey: 'role' },
              { key: 'permissions', label: '권한', widthClassName: 'w-[440px]' },
              { key: 'status', label: '상태', widthClassName: 'w-32', sortKey: 'status' },
              {
                key: 'lastLogin',
                label: '최근 로그인',
                align: 'right',
                widthClassName: 'w-28',
                sortKey: 'lastLoginAt',
              },
              { key: 'save', label: '저장', align: 'right', widthClassName: 'w-24' },
            ]}
            rows={sortedAdminUsers}
            rowKey={(adminUser) => adminUser.id.toString()}
            emptyText="등록된 관리자 계정이 없습니다."
            minWidthClassName="min-w-[1320px]"
            currentSortKey={sortState.sort}
            currentSortDirection={sortState.dir}
            getSortHref={createAdminSortHref('/admin/settings', params)}
            renderRow={(adminUser, index) => {
              const permissions = permissionValues(adminUser.permissions);
              return (
                <tr
                  key={adminUser.id.toString()}
                  className="bg-white align-top transition hover:bg-neutral-50"
                >
                  <td className={`${adminGridCellClass} text-right font-bold text-neutral-500`}>
                    {sortedAdminUsers.length - index}
                  </td>
                  <td className={adminGridStickyCellClass}>
                    <form id={`admin-user-${adminUser.id.toString()}`} action={saveAdminAccount}>
                      <input type="hidden" name="id" value={adminUser.id.toString()} />
                      <input
                        name="loginId"
                        defaultValue={adminUser.loginId}
                        className={`${adminFieldClass} font-bold`}
                      />
                    </form>
                  </td>
                  <td className={adminGridCellClass}>
                    <input
                      form={`admin-user-${adminUser.id.toString()}`}
                      name="email"
                      type="email"
                      defaultValue={adminUser.email}
                      className={adminFieldClass}
                    />
                  </td>
                  <td className={adminGridCellClass}>
                    <input
                      form={`admin-user-${adminUser.id.toString()}`}
                      name="name"
                      defaultValue={adminUser.name}
                      className={adminFieldClass}
                    />
                  </td>
                  <td className={adminGridCellClass}>
                    <input
                      form={`admin-user-${adminUser.id.toString()}`}
                      name="password"
                      type="password"
                      placeholder="변경 시 입력"
                      className={adminFieldClass}
                    />
                  </td>
                  <td className={adminGridCellClass}>
                    <select
                      form={`admin-user-${adminUser.id.toString()}`}
                      name="role"
                      defaultValue={adminUser.role}
                      className={adminFieldClass}
                    >
                      {ADMIN_ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={adminGridCellClass}>
                    <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2">
                      {ADMIN_PERMISSIONS.map((permission) => (
                        <label
                          key={permission.value}
                          className="flex items-center gap-1.5 text-xs font-medium text-neutral-700"
                        >
                          <input
                            form={`admin-user-${adminUser.id.toString()}`}
                            type="checkbox"
                            name="permissions"
                            value={permission.value}
                            defaultChecked={permissions.includes(permission.value)}
                            className="h-3.5 w-3.5 rounded border-neutral-300 accent-neutral-900"
                          />
                          {permission.label}
                        </label>
                      ))}
                    </div>
                  </td>
                  <td className={adminGridCellClass}>
                    <select
                      form={`admin-user-${adminUser.id.toString()}`}
                      name="status"
                      defaultValue={adminUser.status}
                      className={adminFieldClass}
                    >
                      <option value="active">사용</option>
                      <option value="inactive">중지</option>
                      <option value="blocked">차단</option>
                    </select>
                  </td>
                  <td
                    className={`${adminGridCellClass} text-right text-xs font-medium text-neutral-500`}
                  >
                    {adminUser.lastLoginAt?.toLocaleDateString('ko-KR') ?? '이력 없음'}
                  </td>
                  <td className={`${adminGridCellClass} text-right`}>
                    <button
                      form={`admin-user-${adminUser.id.toString()}`}
                      className={adminGridButtonClass}
                    >
                      <ShieldCheck size={14} />
                      저장
                    </button>
                  </td>
                </tr>
              );
            }}
            renderMobileCard={(adminUser) => {
              const permissions = permissionValues(adminUser.permissions);
              return (
                <AdminMobileCard>
                  <form
                    id={`admin-user-mobile-${adminUser.id.toString()}`}
                    action={saveAdminAccount}
                    className="grid gap-2"
                  >
                    <input type="hidden" name="id" value={adminUser.id.toString()} />
                    <input
                      name="loginId"
                      defaultValue={adminUser.loginId}
                      className={`${adminFieldClass} h-11 font-bold`}
                      aria-label="관리자 ID"
                    />
                    <input
                      name="email"
                      type="email"
                      defaultValue={adminUser.email}
                      className={`${adminFieldClass} h-11`}
                      aria-label="이메일"
                    />
                    <input
                      name="name"
                      defaultValue={adminUser.name}
                      className={`${adminFieldClass} h-11`}
                      aria-label="이름"
                    />
                    <input
                      name="password"
                      type="password"
                      placeholder="변경 시 입력"
                      className={`${adminFieldClass} h-11`}
                      aria-label="비밀번호"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        name="role"
                        defaultValue={adminUser.role}
                        className={`${adminFieldClass} h-11`}
                        aria-label="역할"
                      >
                        {ADMIN_ROLES.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                      <select
                        name="status"
                        defaultValue={adminUser.status}
                        className={`${adminFieldClass} h-11`}
                        aria-label="상태"
                      >
                        <option value="active">사용</option>
                        <option value="inactive">중지</option>
                        <option value="blocked">차단</option>
                      </select>
                    </div>
                    <div className="grid gap-1.5 rounded-md bg-neutral-50 p-2 sm:grid-cols-2">
                      {ADMIN_PERMISSIONS.map((permission) => (
                        <label
                          key={permission.value}
                          className="flex min-h-8 items-center gap-2 text-xs font-medium text-neutral-700"
                        >
                          <input
                            type="checkbox"
                            name="permissions"
                            value={permission.value}
                            defaultChecked={permissions.includes(permission.value)}
                            className="h-3.5 w-3.5 rounded border-neutral-300 accent-neutral-900"
                          />
                          {permission.label}
                        </label>
                      ))}
                    </div>
                    <dl className="grid gap-2">
                      <AdminMobileField label="최근 로그인" align="right">
                        {adminUser.lastLoginAt?.toLocaleDateString('ko-KR') ?? '이력 없음'}
                      </AdminMobileField>
                    </dl>
                    <button className={adminGridButtonClass}>
                      <ShieldCheck size={14} />
                      저장
                    </button>
                  </form>
                </AdminMobileCard>
              );
            }}
          />
        </div>
      </AdminSection>
    </div>
  );
}
