/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    // 모바일 퍼스트: 기본은 모바일, sm 이상은 점진 확장
    screens: {
      xs: '360px',
      sm: '414px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
    extend: {
      fontSize: {
        // iOS Safari 자동 zoom 방지를 위해 input 최소 16px
        'input': ['16px', '24px'],
      },
      minHeight: {
        // 터치 타겟 44px 보장
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
    },
  },
  plugins: [
    // 가로 스크롤 영역 스크롤바 숨김 (모바일 카테고리 탭 등). docs/06-mobile.md
    function ({ addUtilities }: { addUtilities: (utils: Record<string, unknown>) => void }) {
      addUtilities({
        '.scrollbar-none': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
      });
    },
  ],
};

export default config;
