import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Radar · 招聘情报工作台",
  description: "监视企业招聘动态，识别研发结构、业务重点与 AI / 电商信号。",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
