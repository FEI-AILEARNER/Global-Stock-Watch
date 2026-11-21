import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="font-serif text-2xl font-semibold">没有这个页面</h1>
      <p className="mt-3"><Link href="/" className="link">回到监控清单</Link></p>
    </div>
  );
}
