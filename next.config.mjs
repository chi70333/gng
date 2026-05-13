import { withSentryConfig } from '@sentry/nextjs';

const legacyImageRemotePattern = process.env.LEGACY_IMAGE_HOSTNAME
  ? [
      {
        protocol: process.env.LEGACY_IMAGE_PROTOCOL === 'http' ? 'http' : 'https',
        hostname: process.env.LEGACY_IMAGE_HOSTNAME,
      },
    ]
  : [];

const r2RemotePattern = process.env.R2_PUBLIC_URL
  ? [
      {
        protocol: 'https',
        hostname: new URL(process.env.R2_PUBLIC_URL).hostname,
      },
    ]
  : [];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    // 모바일 번들 절감
    optimizePackageImports: ['lucide-react', 'date-fns'],
    serverComponentsExternalPackages: ['argon2'],
    outputFileTracingIncludes: {
      '/*': ['./node_modules/argon2/prebuilds/**/*'],
    },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // R2/S3 도메인 등록 예정
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.cloudfront.net' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      ...r2RemotePattern,
      // 레거시 이미지 호스트. 운영 중에는 R2/S3 이전 후 제거한다.
      ...legacyImageRemotePattern,
    ],
  },
  async rewrites() {
    // 외부에서 호출 중인 기존 PHP 엔드포인트 호환 (docs/08-api-compat.md)
    return [
      { source: '/api/gnp-api.php', destination: '/api/legacy/gnp-api' },
      { source: '/api/point_sync.php', destination: '/api/legacy/point-sync' },
      { source: '/api/version.php', destination: '/api/legacy/version' },
      { source: '/payaction.php', destination: '/api/payment/callback' },
      { source: '/payaction_adm.php', destination: '/api/payment/callback' },
    ];
  },
  async redirects() {
    // 레거시 SEO URL → 신규 (docs/03-legacy-map.md 기반)
    // 주의: DB 조회가 필요한 goods_detail.php?goodsIdx=N 리다이렉트는 route handler에서 301 처리.
    return [
      {
        source: '/ask_list.php',
        destination: '/help/inquiries',
        permanent: false,
      },
      {
        source: '/coupon_list.php',
        destination: '/mypage/coupons',
        permanent: false,
      },
      {
        source: '/board_list.php',
        has: [{ type: 'query', key: 'boardIndex', value: '1' }],
        destination: '/board/general',
        permanent: false,
      },
      {
        source: '/board_event_list.php',
        has: [{ type: 'query', key: 'event', value: '1' }],
        destination: '/event',
        permanent: false,
      },
      {
        source: '/search_result.php',
        destination: '/search',
        permanent: true,
      },
      {
        source: '/m/search_result.php',
        destination: '/search',
        permanent: true,
      },
      // 상품 상세: goods_detail.php?goodsIdx=N → /goods/<slug>는 route handler 구현.
      // 상품 목록: goods_list.php?Index=N → /category/<slug> (P1에서 완전 구현)
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
