"use client"

import { useState, useEffect } from "react"
import { Badge, Dropdown, Alert } from "react-bootstrap"

function NotificacaoAlarmes() {
    const [alarmes, setAlarmes] = useState([])
    const [totalAlarmes, setTotalAlarmes] = useState(0)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        carregarAlarmes()
        // Atualizar a cada 5 minutos
        const interval = setInterval(carregarAlarmes, 5 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    const carregarAlarmes = async () => {
        try {
            setLoading(true)
            const response = await fetch("/api/alarmes/resumo")
            if (!response.ok) throw new Error("Erro ao carregar alarmes")

            const data = await response.json()
            setAlarmes(data.alarmes || [])
            setTotalAlarmes(data.total || 0)
        } catch (err) {
            console.error("Erro ao carregar alarmes:", err)
        } finally {
            setLoading(false)
        }
    }

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

    if (totalAlarmes === 0) {
        return (
            <div className="d-flex align-items-center text-success">
                <i className="bi bi-check-circle me-2"></i>
                <span className="small">Sem alarmes</span>
            </div>
        )
    }

    return (
        <Dropdown align="end">
            <Dropdown.Toggle variant="outline-light" className="position-relative border-0">
                <i className="bi bi-bell-fill"></i>
                {totalAlarmes > 0 && (
                    <Badge
                        bg="danger"
                        pill
                        className="position-absolute top-0 start-100 translate-middle"
                        style={{ fontSize: "0.7em" }}
                    >
                        {totalAlarmes > 99 ? "99+" : totalAlarmes}
                    </Badge>
                )}
            </Dropdown.Toggle>

            <Dropdown.Menu style={{ minWidth: "350px", maxHeight: "400px", overflowY: "auto" }}>
                <Dropdown.Header className="d-flex justify-content-between align-items-center">
                    <span>
                        <i className="bi bi-bell me-2"></i>
                        Alarmes ({totalAlarmes})
                    </span>
                    {loading && (
                        <div className="spinner-border spinner-border-sm text-primary" role="status">
                            <span className="visually-hidden">Carregando...</span>
                        </div>
                    )}
                </Dropdown.Header>

                <Dropdown.Divider />

                {alarmes.length === 0 ? (
                    <Dropdown.ItemText>
                        <Alert variant="info" className="mb-0 small">
                            <i className="bi bi-info-circle me-2"></i>
                            Nenhum alarme ativo
                        </Alert>
                    </Dropdown.ItemText>
                ) : (
                    alarmes.slice(0, 10).map((alarme, index) => (
                        <div key={index}>
                            <Dropdown.ItemText className="small">
                                <div className="d-flex justify-content-between align-items-start mb-1">
                                    <div className="d-flex align-items-center">
                                        <i
                                            className={`bi ${getTipoIcon(alarme.tipo)} me-2 text-${getPrioridadeColor(alarme.prioridade)}`}
                                        ></i>
                                        <strong>Rep. #{alarme.reparacao_id}</strong>
                                    </div>
                                    <Badge bg={getPrioridadeColor(alarme.prioridade)} className="small">
                                        {alarme.prioridade}
                                    </Badge>
                                </div>
                                <div className="text-muted" style={{ fontSize: "0.8em" }}>
                                    {getTipoLabel(alarme.tipo)}
                                </div>
                                <div className="text-muted" style={{ fontSize: "0.75em" }}>
                                    {alarme.dias} dias - {alarme.mensagem?.substring(0, 50)}...
                                </div>
                            </Dropdown.ItemText>
                            {index < alarmes.length - 1 && <Dropdown.Divider />}
                        </div>
                    ))
                )}

                {alarmes.length > 10 && (
                    <>
                        <Dropdown.Divider />
                        <Dropdown.ItemText className="text-center small text-muted">
                            E mais {alarmes.length - 10} alarmes...
                        </Dropdown.ItemText>
                    </>
                )}

                <Dropdown.Divider />
                <Dropdown.Item href="/alarmes" className="text-center">
                    <i className="bi bi-arrow-right me-2"></i>
                    Ver Todos os Alarmes
                </Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown>
    )
}

export default NotificacaoAlarmes
