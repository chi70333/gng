'use client';

import { RotateCcw } from 'lucide-react';
import { adminDangerButtonClass } from '@/components/admin/AdminUI';

const CONFIRM_TEXT = '전체 회원의 마일리지를 0원으로 초기화할까요?';

export function AdminUserMileageResetAllButton() {
  return (
    <>
      <input type="hidden" name="bulkMileageResetAllConfirm" value="전체 초기화" />
      <button
        type="submit"
        name="intent"
        value="mileage-reset-all"
        className={`${adminDangerButtonClass} h-10`}
        aria-label="전체 회원 마일리지 초기화"
        onClick={(event) => {
          if (!window.confirm(CONFIRM_TEXT)) event.preventDefault();
        }}
      >
        <RotateCcw size={17} />
        전체 초기화
      </button>
    </>
  );
}
