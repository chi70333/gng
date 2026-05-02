'use client';

import { useEffect } from 'react';

type Props = {
  message: string;
};

export function AdminUserMileageUploadAlert({ message }: Props) {
  useEffect(() => {
    if (!message) return;

    window.alert(message);

    const url = new URL(window.location.href);
    url.searchParams.delete('mileageUploadAlert');
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [message]);

  return null;
}
