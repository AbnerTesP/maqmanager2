import { Sidebar } from "./Sidebar"
import { cn } from "../lib/utils"

export function Layout({ children }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="pl-64 min-h-screen transition-all duration-300">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

export default Layout
