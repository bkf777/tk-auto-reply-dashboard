import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TK Auto Reply Dashboard",
  description: "管理 TikTok 用户、会话和消息记录",
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
