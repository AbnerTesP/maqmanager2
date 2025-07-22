import { useState, useEffect, useRef } from 'react'
import { Bell, CheckCircle, XCircle, Clock, ArrowRight, RefreshCw, Info } from 'lucide-react'

function NotificacaoAlarmes() {
    const [alarmes, setAlarmes] = useState([])
    const [totalAlarmes, setTotalAlarmes] = useState(0)
    const [loading, setLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [lastUpdate, setLastUpdate] = useState(new Date())
    const dropdownRef = useRef(null)

    useEffect(() => {
        carregarAlarmes()
        const interval = setInterval(carregarAlarmes, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const carregarAlarmes = async () => {
        try {
            setLoading(true)
            const response = await fetch("http://localhost:8082/alarmes/resumo")
            if (!response.ok) throw new Error("Erro ao carregar alarmes")
            const data = await response.json()
            setAlarmes(data.alarmes || [])
            setTotalAlarmes(data.total || 0)
            setLastUpdate(new Date())
        } catch (err) {
            console.error("Erro ao carregar alarmes:", err)
            setAlarmes([])
            setTotalAlarmes(0)
        } finally {
            setLoading(false)
        }
    }

    const getPrioridadeConfig = (prioridade) => {
        switch (prioridade) {
            case 'critico':
                return { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200', badge: 'bg-red-500', dot: 'bg-red-500' }
            case 'alto':
                return { bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-200', badge: 'bg-orange-500', dot: 'bg-orange-500' }
            case 'medio':
                return { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', badge: 'bg-blue-500', dot: 'bg-blue-500' }
            case 'baixo':
                return { bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200', badge: 'bg-gray-500', dot: 'bg-gray-500' }
            default:
                return { bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200', badge: 'bg-gray-500', dot: 'bg-gray-500' }
        }
    }

    const getTipoConfig = (tipo) => {
        switch (tipo) {
            case 'sem_orcamento':
                return { icon: Clock, label: 'Sem Orçamento', color: 'text-orange-600' }
            case 'orcamento_aceito':
                return { icon: CheckCircle, label: 'Orçamento Aceito', color: 'text-green-600' }
            case 'orcamento_recusado':
                return { icon: XCircle, label: 'Orçamento Recusado', color: 'text-red-600' }
            default:
                return { icon: Bell, label: tipo, color: 'text-gray-600' }
        }
    }

    const formatTimeAgo = (timestamp) => {
        const now = new Date()
        const past = new Date(timestamp)
        const diffMs = now.getTime() - past.getTime()
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
        const diffDays = Math.floor(diffHours / 24)
        if (diffDays > 0) return `${diffDays}d atrás`
        if (diffHours > 0) return `${diffHours}h atrás`
        return 'Agora'
    }

    const getPrioridadeOrder = (prioridade) => {
        switch (prioridade) {
            case 'critico': return 1
            case 'alto': return 2
            case 'medio': return 3
            case 'baixo': return 4
            default: return 5
        }
    }

    const alarmesSorted = [...alarmes].sort((a, b) => getPrioridadeOrder(a.prioridade) - getPrioridadeOrder(b.prioridade))

    if (totalAlarmes === 0) {
        return (
            <div className="flex items-center text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                <CheckCircle className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Sem alarmes</span>
            </div>
        )
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 group"
            >
                <Bell className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-12' : 'group-hover:rotate-6'}`} />
                {totalAlarmes > 0 && (
                    <div className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full px-1 animate-pulse">
                        {totalAlarmes > 99 ? '99+' : totalAlarmes}
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 transform transition-all duration-200 origin-top-right animate-in slide-in-from-top-2">
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <Bell className="w-5 h-5 text-gray-600 mr-2" />
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Alarmes ({totalAlarmes})
                                </h3>
                            </div>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={carregarAlarmes}
                                    disabled={loading}
                                    className="p-1 text-gray-500 hover:text-gray-700 rounded-md transition-colors duration-200 disabled:opacity-50 hover:bg-gray-200"
                                    title="Atualizar alarmes"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                                <span className="text-xs text-gray-500">
                                    {formatTimeAgo(lastUpdate.toISOString())}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mr-2" />
                                <span className="text-gray-600">Carregando alarmes...</span>
                            </div>
                        ) : alarmes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                                <Info className="w-12 h-12 mb-3 text-blue-400" />
                                <p className="text-sm">Nenhum alarme ativo</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {alarmesSorted.slice(0, 10).map((alarme) => {
                                    const prioridadeConfig = getPrioridadeConfig(alarme.prioridade)
                                    const tipoConfig = getTipoConfig(alarme.tipo)
                                    const IconComponent = tipoConfig.icon
                                    return (
                                        <div
                                            key={alarme.reparacao_id}
                                            className={`p-4 hover:bg-gray-50 transition-colors duration-200 cursor-pointer ${prioridadeConfig.bg} hover:${prioridadeConfig.bg}`}
                                        >
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center space-x-2">
                                                    <IconComponent className={`w-4 h-4 ${tipoConfig.color}`} />
                                                    <span className="font-semibold text-gray-900">
                                                        Rep. #{alarme.reparacao_id}
                                                    </span>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <div className={`w-2 h-2 rounded-full ${prioridadeConfig.dot}`}></div>
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${prioridadeConfig.badge} text-white`}>
                                                        {alarme.prioridade}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="mb-2">
                                                <p className="text-sm font-medium text-gray-700">
                                                    {tipoConfig.label}
                                                </p>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs text-gray-500 flex-1 mr-2">
                                                    {alarme.mensagem?.length > 50
                                                        ? `${alarme.mensagem.substring(0, 50)}...`
                                                        : alarme.mensagem}
                                                </p>
                                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                                    {alarme.dias || alarme.dias_alerta || 0} dias
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {alarmes.length > 10 && (
                            <div className="px-4 py-3 text-center border-t border-gray-100 bg-gray-50">
                                <p className="text-sm text-gray-500">
                                    E mais {alarmes.length - 10} alarmes...
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                        <a
                            href="/alarmes"
                            className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                        >
                            <ArrowRight className="w-4 h-4 mr-2" />
                            Ver Todos os Alarmes
                        </a>
                    </div>
                </div>
            )}
        </div>
    )
}

export default NotificacaoAlarmes