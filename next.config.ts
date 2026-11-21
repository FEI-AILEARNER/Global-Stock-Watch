import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 报价接口在运行时读 data/tickers（只允许查清单里的代码），所以要把数据文件带进函数包。
  outputFileTracingIncludes: { '/api/quotes': ['./data/**/*.json'] },
  async headers() {
    // 公开网址但不让搜索引擎收录：除了页面里的 robots meta，再加一层响应头（接口也带）。
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }];
  },
};

export default config;
