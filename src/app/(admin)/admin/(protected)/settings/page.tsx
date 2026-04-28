// Legacy sources: wb_admin/adm.php, wb_admin/company.php, wb_admin/adm_etc.php
// Cache: no-store. Settings affect public policies and operational behavior.

import type { Metadata } from 'next';
import { Save, ShieldCheck, UserPlus } from 'lucide-react';
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

const fieldControlClass =
  'h-9 w-full rounded border border-neutral-300 bg-white px-2.5 text-[13px] font-medium text-neutral-950 outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900';

const textareaClass =
  'mt-1.5 w-full rounded border border-neutral-300 bg-white px-2.5 py-2 text-[13px] leading-5 text-neutral-950 outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900';

const compactButtonClass =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded border border-neutral-800 bg-neutral-900 px-3 text-[13px] font-bold text-white hover:bg-neutral-800';

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
      <input name={name} defaultValue={value} required={required} className={fieldControlClass} />
    </label>
  );
}

function Section({
  title,
  description,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-md border border-neutral-300 bg-white shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-3 py-2">
        <div>
          <h2 className="text-sm font-extrabold text-neutral-950">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs font-medium text-neutral-500">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="p-3">{children}</div>
    </section>
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
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-neutral-950">사이트 설정</h1>
          <p className="mt-1 text-sm text-neutral-500">
            회사정보, 고객센터, 입금계좌, 약관 정보를 관리합니다.
          </p>
        </div>
      </div>

      <form action={saveAdminSettings} className="grid gap-4 xl:grid-cols-2">
        <Section title="회사 정보" description="사업자 표시와 개인정보 책임자 정보를 입력합니다.">
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
        </Section>

        <Section title="운영 정보" description="고객센터 운영시간과 무통장 입금 정보를 관리합니다.">
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
              <span className="inline-flex h-9 items-center gap-2 rounded border border-neutral-300 bg-neutral-50 px-2.5 text-[13px] font-bold text-neutral-800">
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
        </Section>

        <Section
          title="약관 문서"
          description="고객에게 노출되는 정책 문서입니다."
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
                className={textareaClass}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-neutral-600">개인정보처리방침</span>
              <textarea
                name="privacy"
                defaultValue={policy?.privacy ?? ''}
                rows={7}
                required
                className={textareaClass}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-neutral-600">개인정보 수집 동의</span>
              <textarea
                name="collectionConsent"
                defaultValue={policy?.collectionConsent ?? ''}
                rows={6}
                required
                className={textareaClass}
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-neutral-600">회사소개</span>
              <textarea
                name="companyInfo"
                defaultValue={policy?.companyInfo ?? ''}
                rows={6}
                required
                className={textareaClass}
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end border-t border-neutral-100 pt-3">
            <button className={compactButtonClass}>
              <Save size={15} />
              설정 저장
            </button>
          </div>
        </Section>
      </form>

      <Section title="관리자 계정" description="계정, 역할, 권한, 상태를 한 화면에서 관리합니다.">
        <form action={saveAdminAccount} className="grid gap-3 border-b border-neutral-200 pb-3">
          <div className="grid gap-2 md:grid-cols-[140px_minmax(190px,1fr)_120px_150px_140px_120px]">
            <input name="loginId" placeholder="관리자 ID" className={fieldControlClass} required />
            <input
              name="email"
              type="email"
              placeholder="이메일"
              className={fieldControlClass}
              required
            />
            <input name="name" placeholder="이름" className={fieldControlClass} required />
            <input
              name="password"
              type="password"
              placeholder="초기 비밀번호"
              className={fieldControlClass}
              required
            />
            <select name="role" defaultValue="operator" className={fieldControlClass}>
              {ADMIN_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <select name="status" defaultValue="active" className={fieldControlClass}>
              <option value="active">사용</option>
              <option value="inactive">중지</option>
              <option value="blocked">차단</option>
            </select>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {ADMIN_PERMISSIONS.map((permission) => (
              <label
                key={permission.value}
                className="flex h-8 items-center gap-2 rounded border border-neutral-200 bg-neutral-50 px-2 text-xs font-semibold text-neutral-700"
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
            <button className={compactButtonClass}>
              <UserPlus size={15} />
              관리자 등록
            </button>
          </div>
        </form>

        <div className="mt-3 overflow-x-auto rounded border border-neutral-300">
          <table className="w-full min-w-[1120px] table-fixed border-collapse text-[13px]">
            <thead>
              <tr className="bg-neutral-100 text-left text-xs font-bold text-neutral-700">
                <th className="w-[260px] border border-neutral-300 px-2.5 py-2">계정</th>
                <th className="w-32 border border-neutral-300 px-2.5 py-2">역할</th>
                <th className="w-[420px] border border-neutral-300 px-2.5 py-2">권한</th>
                <th className="w-28 border border-neutral-300 px-2.5 py-2">상태</th>
                <th className="w-28 border border-neutral-300 px-2.5 py-2 text-right">
                  최근 로그인
                </th>
                <th className="w-20 border border-neutral-300 px-2.5 py-2 text-right">저장</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="h-20 border border-neutral-200 px-3 text-center text-neutral-500"
                  >
                    등록된 관리자 계정이 없습니다.
                  </td>
                </tr>
              ) : (
                adminUsers.map((adminUser) => {
                  const permissions = permissionValues(adminUser.permissions);
                  return (
                    <tr key={adminUser.id.toString()} className="align-top hover:bg-blue-50/60">
                      <td className="border border-neutral-200 px-2.5 py-2">
                        <form
                          id={`admin-user-${adminUser.id.toString()}`}
                          action={saveAdminAccount}
                          className="grid gap-1.5"
                        >
                          <input type="hidden" name="id" value={adminUser.id.toString()} />
                          <input
                            name="loginId"
                            defaultValue={adminUser.loginId}
                            className={`${fieldControlClass} font-bold`}
                          />
                          <input
                            name="email"
                            type="email"
                            defaultValue={adminUser.email}
                            className={fieldControlClass}
                          />
                          <input
                            name="name"
                            defaultValue={adminUser.name}
                            className={fieldControlClass}
                          />
                          <input
                            name="password"
                            type="password"
                            placeholder="변경 시 입력"
                            className={fieldControlClass}
                          />
                        </form>
                      </td>
                      <td className="border border-neutral-200 px-2.5 py-2">
                        <select
                          form={`admin-user-${adminUser.id.toString()}`}
                          name="role"
                          defaultValue={adminUser.role}
                          className={fieldControlClass}
                        >
                          {ADMIN_ROLES.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="border border-neutral-200 px-2.5 py-2">
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
                      <td className="border border-neutral-200 px-2.5 py-2">
                        <select
                          form={`admin-user-${adminUser.id.toString()}`}
                          name="status"
                          defaultValue={adminUser.status}
                          className={fieldControlClass}
                        >
                          <option value="active">사용</option>
                          <option value="inactive">중지</option>
                          <option value="blocked">차단</option>
                        </select>
                      </td>
                      <td className="border border-neutral-200 px-2.5 py-2 text-right text-xs font-medium text-neutral-500">
                        {adminUser.lastLoginAt?.toLocaleDateString('ko-KR') ?? '이력 없음'}
                      </td>
                      <td className="border border-neutral-200 px-2.5 py-2 text-right">
                        <button
                          form={`admin-user-${adminUser.id.toString()}`}
                          className="inline-flex h-9 items-center justify-center gap-1 rounded border border-neutral-300 bg-white px-2.5 text-xs font-bold hover:bg-neutral-100"
                        >
                          <ShieldCheck size={14} />
                          저장
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
