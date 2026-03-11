import { useState, useEffect, useCallback } from "react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "../lib/utils"
import { useTheme } from "./theme-provider"
import {
  Wrench,
  Users,
  Bell,
  LayoutDashboard,
  ChevronLeft,
  Sun,
  Moon,
  Menu
} from "lucide-react"

const API_URL = "http://localhost:8082/alarmes/resumo"

const useAlarmes = () => {
  const [total, setTotal] = useState(0)

  const fetchAlarmes = useCallback(async () => {
    try {
      const response = await fetch(API_URL)
      if (response.ok) {
        const data = await response.json()
        setTotal(data.total || 0)
      }
    } catch (err) {
      console.error("Erro ao buscar alarmes:", err)
    }
  }, [])

  useEffect(() => {
    fetchAlarmes()
    const interval = setInterval(fetchAlarmes, 120000)
    return () => clearInterval(interval)
  }, [fetchAlarmes])

  return total
}

const navItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Reparações",
    href: "/reparacoes",
    icon: Wrench,
  },
  {
    title: "Clientes",
    href: "/clientes",
    icon: Users,
  },
  {
    title: "Alarmes",
    href: "/alarmes",
    icon: Bell,
    badge: true,
  },
]

export function Sidebar() {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const totalAlarmes = useAlarmes()
  const [collapsed, setCollapsed] = useState(false)

  const isActive = (href) => {
    if (href === "/") return location.pathname === "/"
    return location.pathname.startsWith(href)
  }

  return (
    <aside
      data-testid="sidebar"
      className={cn(
        "fixed left-0 top-0 z-40 h-screen bg-card border-r border-border flex flex-col transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border">
        <Link 
          to="/" 
          className={cn(
            "flex items-center gap-3 text-foreground hover:text-primary transition-colors",
            collapsed && "justify-center"
          )}
          data-testid="sidebar-logo"
        >
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center flex-shrink-0">
            <Wrench className="w-5 h-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="font-heading text-xl font-bold tracking-tight">
              MaqManager
            </span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground",
            collapsed && "absolute -right-3 top-6 bg-card border border-border shadow-sm"
          )}
          data-testid="sidebar-toggle"
        >
          <ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          
          return (
            <Link
              key={item.href}
              to={item.href}
              data-testid={`nav-${item.title.toLowerCase()}`}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150",
                "hover:bg-muted group relative",
                active 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "text-muted-foreground hover:text-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <Icon className={cn("w-5 h-5 flex-shrink-0", active && "text-primary-foreground")} />
              
              {!collapsed && (
                <>
                  <span className="flex-1">{item.title}</span>
                  {item.badge && totalAlarmes > 0 && (
                    <span className={cn(
                      "px-2 py-0.5 text-xs font-bold rounded-full",
                      active 
                        ? "bg-primary-foreground text-primary" 
                        : "bg-destructive text-destructive-foreground animate-pulse"
                    )}>
                      {totalAlarmes > 99 ? "99+" : totalAlarmes}
                    </span>
                  )}
                </>
              )}

              {/* Collapsed badge */}
              {collapsed && item.badge && totalAlarmes > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {totalAlarmes > 9 ? "9+" : totalAlarmes}
                </span>
              )}

              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-lg border border-border opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                  {item.title}
                  {item.badge && totalAlarmes > 0 && (
                    <span className="ml-2 px-1.5 py-0.5 bg-destructive text-destructive-foreground text-xs rounded-full">
                      {totalAlarmes}
                    </span>
                  )}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border space-y-1">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          data-testid="theme-toggle"
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-muted",
            collapsed && "justify-center px-2"
          )}
        >
          {theme === "dark" ? (
            <Sun className="w-5 h-5" />
          ) : (
            <Moon className="w-5 h-5" />
          )}
          {!collapsed && (
            <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>
          )}
        </button>

      </div>
    </aside>
  )
}

export default Sidebar
