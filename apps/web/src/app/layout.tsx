import type { Metadata } from "next";
import type { ReactNode } from "react";

import { site } from "../data/site";
import { MascotShell } from "../features/mascot/components/mascot-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: site.name,
  description: `${site.author}的技术、AI 与个人随笔空间`,
};

interface RootLayoutProps {
  readonly children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <MascotShell />
      </body>
    </html>
  );
}
