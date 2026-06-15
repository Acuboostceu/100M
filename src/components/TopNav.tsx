'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/glow',      label: 'Glow' },
  { href: '/acuboost',  label: 'Acuboost' },
  { href: '/personal',  label: 'Personal' },
]

export default function TopNav() {
  const path = usePathname()
  const active = (href: string) => path === href || path.startsWith(href + '/')

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-4 flex items-center h-14 gap-1">
        <Link href="/" className="text-xl font-bold text-brand-600 mr-4 shrink-0">
          100M
        </Link>
        <div className="flex items-center gap-1 flex-1">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                active(l.href)
                  ? 'bg-brand-50 text-brand-600'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <Link
          href="/settings"
          className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${
            active('/settings')
              ? 'bg-brand-50 text-brand-600'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
          }`}
        >
          ⚙️
        </Link>
      </div>
    </nav>
  )
}
