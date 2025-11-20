"use client"

import { useState, useEffect } from "react"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

// --- CONSTANTES ---
const API_BASE_URL = "http://localhost:8082/alarmes"

// --- SUB-COMPONENTE: MODAL DE DETALHES ---
const DetalhesAlarmeModal = ({ alarme, onClose, onMarkAsSeen }) => {
    if (!alarme) return null

    const getCor = (prioridade) => {
        const cores = { 'Crítico': 'danger', 'Alto': 'warning', 'Médio': 'warning', 'Baixo': 'info' }
        return cores[prioridade] || 'secondary'
    }

    return (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content border-0 shadow-lg">
                    <div className={`modal-header bg-${getCor(alarme.prioridade)} bg-opacity-10 border-bottom-0`}>
                        <h5 className={`modal-title text-${getCor(alarme.prioridade)} fw-bold d-flex align-items-center gap-2`}>
                            <i className="bi bi-exclamation-triangle-fill"></i>
                            Alarme {alarme.prioridade}
                        </h5>
                        <button type="button" className="btn-close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body">
                        <div className="mb-3 p-3 bg-light rounded-3 border">
                            <div className="row g-2">
                                <div className="col-6">
                                    <small className="text-muted d-block text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Equipamento</small>
                                    <span className="fw-semibold">{alarme.nomemaquina}</span>
                                </div>
                                <div className="col-6">
                                    <small className="text-muted d-block text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Cliente</small>
                                    <span className="fw-semibold">{alarme.cliente_nome}</span>
                                </div>
                                <div className="col-12 mt-3">
                                    <small className="text-muted d-block text-uppercase fw-bold" style={{ fontSize: '0.7rem' }}>Motivo do Alerta</small>
                                    <div className="d-flex align-items-center gap-2 mt-1">
                                        <span className="badge bg-secondary">{alarme.tipo_alarme.replace('_', ' ')}</span>
                                        <span className={`badge bg-${getCor(alarme.prioridade)}`}>{alarme.dias_alerta} dias de atraso</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {(alarme.descricao) && (
                            <div className="mb-3">
                                <h6 className="fw-bold text-secondary"><i className="bi bi-text-paragraph me-2"></i>Descrição</h6>
                                <p className="text-muted small bg-light p-2 rounded">{alarme.descricao}</p>
                            </div>
                        )}

                        <div className="d-flex gap-2 text-muted small">
                            {alarme.cliente_telefone && <span><i className="bi bi-telephone me-1"></i>{alarme.cliente_telefone}</span>}
                            {alarme.cliente_email && <span><i className="bi bi-envelope me-1"></i>{alarme.cliente_email}</span>}
                        </div>
                    </div>
                    <div className="modal-footer border-top-0">
                        <button type="button" className="btn btn-light" onClick={onClose}>Fechar</button>
                        {!alarme.visto && (
                            <button type="button" className="btn btn-success d-flex align-items-center gap-2" onClick={() => onMarkAsSeen(alarme.id, alarme.tipo_alarme)}>
                                <i className="bi bi-check-lg"></i> Marcar como Visto
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// --- COMPONENTE PRINCIPAL ---
const AlarmesSistema = () => {
    const [alarmes, setAlarmes] = useState([])
    const [stats, setStats] = useState({})
    const [loading, setLoading] = useState(true)
    const [selectedAlarme, setSelectedAlarme] = useState(null)
    const [filtroAtivo, setFiltroAtivo] = useState("todos")

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
        const interval = setInterval(fetchAlarmes, 300000) // 5 min
        return () => clearInterval(interval)
    }, [])

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

    // Filtros e Lógica de Visualização
    const alarmesFiltrados = alarmes.filter(a =>
        filtroAtivo === "todos" ? true :
            filtroAtivo === "criticos" ? a.prioridade === "Crítico" :
                filtroAtivo === "altos" ? a.prioridade === "Alto" :
                    a.prioridade === "Médio"
    )

    const listaLimitada = alarmesFiltrados.slice(0, 5)

    // Configuração Visual dos Filtros
    const filtrosConfig = [
        { id: 'todos', label: 'Todos', count: alarmes.length, color: 'secondary', icon: 'bi-layers' },
        { id: 'criticos', label: 'Críticos', count: stats.criticos || 0, color: 'danger', icon: 'bi-exclamation-octagon' },
        { id: 'altos', label: 'Altos', count: stats.altos || 0, color: 'warning', icon: 'bi-exclamation-triangle' },
        { id: 'medios', label: 'Médios', count: stats.medios || 0, color: 'info', icon: 'bi-info-circle' },
    ]

    if (loading) return <div className="text-center py-3 text-muted small"><div className="spinner-border spinner-border-sm me-2"></div>Carregando...</div>

    return (
        <div className="card border-0 shadow-sm h-100">
            {/* Header do Widget */}
            <div className="card-header bg-white py-3 border-bottom-0 d-flex justify-content-between align-items-center">
                <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                    <span className="position-relative">
                        <i className="bi bi-bell text-primary fs-5"></i>
                        {alarmes.length > 0 && (
                            <span className="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle">
                                <span className="visually-hidden">Novos alarmes</span>
                            </span>
                        )}
                    </span>
                    Alertas Pendentes
                </h6>
                <span className="badge bg-light text-dark border">{alarmes.length}</span>
            </div>

            <div className="card-body pt-0">
                {/* Barra de Filtros (Pills) */}
                <div className="d-flex gap-2 mb-3 overflow-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                    {filtrosConfig.map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFiltroAtivo(f.id)}
                            className={`btn btn-sm rounded-pill d-flex align-items-center gap-2 px-3 ${filtroAtivo === f.id ? `btn-${f.color} text-white` : 'btn-light text-secondary border'}`}
                            style={{ whiteSpace: 'nowrap', transition: 'all 0.2s' }}
                        >
                            <i className={`bi ${f.icon}`}></i>
                            {f.label}
                            <span className={`badge bg-white text-${f.color} bg-opacity-25 rounded-pill ms-1`}>{f.count}</span>
                        </button>
                    ))}
                </div>

                {/* Lista de Alarmes */}
                <div className="d-flex flex-column gap-2">
                    {listaLimitada.length === 0 ? (
                        <div className="text-center py-4 text-muted bg-light rounded-3 border border-dashed">
                            <i className="bi bi-check2-circle fs-1 text-success opacity-50"></i>
                            <p className="mb-0 small mt-2">Tudo limpo por aqui!</p>
                        </div>
                    ) : (
                        listaLimitada.map(alarme => {
                            const cor = alarme.prioridade === 'Crítico' ? 'danger' : alarme.prioridade === 'Alto' ? 'warning' : 'info'
                            const icon = alarme.prioridade === 'Crítico' ? 'bi-lightning-fill' : 'bi-clock-history'

                            return (
                                <div
                                    key={alarme.id}
                                    className="p-3 rounded-3 border bg-white position-relative hover-shadow cursor-pointer"
                                    style={{ transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'pointer' }}
                                    onClick={() => setSelectedAlarme(alarme)}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)' }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                                >
                                    {/* Indicador Lateral de Cor */}
                                    <div className={`position-absolute top-0 start-0 bottom-0 bg-${cor}`} style={{ width: '4px', borderTopLeftRadius: '4px', borderBottomLeftRadius: '4px' }}></div>

                                    <div className="d-flex justify-content-between align-items-start ms-2">
                                        <div>
                                            <div className="d-flex align-items-center gap-2 mb-1">
                                                <span className={`text-${cor} small fw-bold d-flex align-items-center gap-1`}>
                                                    <i className={`bi ${icon}`}></i> {alarme.prioridade}
                                                </span>
                                                <span className="text-muted small">• {alarme.dias_alerta}d atrás</span>
                                            </div>
                                            <h6 className="mb-0 fw-bold text-dark" style={{ fontSize: '0.9rem' }}>{alarme.nomemaquina}</h6>
                                            <small className="text-muted d-block text-truncate" style={{ maxWidth: '200px' }}>{alarme.cliente_nome}</small>
                                        </div>
                                        <i className="bi bi-chevron-right text-muted small"></i>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>

            {selectedAlarme && (
                <DetalhesAlarmeModal
                    alarme={selectedAlarme}
                    onClose={() => setSelectedAlarme(null)}
                    onMarkAsSeen={marcarComoVisto}
                />
            )}
        </div>
    )
}

export default AlarmesSistema