export const metadata = {
  title: "見積PDF検索",
  description: "NAS上の見積PDFを日付・商品名・仕入先で検索",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
