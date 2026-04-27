// Legacy sources: wb_admin/adm.php, wb_admin/company.php, wb_admin/adm_etc.php
// Cache: no-store. Settings affect public policies and operational behavior.

import type { Metadata } from 'next';
import { prisma } from '@/server/db';
import { requireAdmin } from '@/server/admin/auth';
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
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input
        name={name}
        defaultValue={value}
        required={required}
        className="mt-2 min-h-11 w-full rounded-md border border-neutral-200 px-3"
      />
    </label>
  );
}

export default async function AdminSettingsPage() {
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

  return (
    <div>
      <h1 className="text-xl font-extrabold text-neutral-950">사이트 설정</h1>
      <p className="mt-1 text-sm text-neutral-500">
        레거시 회사정보, 고객센터, 입금계좌, 약관 정보를 한 화면에서 관리합니다.
      </p>
      <form action={saveAdminSettings} className="mt-5 grid gap-5 xl:grid-cols-2">
        <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-base font-extrabold">회사 정보</h2>
          <TextInput name="companyName" label="회사명" value={policy?.companyName ?? ''} required />
          <TextInput name="companyCeo" label="대표자" value={policy?.companyCeo ?? ''} />
          <TextInput name="businessNumber" label="사업자등록번호" value={policy?.businessNumber ?? ''} />
          <TextInput name="mailOrderNumber" label="통신판매업 신고번호" value={policy?.mailOrderNumber ?? ''} />
          <TextInput name="companyAddress" label="회사 주소" value={policy?.companyAddress ?? ''} />
          <TextInput name="companyTel" label="대표 전화" value={policy?.companyTel ?? ''} required />
          <TextInput name="companyFax" label="팩스" value={policy?.companyFax ?? ''} />
          <TextInput name="companyEmail" label="대표 이메일" value={policy?.companyEmail ?? ''} required />
          <TextInput name="privacyOfficer" label="개인정보 책임자" value={policy?.privacyOfficer ?? ''} required />
        </section>

        <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="text-base font-extrabold">운영 정보</h2>
          <TextInput name="customerCenterTel" label="고객센터 전화" value={policy?.customerCenterTel ?? ''} />
          <TextInput name="weekdayHours" label="평일 운영시간" value={policy?.weekdayHours ?? ''} />
          <TextInput name="saturdayHours" label="토요일 운영시간" value={policy?.saturdayHours ?? ''} />
          <TextInput name="lunchHours" label="점심시간" value={policy?.lunchHours ?? ''} />
          <TextInput name="bankName" label="입금 은행" value={policy?.bankName ?? ''} />
          <TextInput name="bankLogoText" label="입금계좌 표시명" value={policy?.bankLogoText ?? ''} />
          <TextInput name="bankAccount" label="입금 계좌" value={policy?.bankAccount ?? ''} />
          <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
            <input type="checkbox" name="htmlEnabled" defaultChecked={policy?.htmlEnabled ?? false} />
            약관 HTML 렌더링 허용
          </label>
        </section>

        <section className="space-y-4 rounded-lg border border-neutral-200 bg-white p-4 xl:col-span-2">
          <h2 className="text-base font-extrabold">약관 문서</h2>
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="block">
              <span className="text-sm font-bold">이용약관</span>
              <textarea
                name="terms"
                defaultValue={policy?.terms ?? ''}
                rows={8}
                required
                className="mt-2 w-full rounded-md border border-neutral-200 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold">개인정보처리방침</span>
              <textarea
                name="privacy"
                defaultValue={policy?.privacy ?? ''}
                rows={8}
                required
                className="mt-2 w-full rounded-md border border-neutral-200 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold">개인정보 수집 동의</span>
              <textarea
                name="collectionConsent"
                defaultValue={policy?.collectionConsent ?? ''}
                rows={6}
                required
                className="mt-2 w-full rounded-md border border-neutral-200 px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-bold">회사소개</span>
              <textarea
                name="companyInfo"
                defaultValue={policy?.companyInfo ?? ''}
                rows={6}
                required
                className="mt-2 w-full rounded-md border border-neutral-200 px-3 py-2"
              />
            </label>
          </div>
          <button className="min-h-12 w-full rounded-md bg-neutral-900 text-sm font-extrabold text-white">
            설정 저장
          </button>
        </section>
      </form>

      <section className="mt-5 space-y-5 rounded-lg border border-neutral-200 bg-white p-4">
        <div>
          <h2 className="text-base font-extrabold">관리자 계정</h2>
          <p className="mt-1 text-sm text-neutral-500">
            레거시 관리자 설정처럼 계정, 역할, 권한, 상태를 한 화면에서 관리합니다.
          </p>
        </div>

        <form action={saveAdminAccount} className="grid gap-3 border-b border-neutral-100 pb-5">
          <div className="grid gap-3 md:grid-cols-[140px_1fr_1fr_1fr_150px_140px]">
            <input name="loginId" placeholder="관리자 ID" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required />
            <input name="email" type="email" placeholder="이메일" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required />
            <input name="name" placeholder="이름" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required />
            <input name="password" type="password" placeholder="초기 비밀번호" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm" required />
            <select name="role" defaultValue="operator" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm">
              {ADMIN_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <select name="status" defaultValue="active" className="min-h-11 rounded-md border border-neutral-200 px-3 text-sm">
              <option value="active">사용</option>
              <option value="inactive">중지</option>
              <option value="blocked">차단</option>
            </select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {ADMIN_PERMISSIONS.map((permission) => (
              <label key={permission.value} className="flex min-h-10 items-center gap-2 rounded-md border border-neutral-100 px-3 text-sm">
                <input type="checkbox" name="permissions" value={permission.value} />
                {permission.label}
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <button className="min-h-11 rounded-md bg-neutral-900 px-5 text-sm font-extrabold text-white">
              관리자 등록
            </button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-neutral-50 text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-3 text-left">계정</th>
                <th className="w-36 px-4 py-3 text-left">역할</th>
                <th className="w-[420px] px-4 py-3 text-left">권한</th>
                <th className="w-32 px-4 py-3 text-left">상태</th>
                <th className="w-36 px-4 py-3 text-right">최근 로그인</th>
                <th className="w-24 px-4 py-3 text-right">저장</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {adminUsers.map((adminUser) => {
                const permissions = permissionValues(adminUser.permissions);
                return (
                  <tr key={adminUser.id.toString()} className="align-top hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <form id={`admin-user-${adminUser.id.toString()}`} action={saveAdminAccount} className="grid gap-2">
                        <input type="hidden" name="id" value={adminUser.id.toString()} />
                        <input name="loginId" defaultValue={adminUser.loginId} className="min-h-10 rounded-md border border-neutral-200 px-3 text-sm font-bold" />
                        <input name="email" type="email" defaultValue={adminUser.email} className="min-h-10 rounded-md border border-neutral-200 px-3 text-sm" />
                        <input name="name" defaultValue={adminUser.name} className="min-h-10 rounded-md border border-neutral-200 px-3 text-sm" />
                        <input name="password" type="password" placeholder="변경 시 입력" className="min-h-10 rounded-md border border-neutral-200 px-3 text-sm" />
                      </form>
                    </td>
                    <td className="px-4 py-3">
                      <select form={`admin-user-${adminUser.id.toString()}`} name="role" defaultValue={adminUser.role} className="min-h-10 w-full rounded-md border border-neutral-200 px-3 text-sm">
                        {ADMIN_ROLES.map((role) => (
                          <option key={role.value} value={role.value}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ADMIN_PERMISSIONS.map((permission) => (
                          <label key={permission.value} className="flex items-center gap-2 text-xs">
                            <input
                              form={`admin-user-${adminUser.id.toString()}`}
                              type="checkbox"
                              name="permissions"
                              value={permission.value}
                              defaultChecked={permissions.includes(permission.value)}
                            />
                            {permission.label}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <select form={`admin-user-${adminUser.id.toString()}`} name="status" defaultValue={adminUser.status} className="min-h-10 w-full rounded-md border border-neutral-200 px-3 text-sm">
                        <option value="active">사용</option>
                        <option value="inactive">중지</option>
                        <option value="blocked">차단</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right text-neutral-500">
                      {adminUser.lastLoginAt?.toLocaleDateString('ko-KR') ?? '이력 없음'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button form={`admin-user-${adminUser.id.toString()}`} className="min-h-10 rounded-md border border-neutral-200 px-4 text-sm font-bold hover:bg-neutral-100">
                        저장
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
