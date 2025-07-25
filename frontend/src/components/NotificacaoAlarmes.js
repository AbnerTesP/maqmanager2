"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge, Dropdown, Alert, Button, ProgressBar, Toast, ToastContainer } from "react-bootstrap"

function NotificacaoAlarmes() {
    const [alarmes, setAlarmes] = useState([])
    const [totalAlarmes, setTotalAlarmes] = useState(0)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [showToast, setShowToast] = useState(false)
    const [toastMessage, setToastMessage] = useState("")
    const [toastType, setToastType] = useState("success")
    const [filtroAtivo, setFiltroAtivo] = useState("todos")
    const [estatisticas, setEstatisticas] = useState({})
    const [ultimaAtualizacao, setUltimaAtualizacao] = useState(new Date())
    const [dropdownAberto, setDropdownAberto] = useState(false)
    const [alarmesNaoVistos, setAlarmesNaoVistos] = useState(0)
    const [animacaoNova, setAnimacaoNova] = useState(false)

    // Carregar alarmes com callback otimizado
    const carregarAlarmes = useCallback(
        async (mostrarLoading = true) => {
            try {
                if (mostrarLoading) setLoading(true)
                setError(null)

                const [alarmesRes, statsRes] = await Promise.all([
                    fetch("http://localhost:8082/alarmes/resumo"),
                    fetch("http://localhost:8082/alarmes/estatisticas"),
                ])

                if (!alarmesRes.ok || !statsRes.ok) {
                    throw new Error("Erro ao carregar dados dos alarmes")
                }

                const [alarmesData, statsData] = await Promise.all([alarmesRes.json(), statsRes.json()])

                // Verificar se há novos alarmes
                const novosAlarmes = alarmesData.total > totalAlarmes
                if (novosAlarmes && totalAlarmes > 0) {
                    setAnimacaoNova(true)
                    setTimeout(() => setAnimacaoNova(false), 2000)
                    mostrarToast("Novos alarmes detectados!", "warning")
                }

                setAlarmes(alarmesData.alarmes || [])
                setTotalAlarmes(alarmesData.total || 0)
                setEstatisticas(statsData)
                setAlarmesNaoVistos(alarmesData.alarmes?.filter((a) => !a.visto).length || 0)
                setUltimaAtualizacao(new Date())
            } catch (err) {
                console.error("Erro ao carregar alarmes:", err)
                setError(err.message)
                mostrarToast("Erro ao carregar alarmes", "danger")
            } finally {
                if (mostrarLoading) setLoading(false)
            }
        },
        [totalAlarmes],
    )

    // Mostrar toast de notificação
    const mostrarToast = (mensagem, tipo = "success") => {
        setToastMessage(mensagem)
        setToastType(tipo)
        setShowToast(true)
    }

    // Marcar alarme como visto
    const marcarComoVisto = async (alarmeId, tipoAlarme) => {
        try {
            const response = await fetch(`http://localhost:8082/alarmes/marcar-visto/${alarmeId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    tipo_alarme: tipoAlarme,
                }),
            })

            if (!response.ok) {
                throw new Error("Erro ao marcar alarme como visto")
            }

            mostrarToast("Alarme marcado como visto!", "success")
            await carregarAlarmes(false) // Recarregar sem loading
        } catch (err) {
            console.error("Erro ao marcar alarme como visto:", err)
            mostrarToast("Erro ao marcar alarme como visto", "danger")
        }
    }

    // Marcar todos como vistos
    const marcarTodosComoVistos = async () => {
        try {
            const promises = alarmes
                .filter((alarme) => !alarme.visto)
                .map((alarme) =>
                    fetch(`http://localhost:8082/alarmes/marcar-visto/${alarme.reparacao_id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ tipo_alarme: alarme.tipo }),
                    }),
                )

            await Promise.all(promises)
            mostrarToast("Todos os alarmes foram marcados como vistos!", "success")
            await carregarAlarmes(false)
        } catch (err) {
            console.error("Erro ao marcar todos como vistos:", err)
            mostrarToast("Erro ao marcar todos os alarmes", "danger")
        }
    }

    useEffect(() => {
        carregarAlarmes()
        // Atualizar a cada 3 minutos
        const interval = setInterval(() => carregarAlarmes(false), 3 * 60 * 1000)
        return () => clearInterval(interval)
    }, [carregarAlarmes])

    // Filtrar alarmes
    const alarmesFiltrados = alarmes.filter((alarme) => {
        if (filtroAtivo === "todos") return true
        if (filtroAtivo === "nao_vistos") return !alarme.visto
        if (filtroAtivo === "criticos") return alarme.prioridade === "critico"
        if (filtroAtivo === "altos") return alarme.prioridade === "alto"
        return true
    })

    const getPrioridadeColor = (prioridade) => {
        switch (prioridade) {
            case "critico":
                return "danger"
            case "alto":
                return "warning"
            case "medio":
                return "info"
            case "baixo":
                return "secondary"
            default:
                return "secondary"
        }
    }

    const getPrioridadeIcon = (prioridade) => {
        switch (prioridade) {
            case "critico":
                return "bi-exclamation-triangle-fill"
            case "alto":
                return "bi-exclamation-circle-fill"
            case "medio":
                return "bi-info-circle-fill"
            case "baixo":
                return "bi-check-circle-fill"
            default:
                return "bi-bell-fill"
        }
    }

    const getTipoIcon = (tipo) => {
        switch (tipo) {
            case "sem_orcamento":
                return "bi-clipboard-x"
            case "orcamento_aceito":
                return "bi-check-circle"
            case "orcamento_recusado":
                return "bi-x-circle"
            default:
                return "bi-bell"
        }
    }

    const getTipoLabel = (tipo) => {
        switch (tipo) {
            case "sem_orcamento":
                return "Sem Orçamento"
            case "orcamento_aceito":
                return "Orçamento Aceito"
            case "orcamento_recusado":
                return "Orçamento Recusado"
            default:
                return tipo
        }
    }

    const formatarTempo = (dataString) => {
        if (!dataString) return "Data não disponível"
        try {
            const agora = new Date()
            const data = new Date(dataString)
            const diffMs = agora - data
            const diffHoras = Math.floor(diffMs / (1000 * 60 * 60))
            const diffDias = Math.floor(diffHoras / 24)

            if (diffDias > 0) return `${diffDias}d atrás`
            if (diffHoras > 0) return `${diffHoras}h atrás`
            return "Recente"
        } catch {
            return "Data inválida"
        }
    }

    // Componente de estatísticas rápidas
    const EstatisticasRapidas = () => (
        <div className="px-3 py-2 bg-light border-bottom">
            <div className="row g-2 text-center">
                <div className="col-3">
                    <div className="text-danger fw-bold">{estatisticas.criticos || 0}</div>
                    <small className="text-muted">Críticos</small>
                </div>
                <div className="col-3">
                    <div className="text-warning fw-bold">{estatisticas.altos || 0}</div>
                    <small className="text-muted">Altos</small>
                </div>
                <div className="col-3">
                    <div className="text-info fw-bold">{estatisticas.medios || 0}</div>
                    <small className="text-muted">Médios</small>
                </div>
                <div className="col-3">
                    <div className="text-success fw-bold">{alarmesNaoVistos}</div>
                    <small className="text-muted">Não vistos</small>
                </div>
            </div>
        </div>
    )

    // Se não há alarmes
    if (totalAlarmes === 0) {
        return (
            <div className="d-flex align-items-center text-success">
                <i className="bi bi-check-circle-fill me-2"></i>
                <span className="small fw-medium">Sem alarmes</span>
            </div>
        )
    }

    return (
        <>
            <Dropdown align="end" show={dropdownAberto} onToggle={setDropdownAberto}>
                <Dropdown.Toggle
                    variant="outline-light"
                    className={`position-relative border-0 ${animacaoNova ? "animate-pulse" : ""}`}
                    style={{
                        transition: "all 0.3s ease",
                        transform: animacaoNova ? "scale(1.1)" : "scale(1)",
                    }}
                >
                    <i
                        className={`bi ${totalAlarmes > 0 ? "bi-bell-fill" : "bi-bell"} ${animacaoNova ? "text-warning" : ""}`}
                    ></i>
                    {totalAlarmes > 0 && (
                        <Badge
                            bg={alarmesNaoVistos > 0 ? "danger" : "secondary"}
                            pill
                            className="position-absolute top-0 start-100 translate-middle animate-bounce"
                            style={{
                                fontSize: "0.7em",
                                animation: alarmesNaoVistos > 0 ? "pulse 2s infinite" : "none",
                            }}
                        >
                            {totalAlarmes > 99 ? "99+" : totalAlarmes}
                        </Badge>
                    )}
                </Dropdown.Toggle>

                <Dropdown.Menu
                    style={{
                        minWidth: "400px",
                        maxHeight: "500px",
                        overflowY: "auto",
                        boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                        border: "1px solid rgba(0,0,0,0.1)",
                    }}
                >
                    {/* Header com controles */}
                    <div className="d-flex justify-content-between align-items-center px-3 py-2 bg-primary text-white">
                        <div className="d-flex align-items-center">
                            <i className="bi bi-bell-fill me-2"></i>
                            <span className="fw-bold">Alarmes ({totalAlarmes})</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            {loading && (
                                <div className="spinner-border spinner-border-sm" role="status">
                                    <span className="visually-hidden">Carregando...</span>
                                </div>
                            )}
                            <Button
                                variant="outline-light"
                                size="sm"
                                onClick={() => carregarAlarmes()}
                                disabled={loading}
                                title="Atualizar alarmes"
                            >
                                <i className="bi bi-arrow-clockwise"></i>
                            </Button>
                        </div>
                    </div>

                    {/* Estatísticas rápidas */}
                    <EstatisticasRapidas />

                    {/* Filtros */}
                    <div className="px-3 py-2 border-bottom bg-light">
                        <div className="btn-group btn-group-sm w-100" role="group">
                            <input
                                type="radio"
                                className="btn-check"
                                name="filtro"
                                id="todos"
                                checked={filtroAtivo === "todos"}
                                onChange={() => setFiltroAtivo("todos")}
                            />
                            <label className="btn btn-outline-secondary" htmlFor="todos">
                                Todos
                            </label>

                            <input
                                type="radio"
                                className="btn-check"
                                name="filtro"
                                id="nao_vistos"
                                checked={filtroAtivo === "nao_vistos"}
                                onChange={() => setFiltroAtivo("nao_vistos")}
                            />
                            <label className="btn btn-outline-danger" htmlFor="nao_vistos">
                                Não vistos ({alarmesNaoVistos})
                            </label>

                            <input
                                type="radio"
                                className="btn-check"
                                name="filtro"
                                id="criticos"
                                checked={filtroAtivo === "criticos"}
                                onChange={() => setFiltroAtivo("criticos")}
                            />
                            <label className="btn btn-outline-danger" htmlFor="criticos">
                                Críticos
                            </label>
                        </div>
                    </div>

                    {/* Ações rápidas */}
                    {alarmesNaoVistos > 0 && (
                        <div className="px-3 py-2 border-bottom">
                            <Button variant="success" size="sm" className="w-100" onClick={marcarTodosComoVistos}>
                                <i className="bi bi-check-all me-2"></i>
                                Marcar todos como vistos
                            </Button>
                        </div>
                    )}

                    {/* Lista de alarmes */}
                    <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                        {error && (
                            <Alert variant="danger" className="mx-3 mt-2 mb-0 py-2">
                                <i className="bi bi-exclamation-triangle me-2"></i>
                                {error}
                            </Alert>
                        )}

                        {alarmesFiltrados.length === 0 ? (
                            <div className="text-center py-4 text-muted">
                                <i className="bi bi-info-circle fs-1 mb-2 d-block"></i>
                                <p className="mb-0">
                                    {filtroAtivo === "todos" ? "Nenhum alarme ativo" : `Nenhum alarme ${filtroAtivo.replace("_", " ")}`}
                                </p>
                            </div>
                        ) : (
                            alarmesFiltrados.slice(0, 15).map((alarme, index) => (
                                <div key={`${alarme.reparacao_id}-${alarme.tipo}-${index}`}>
                                    <div
                                        className={`px-3 py-2 ${!alarme.visto ? "bg-light border-start border-3 border-" + getPrioridadeColor(alarme.prioridade) : ""}`}
                                        style={{
                                            transition: "all 0.2s ease",
                                            cursor: "pointer",
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!alarme.visto) e.target.style.backgroundColor = "#f8f9fa"
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!alarme.visto) e.target.style.backgroundColor = ""
                                        }}
                                    >
                                        <div className="d-flex justify-content-between align-items-start mb-1">
                                            <div className="d-flex align-items-center flex-grow-1">
                                                <i
                                                    className={`bi ${getPrioridadeIcon(alarme.prioridade)} me-2 text-${getPrioridadeColor(alarme.prioridade)}`}
                                                    title={`Prioridade: ${alarme.prioridade}`}
                                                ></i>
                                                <div className="flex-grow-1">
                                                    <div className="d-flex align-items-center gap-2">
                                                        <strong className="text-primary">Rep. #{alarme.reparacao_id}</strong>
                                                        <Badge bg={getPrioridadeColor(alarme.prioridade)} className="small">
                                                            {alarme.prioridade}
                                                        </Badge>
                                                        {!alarme.visto && (
                                                            <Badge bg="danger" className="small animate-pulse">
                                                                Novo
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-muted small mt-1">
                                                        <i className={`bi ${getTipoIcon(alarme.tipo)} me-1`}></i>
                                                        {getTipoLabel(alarme.tipo)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="small text-muted mb-2">
                                            <div className="d-flex justify-content-between">
                                                <span>
                                                    <i className="bi bi-clock me-1"></i>
                                                    {alarme.dias} dias - {formatarTempo(alarme.data_criacao)}
                                                </span>
                                                <span>
                                                    <i className="bi bi-gear me-1"></i>
                                                    {alarme.equipamento || "Equipamento não especificado"}
                                                </span>
                                            </div>
                                        </div>

                                        {alarme.mensagem && (
                                            <div className="small text-muted mb-2" style={{ fontSize: "0.75em" }}>
                                                {alarme.mensagem.substring(0, 80)}
                                                {alarme.mensagem.length > 80 ? "..." : ""}
                                            </div>
                                        )}

                                        {/* Barra de progresso baseada na urgência */}
                                        <div className="mb-2">
                                            <ProgressBar
                                                variant={getPrioridadeColor(alarme.prioridade)}
                                                now={Math.min((alarme.dias / 30) * 100, 100)}
                                                size="sm"
                                                style={{ height: "3px" }}
                                            />
                                        </div>

                                        <div className="d-flex justify-content-between align-items-center">
                                            <div className="d-flex gap-1">
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    onClick={() => (window.location.href = `/reparacoes/${alarme.reparacao_id}`)}
                                                    title="Ver detalhes da reparação"
                                                >
                                                    <i className="bi bi-eye"></i>
                                                </Button>
                                                {!alarme.visto && (
                                                    <Button
                                                        variant="success"
                                                        size="sm"
                                                        onClick={() => marcarComoVisto(alarme.reparacao_id, alarme.tipo)}
                                                        title="Marcar como visto"
                                                    >
                                                        <i className="bi bi-check"></i>
                                                    </Button>
                                                )}
                                            </div>
                                            {alarme.visto && (
                                                <Badge bg="success" className="small">
                                                    <i className="bi bi-check-circle me-1"></i>
                                                    Visto
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    {index < alarmesFiltrados.length - 1 && <hr className="my-0" />}
                                </div>
                            ))
                        )}

                        {alarmesFiltrados.length > 15 && (
                            <div className="text-center py-2 border-top bg-light">
                                <small className="text-muted">E mais {alarmesFiltrados.length - 15} alarmes...</small>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-3 py-2 border-top bg-light">
                        <div className="d-flex justify-content-between align-items-center">
                            <small className="text-muted">
                                <i className="bi bi-clock me-1"></i>
                                Atualizado:{" "}
                                {ultimaAtualizacao.toLocaleTimeString("pt-PT", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </small>
                            <Button variant="outline-primary" size="sm" href="/alarmes" as="a">
                                <i className="bi bi-arrow-right me-1"></i>
                                Ver Dashboard
                            </Button>
                        </div>
                    </div>
                </Dropdown.Menu>
            </Dropdown>

            {/* Toast de notificações */}
            <ToastContainer position="top-end" className="p-3">
                <Toast show={showToast} onClose={() => setShowToast(false)} delay={3000} autohide bg={toastType}>
                    <Toast.Header>
                        <i className={`bi ${toastType === "success" ? "bi-check-circle" : "bi-exclamation-triangle"} me-2`}></i>
                        <strong className="me-auto">Notificação</strong>
                    </Toast.Header>
                    <Toast.Body className={toastType === "success" ? "text-white" : ""}>{toastMessage}</Toast.Body>
                </Toast>
            </ToastContainer>

            {/* Estilos CSS personalizados */}
            <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        @keyframes bounce {
          0%, 20%, 53%, 80%, 100% { transform: translate3d(0,0,0); }
          40%, 43% { transform: translate3d(0,-8px,0); }
          70% { transform: translate3d(0,-4px,0); }
          90% { transform: translate3d(0,-2px,0); }
        }
        
        .animate-pulse {
          animation: pulse 2s infinite;
        }
        
        .animate-bounce {
          animation: bounce 1s infinite;
        }
      `}</style>
        </>
    )
}

export default NotificacaoAlarmes
