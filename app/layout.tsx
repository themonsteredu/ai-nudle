import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "라면 R&D 연구소",
  description: "식품개발연구원이 되어 나만의 라면을 개발하는 2차시 직업체험",
  other: {
    "codex-preview": "development",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
