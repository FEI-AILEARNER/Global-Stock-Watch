import type { MetadataRoute } from 'next';

// 不让搜索引擎收录（页面另有 noindex 的 meta 和 X-Robots-Tag 响应头）。
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
