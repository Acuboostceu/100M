import Nav from '@/components/Nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Nav />
      <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 max-w-5xl">
        {children}
      </main>
    </div>
  )
}
