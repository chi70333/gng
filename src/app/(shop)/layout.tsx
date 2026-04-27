// (shop) 라우트 그룹 레이아웃.
// Header/Footer는 루트 layout.tsx에 있으므로 여기는 shop 전용 여백/컨테이너만.

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
