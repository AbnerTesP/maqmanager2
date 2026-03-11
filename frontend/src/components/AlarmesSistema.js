"use client"

import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { cn } from "../lib/utils"
import {
  Bell,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle,
  Clock,
  Search,
  Filter,
  X,
  Phone,
  Mail,
  MapPin,
  Wrench,
  User,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye
} from "lucide-react"

const API_BASE_URL = "http://localhost:8082/alarmes"

// Priority configuration
const priorityConfig = {
  "Crítico": {
    color: "destructive",
    icon: AlertOctagon,
    bgClass: "bg-destructive/10 border-destructive/30",
    badgeClass: "bg-destructive text-destructive-foreground",
    dotClass: "bg-destructive",
  },
  "Alto": {
    color: "orange",
    icon: AlertTriangle,
    bgClass: "bg-orange/10 border-orange/30",
    badgeClass: "bg-orange text-white",
    dotClass: "bg-orange",
  },
  "Médio": {
    color: "warning",
    icon: Info,
    bgClass: "bg-warning/10 border-warning/30",
    badgeClass: "bg-warning text-warning-foreground",
    dotClass: "bg-warning",
  },
  "Baixo": {
    color: "muted",
    icon: Clock,
    bgClass: "bg-muted border-border",
    badgeClass: "bg-muted text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
}

// Alarm type labels
const alarmTypeLabels = {
  "sem_orcamento": "Sem Orçamento",
  "orcamento_aceito": "Orçamento Aceito",
  "orcamento_recusado": "Orçamento Recusado",
}

// Detail Modal Component
function AlarmDetailModal({ alarm, onClose, onMarkAsSeen }) {
  if (!alarm) return null

  const config = priorityConfig[alarm.prioridade] || priorityConfig["Baixo"]
  const Icon = config.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="alarm-modal">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-card border border-border rounded-lg shadow-xl animate-fadeIn">
        {/* Header */}
        <div className={cn("flex items-center justify-between p-4 border-b border-border rounded-t-lg", config.bgClass)}>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", config.badgeClass)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-lg text-foreground">
                Alerta {alarm.prioridade}
              </h3>
              <p className="text-sm text-muted-foreground">
                {alarm.dias_alerta} dias de atraso
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            data-testid="close-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Equipment Info */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Equipamento</p>
                <p className="font-medium text-foreground">{alarm.nomemaquina}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Nº Reparação</p>
                <p className="font-mono font-medium text-foreground">#{alarm.numreparacao || alarm.id}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Cliente</p>
                <p className="font-medium text-foreground">{alarm.cliente_nome}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Centro</p>
                <div className="flex items-center gap-1 text-foreground">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{alarm.nomecentro || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Alarm Type */}
            <div className="pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Motivo do Alerta</p>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 text-xs font-medium bg-muted rounded-md text-muted-foreground">
                  {alarmTypeLabels[alarm.tipo_alarme] || alarm.tipo_alarme}
                </span>
                <span className={cn("px-2.5 py-1 text-xs font-bold rounded-md", config.badgeClass)}>
                  {alarm.dias_alerta} dias
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          {alarm.descricao && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Descrição</p>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">{alarm.descricao}</p>
            </div>
          )}

          {/* Contact Info */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
            {alarm.cliente_telefone && (
              <a 
                href={`tel:${alarm.cliente_telefone}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone className="w-4 h-4" />
                {alarm.cliente_telefone}
              </a>
            )}
            {alarm.cliente_email && (
              <a 
                href={`mailto:${alarm.cliente_email}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="w-4 h-4" />
                {alarm.cliente_email}
              </a>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            data-testid="modal-close-btn"
          >
            Fechar
          </button>
          {!alarm.visto && (
            <button
              onClick={() => onMarkAsSeen(alarm.id, alarm.tipo_alarme)}
              className="flex items-center gap-2 px-4 py-2 bg-success text-success-foreground rounded-md text-sm font-medium hover:bg-success/90 transition-colors"
              data-testid="mark-seen-btn"
            >
              <CheckCircle className="w-4 h-4" />
              Marcar como Visto
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Alarm Card Component
function AlarmCard({ alarm, onClick }) {
  const config = priorityConfig[alarm.prioridade] || priorityConfig["Baixo"]
  const Icon = config.icon

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-card border rounded-lg p-4 cursor-pointer transition-all duration-200",
        "hover:shadow-md hover:border-primary/30",
        config.bgClass
      )}
      data-testid={`alarm-card-${alarm.id}`}
    >
      {/* Priority Indicator */}
      <div className={cn("absolute top-0 left-0 w-1 h-full rounded-l-lg", config.dotClass)} />
      
      <div className="pl-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className={cn("px-2 py-0.5 text-xs font-bold rounded", config.badgeClass)}>
              {alarm.prioridade}
            </span>
            <span className="text-xs text-muted-foreground">
              {alarm.dias_alerta} dias atrás
            </span>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            #{alarm.numreparacao || alarm.id}
          </span>
        </div>

        {/* Content */}
        <h4 className="font-medium text-foreground mb-1 group-hover:text-primary transition-colors">
          {alarm.nomemaquina}
        </h4>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <User className="w-3.5 h-3.5" />
          <span className="truncate">{alarm.cliente_nome}</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {alarm.nomecentro || "Geral"}
          </span>
          <span className="text-xs px-2 py-0.5 bg-muted rounded text-muted-foreground">
            {alarmTypeLabels[alarm.tipo_alarme] || alarm.tipo_alarme}
          </span>
        </div>
      </div>
    </div>
  )
}

// Main Component
export default function AlarmesSistema() {
  const navigate = useNavigate()
  const [alarmes, setAlarmes] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedAlarme, setSelectedAlarme] = useState(null)
  
  const [filtroAtivo, setFiltroAtivo] = useState(() => sessionStorage.getItem('alarmesFiltroAtivo') || "todos")
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  
  const ITEMS_PER_PAGE = 9

  const fetchAlarmes = async () => {
    try {
      const [alarmesRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/todos`),
        fetch(`${API_BASE_URL}/estatisticas`),
      ])
      setAlarmes(await alarmesRes.json())
      setStats(await statsRes.json())
    } catch (error) {
      console.error("Erro ao buscar alarmes:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlarmes()
    const interval = setInterval(fetchAlarmes, 300000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    sessionStorage.setItem('alarmesFiltroAtivo', filtroAtivo)
    setCurrentPage(1)
  }, [filtroAtivo])

  const marcarComoVisto = async (id, tipo) => {
    try {
      await fetch(`${API_BASE_URL}/marcar-visto/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo_alarme: tipo }),
      })
      fetchAlarmes()
      setSelectedAlarme(null)
    } catch (error) {
      console.error("Erro ao marcar:", error)
    }
  }

  const alarmesFiltrados = useMemo(() => {
    return alarmes.filter(a => {
      const matchesFilter = filtroAtivo === "todos" ? true :
        filtroAtivo === "criticos" ? a.prioridade === "Crítico" :
        filtroAtivo === "altos" ? a.prioridade === "Alto" :
        filtroAtivo === "medios" ? a.prioridade === "Médio" : true

      if (!matchesFilter) return false
      if (!searchTerm) return true

      const term = searchTerm.toLowerCase()
      const text = `${a.nomemaquina} ${a.cliente_nome} ${a.numreparacao || ''} ${a.id} ${a.nomecentro || ''}`.toLowerCase()
      return text.includes(term)
    })
  }, [alarmes, filtroAtivo, searchTerm])

  const totalPages = Math.ceil(alarmesFiltrados.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedAlarmes = alarmesFiltrados.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const filterButtons = [
    { id: "todos", label: "Todos", count: alarmes.length, color: "muted" },
    { id: "criticos", label: "Críticos", count: stats.criticos || 0, color: "destructive" },
    { id: "altos", label: "Altos", count: stats.altos || 0, color: "orange" },
    { id: "medios", label: "Médios", count: stats.medios || 0, color: "warning" },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="alarms-loading">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">A carregar alertas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="alarms-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-heading font-bold text-foreground">Alertas</h1>
            {alarmes.length > 0 && (
              <span className="px-2.5 py-1 text-sm font-bold bg-destructive text-destructive-foreground rounded-full animate-pulse">
                {alarmes.length}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Reparações que requerem atenção
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {filterButtons.map((btn) => {
          const colorClasses = {
            muted: "bg-muted/50 border-border",
            destructive: "bg-destructive/10 border-destructive/30",
            orange: "bg-orange/10 border-orange/30",
            warning: "bg-warning/10 border-warning/30",
          }
          const textClasses = {
            muted: "text-foreground",
            destructive: "text-destructive",
            orange: "text-orange",
            warning: "text-warning",
          }
          return (
            <button
              key={btn.id}
              onClick={() => setFiltroAtivo(btn.id)}
              className={cn(
                "p-4 rounded-lg border-2 text-left transition-all",
                filtroAtivo === btn.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                colorClasses[btn.color]
              )}
              data-testid={`filter-${btn.id}`}
            >
              <p className={cn("text-3xl font-heading font-bold", textClasses[btn.color])}>
                {btn.count}
              </p>
              <p className="text-sm text-muted-foreground">{btn.label}</p>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Pesquisar alarmes..."
          className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1) }}
          data-testid="search-alarms"
        />
      </div>

      {/* Alarms Grid */}
      {paginatedAlarmes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-lg">
          <CheckCircle className="w-16 h-16 text-success/30 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Tudo em ordem!</h3>
          <p className="text-muted-foreground text-center max-w-md">
            {searchTerm 
              ? "Nenhum alerta encontrado para esta pesquisa." 
              : "Não existem alertas ativos nesta categoria."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedAlarmes.map((alarm) => (
              <AlarmCard
                key={alarm.id}
                alarm={alarm}
                onClick={() => setSelectedAlarme(alarm)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-md bg-card border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="prev-page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={cn(
                      "w-8 h-8 rounded-md text-sm font-medium transition-colors",
                      currentPage === i + 1
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border hover:bg-muted text-foreground"
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-md bg-card border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="next-page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedAlarme && (
        <AlarmDetailModal
          alarm={selectedAlarme}
          onClose={() => setSelectedAlarme(null)}
          onMarkAsSeen={marcarComoVisto}
        />
      )}
    </div>
  )
}
