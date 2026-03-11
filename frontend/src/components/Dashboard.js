import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { cn } from "../lib/utils"
import {
  Wrench,
  Users,
  Bell,
  Clock,
  CheckCircle,
  Package,
  AlertTriangle,
  Plus,
  ArrowRight,
  TrendingUp,
  Calendar
} from "lucide-react"

const API_BASE_URL = "http://localhost:8082"

// Stat Card Component
function StatCard({ title, value, icon: Icon, trend, color, onClick }) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    orange: "bg-orange/10 text-orange border-orange/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
    info: "bg-info/10 text-info border-info/20",
  }

  return (
    <div
      onClick={onClick}
      data-testid={`stat-${title.toLowerCase().replace(/\s/g, '-')}`}
      className={cn(
        "bg-card border border-border rounded-lg p-5 transition-all duration-200 group",
        onClick && "cursor-pointer hover:border-primary/50 hover:shadow-lg"
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-heading font-bold text-foreground">{value}</p>
          {trend && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {trend}
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-lg border", colorClasses[color])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}

// Quick Action Button
function QuickAction({ icon: Icon, label, onClick, variant = "default" }) {
  const variants = {
    default: "bg-card border border-border hover:border-primary/50 text-foreground",
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  }

  return (
    <button
      onClick={onClick}
      data-testid={`quick-action-${label.toLowerCase().replace(/\s/g, '-')}`}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg font-medium text-sm transition-all duration-150",
        variants[variant]
      )}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}

// Recent Repair Item
function RepairItem({ repair, onClick }) {
  const getStatusColor = (repair) => {
    if (repair.datasaida) return "success"
    if (repair.dataconclusao) return "info"
    return "orange"
  }

  const getStatusLabel = (repair) => {
    if (repair.datasaida) return "Entregue"
    if (repair.dataconclusao) return "Pronta"
    return "Em Andamento"
  }

  const statusColors = {
    success: "bg-success/10 text-success border-success/30",
    info: "bg-info/10 text-info border-info/30",
    orange: "bg-orange/10 text-orange border-orange/30",
  }

  const status = getStatusColor(repair)

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer group border-b border-border last:border-0"
      data-testid={`repair-item-${repair.id}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
          <Wrench className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground group-hover:text-primary transition-colors">
            {repair.nomemaquina}
          </p>
          <p className="text-sm text-muted-foreground">
            {repair.cliente_nome} • #{repair.numreparacao || repair.id}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={cn("px-2.5 py-1 text-xs font-medium rounded-md border", statusColors[status])}>
          {getStatusLabel(repair)}
        </span>
        <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  )
}

// Alarm Item
function AlarmItem({ alarm, onClick }) {
  const priorityColors = {
    "Crítico": "border-l-destructive bg-destructive/5",
    "Alto": "border-l-orange bg-orange/5",
    "Médio": "border-l-warning bg-warning/5",
    "Baixo": "border-l-muted-foreground bg-muted/50",
  }

  const priorityBadge = {
    "Crítico": "bg-destructive text-destructive-foreground",
    "Alto": "bg-orange text-white",
    "Médio": "bg-warning text-warning-foreground",
    "Baixo": "bg-muted text-muted-foreground",
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 border-l-4 rounded-r-md cursor-pointer hover:opacity-80 transition-opacity",
        priorityColors[alarm.prioridade] || priorityColors["Baixo"]
      )}
      data-testid={`alarm-item-${alarm.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground text-sm truncate">{alarm.nomemaquina}</p>
          <p className="text-xs text-muted-foreground truncate">{alarm.cliente_nome}</p>
        </div>
        <span className={cn("px-2 py-0.5 text-xs font-bold rounded", priorityBadge[alarm.prioridade])}>
          {alarm.dias_alerta}d
        </span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({})
  const [recentRepairs, setRecentRepairs] = useState([])
  const [alarms, setAlarms] = useState([])
  const [clientCount, setClientCount] = useState(0)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        const [statsRes, repairsRes, alarmsRes, clientsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/reparacoes/estatisticas`),
          axios.get(`${API_BASE_URL}/reparacoes`),
          axios.get(`${API_BASE_URL}/alarmes/resumo`),
          axios.get(`${API_BASE_URL}/clientes`),
        ])
        
        setStats(statsRes.data || {})
        setRecentRepairs(Array.isArray(repairsRes.data) ? repairsRes.data.slice(0, 5) : [])
        setAlarms(alarmsRes.data?.alarmes?.slice(0, 6) || [])
        setClientCount(Array.isArray(clientsRes.data) ? clientsRes.data.length : 0)
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="dashboard-loading">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">A carregar dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-fadeIn" data-testid="dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo ao MaqManager. Visão geral do sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <QuickAction
            icon={Plus}
            label="Nova Reparação"
            onClick={() => navigate("/reparacoes/registo")}
            variant="primary"
          />
          <QuickAction
            icon={Users}
            label="Novo Cliente"
            onClick={() => navigate("/clientes")}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Em Andamento"
          value={stats.em_andamento || 0}
          icon={Clock}
          color="orange"
          onClick={() => navigate("/reparacoes")}
        />
        <StatCard
          title="Prontas"
          value={stats.prontas || 0}
          icon={CheckCircle}
          color="info"
          onClick={() => navigate("/reparacoes")}
        />
        <StatCard
          title="Entregues"
          value={stats.entregues || 0}
          icon={Package}
          color="success"
          onClick={() => navigate("/reparacoes")}
        />
        <StatCard
          title="Alertas Ativos"
          value={alarms.length}
          icon={Bell}
          color={alarms.length > 0 ? "destructive" : "primary"}
          onClick={() => navigate("/alarmes")}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Repairs */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              <h2 className="font-heading font-semibold text-lg text-foreground">Reparações Recentes</h2>
            </div>
            <button
              onClick={() => navigate("/reparacoes")}
              className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1"
              data-testid="view-all-repairs"
            >
              Ver todas
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div>
            {recentRepairs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Wrench className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Nenhuma reparação registada</p>
              </div>
            ) : (
              recentRepairs.map((repair) => (
                <RepairItem
                  key={repair.id}
                  repair={repair}
                  onClick={() => navigate(`/reparacoes/view/${repair.id}`)}
                />
              ))
            )}
          </div>
        </div>

        {/* Alarms Panel */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className={cn("w-5 h-5", alarms.length > 0 ? "text-destructive" : "text-muted-foreground")} />
              <h2 className="font-heading font-semibold text-lg text-foreground">Alertas</h2>
            </div>
            {alarms.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-destructive text-destructive-foreground rounded-full">
                {alarms.length}
              </span>
            )}
          </div>
          <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
            {alarms.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle className="w-10 h-10 mx-auto mb-2 text-success opacity-50" />
                <p className="text-sm">Nenhum alerta ativo</p>
              </div>
            ) : (
              alarms.map((alarm) => (
                <AlarmItem
                  key={alarm.reparacao_id}
                  alarm={alarm}
                  onClick={() => navigate("/alarmes")}
                />
              ))
            )}
          </div>
          {alarms.length > 0 && (
            <div className="p-3 border-t border-border">
              <button
                onClick={() => navigate("/alarmes")}
                className="w-full py-2 text-sm text-center text-primary hover:text-primary/80 font-medium"
                data-testid="view-all-alarms"
              >
                Ver todos os alertas
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-heading font-bold text-foreground">{clientCount}</p>
              <p className="text-sm text-muted-foreground">Clientes Registados</p>
            </div>
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-heading font-bold text-foreground">{stats.total || 0}</p>
              <p className="text-sm text-muted-foreground">Total de Reparações</p>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <Calendar className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-heading font-bold text-foreground">
                {new Date().toLocaleDateString("pt-PT", { day: "2-digit", month: "short" })}
              </p>
              <p className="text-sm text-muted-foreground">Hoje</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
