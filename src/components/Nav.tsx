'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/',             label: 'Dashboard',  icon: '📊' },
  { href: '/transactions', label: 'Transactions',icon: '📋' },
  { href: '/debt',         label: 'Debt',        icon: '💳' },
  { href: '/report',       label: 'Report',      icon: '📈' },
  { href: '/import',       label: 'Import',      icon: '⬆️' },
]

export default function Nav() {
  const path = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 md:static md:border-t-0 md:border-r md:h-screen md:w-56 md:flex-col md:py-6">
      <div className="flex md:flex-col">
        <div className="hidden md:flex items-center gap-2 px-4 mb-8">
          <span className="text-2xl font-bold text-brand-600">100M</span>
        </div>
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex-1 md:flex-none flex flex-col md:flex-row items-center md:items-center gap-1 md:gap-3 py-2 md:py-2.5 md:px-4 text-xs md:text-sm rounded-xl md:mx-2 transition-colors ${
              path === l.href
                ? 'text-brand-600 bg-brand-50 font-medium'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="text-lg md:text-base">{l.icon}</span>
            <span className="hidden md:inline">{l.label}</span>
            <span className="md:hidden text-[10px]">{l.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}
