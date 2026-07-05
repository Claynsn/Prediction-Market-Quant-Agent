import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PM Quant",
  description: "把一句模糊的策略想法，变成可回测、可纸面交易的量化策略。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="text-slate-100 antialiased">{children}</body>
    </html>
  );
}
