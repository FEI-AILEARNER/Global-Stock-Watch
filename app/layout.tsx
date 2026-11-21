import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { getData } from '@/lib/data';
import { SITE_NAME } from '@/lib/schema';

import './globals.css';

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: '个人研究笔记：前沿板块美股监控清单。研究判断，非投资建议。',
  // 公开网址，但不让搜索引擎收录。
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1f3864' };

const NAV = [
  { href: '/', label: '监控清单' },
  { href: '/calendar', label: '日历' },
  { href: '/discipline', label: '纪律' },
  { href: '/updates', label: '更新记录' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  const { site } = getData();
  return (
    <html lang="zh-Hans">
      <body>
        <header className="border-b border-rule bg-paper">
          <div className="mx-auto flex max-w-7xl flex-wrap items-baseline gap-x-8 gap-y-1 px-4 py-3 sm:px-6">
            <Link href="/" className="font-serif text-xl font-semibold tracking-tight text-navy">
              {SITE_NAME}
            </Link>
            <nav aria-label="主导航" className="flex flex-wrap gap-x-5 gap-y-1 text-[0.95rem]">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="py-1 text-ink hover:text-navy hover:underline underline-offset-4">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main id="content" className="mx-auto max-w-7xl px-4 pb-20 pt-7 sm:px-6 sm:pt-9">
          {children}
        </main>
        <footer className="border-t border-rule bg-paper">
          <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-ink-soft sm:px-6">
            <p className="text-ink">{site.disclaimer}</p>
            <p className="mt-1">个人研究笔记，不面向任何读者提供买卖意见；本页不被搜索引擎收录。</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
