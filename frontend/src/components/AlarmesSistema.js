"use client"

import { useState, useEffect } from "react"
import { Card, Row, Col, Badge, Button, Alert, Modal, Form, Toast, ToastContainer } from "react-bootstrap"

function AlarmesSistema() {
    const [alarmes, setAlarmes] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [filtroTipo, setFiltroTipo] = useState("todos")
    const [filtroPrioridade, setFiltroPrioridade] = useState("todos")
    const [showModal, setShowModal] = useState(false)
    const [alarmeDetalhes, setAlarmeDetalhes] = useState(null)
    const [showToast, setShowToast] = useState(false)
    const [toastMessage, setToastMessage] = useState("")
    const [estatisticas, setEstatisticas] = useState({})

    useEffect(() => {
        carregarAlarmes()
        carregarEstatisticas()
    }, [])

    const carregarAlarmes = async () => {
        try {
            setLoading(true)
            const response = await fetch("/api/alarmes")
            if (!response.ok) throw new Error("Erro ao carregar alarmes")

            const data = await response.json()
            setAlarmes(data)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const carregarEstatisticas = async () => {
        try {
            const response = await fetch("/api/alarmes/estatisticas")
            if (!response.ok) throw new Error("Erro ao carregar estatísticas")

            const data = await response.json()
            setEstatisticas(data)
        } catch (err) {
            console.error("Erro ao carregar estatísticas:", err)
        }
    }

    const marcarComoVisto = async (alarmeId, tipo = null) => {
        try {
            const url = tipo ? `/api/alarmes/marcar-visto/${tipo}` : `/api/alarmes/marcar-visto/${alarmeId}`
            const response = await fetch(url, { method: "PUT" })

            if (!response.ok) throw new Error("Erro ao marcar alarme como visto")

            await carregarAlarmes()
            await carregarEstatisticas()

            setToastMessage(tipo ? `Todos os alarmes de ${tipo} marcados como vistos` : "Alarme marcado como visto")
            setShowToast(true)
        } catch (err) {
            setError(err.message)
        }
    }

    const verDetalhes = async (alarmeId) => {
        try {
            const response = await fetch(`/api/alarmes/${alarmeId}`)
            if (!response.ok) throw new Error("Erro ao carregar detalhes")

            const data = await response.json()
            setAlarmeDetalhes(data)
            setShowModal(true)
        } catch (err) {
            setError(err.message)
        }
    }

    const alarmesFiltrados = alarmes.filter((alarme) => {
        const filtroTipoOk = filtroTipo === "todos" || alarme.tipo_alarme === filtroTipo
        const filtroPrioridadeOk = filtroPrioridade === "todos" || alarme.prioridade === filtroPrioridade
        return filtroTipoOk && filtroPrioridadeOk
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

    if (loading) {
        return (
            <div className="container-fluid py-4">
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Carregando...</span>
                    </div>
                    <p className="mt-2">Carregando alarmes...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="container-fluid py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>
                    <i className="bi bi-bell-fill me-2 text-warning"></i>
                    Sistema de Alarmes
                </h2>
                <Button variant="outline-primary" onClick={carregarAlarmes}>
                    <i className="bi bi-arrow-clockwise me-1"></i>
                    Atualizar
                </Button>
            </div>

            {error && (
                <Alert variant="danger" dismissible onClose={() => setError(null)}>
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {error}
                </Alert>
            )}

            {/* Estatísticas */}
            <Row className="mb-4">
                <Col md={3}>
                    <Card className="text-center border-primary">
                        <Card.Body>
                            <h3 className="text-primary">{estatisticas.total || 0}</h3>
                            <p className="mb-0">Total de Alarmes</p>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="text-center border-danger">
                        <Card.Body>
                            <h3 className="text-danger">{estatisticas.criticos || 0}</h3>
                            <p className="mb-0">Críticos</p>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="text-center border-warning">
                        <Card.Body>
                            <h3 className="text-warning">{estatisticas.altos || 0}</h3>
                            <p className="mb-0">Alta Prioridade</p>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="text-center border-success">
                        <Card.Body>
                            <h3 className="text-success">{estatisticas.vistos || 0}</h3>
                            <p className="mb-0">Vistos</p>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Filtros */}
            <Card className="mb-4">
                <Card.Body>
                    <Row>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>Filtrar por Tipo:</Form.Label>
                                <Form.Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                                    <option value="todos">Todos os Tipos</option>
                                    <option value="sem_orcamento">Sem Orçamento</option>
                                    <option value="orcamento_aceito">Orçamento Aceito</option>
                                    <option value="orcamento_recusado">Orçamento Recusado</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>Filtrar por Prioridade:</Form.Label>
                                <Form.Select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)}>
                                    <option value="todos">Todas as Prioridades</option>
                                    <option value="critico">Crítico</option>
                                    <option value="alto">Alto</option>
                                    <option value="medio">Médio</option>
                                    <option value="baixo">Baixo</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4} className="d-flex align-items-end">
                            <div className="d-flex gap-2">
                                <Button variant="outline-success" onClick={() => marcarComoVisto(null, "sem_orcamento")}>
                                    Marcar Sem Orçamento
                                </Button>
                                <Button variant="outline-info" onClick={() => marcarComoVisto(null, "orcamento_aceito")}>
                                    Marcar Aceitos
                                </Button>
                                <Button variant="outline-warning" onClick={() => marcarComoVisto(null, "orcamento_recusado")}>
                                    Marcar Recusados
                                </Button>
                            </div>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* Lista de Alarmes */}
            {alarmesFiltrados.length === 0 ? (
                <Alert variant="info" className="text-center">
                    <i className="bi bi-info-circle me-2"></i>
                    Nenhum alarme encontrado com os filtros selecionados.
                </Alert>
            ) : (
                <Row>
                    {alarmesFiltrados.map((alarme) => (
                        <Col md={6} lg={4} key={alarme.id} className="mb-3">
                            <Card className={`h-100 ${!alarme.visto ? "border-" + getPrioridadeColor(alarme.prioridade) : ""}`}>
                                <Card.Header className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <i className={`bi ${getTipoIcon(alarme.tipo_alarme)} me-2`}></i>
                                        {getTipoLabel(alarme.tipo_alarme)}
                                    </div>
                                    <Badge bg={getPrioridadeColor(alarme.prioridade)}>{alarme.prioridade.toUpperCase()}</Badge>
                                </Card.Header>
                                <Card.Body>
                                    <h6>Reparação #{alarme.reparacao_id}</h6>
                                    <p className="text-muted small mb-2">{alarme.mensagem}</p>
                                    <p className="text-muted small mb-2">
                                        <i className="bi bi-calendar me-1"></i>
                                        {new Date(alarme.data_alarme).toLocaleString("pt-PT")}
                                    </p>
                                    <p className="text-muted small">
                                        <i className="bi bi-clock me-1"></i>
                                        {alarme.dias_decorridos} dias
                                    </p>
                                </Card.Body>
                                <Card.Footer className="d-flex justify-content-between">
                                    <Button variant="outline-primary" size="sm" onClick={() => verDetalhes(alarme.id)}>
                                        <i className="bi bi-eye me-1"></i>
                                        Detalhes
                                    </Button>
                                    {!alarme.visto && (
                                        <Button variant="success" size="sm" onClick={() => marcarComoVisto(alarme.id)}>
                                            <i className="bi bi-check me-1"></i>
                                            Marcar Visto
                                        </Button>
                                    )}
                                    {alarme.visto && (
                                        <Badge bg="success">
                                            <i className="bi bi-check-circle me-1"></i>
                                            Visto
                                        </Badge>
                                    )}
                                </Card.Footer>
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}

            {/* Modal de Detalhes */}
            <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Detalhes do Alarme</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {alarmeDetalhes && (
                        <div>
                            <Row>
                                <Col md={6}>
                                    <strong>Tipo:</strong> {getTipoLabel(alarmeDetalhes.tipo_alarme)}
                                </Col>
                                <Col md={6}>
                                    <strong>Prioridade:</strong>
                                    <Badge bg={getPrioridadeColor(alarmeDetalhes.prioridade)} className="ms-2">
                                        {alarmeDetalhes.prioridade.toUpperCase()}
                                    </Badge>
                                </Col>
                            </Row>
                            <hr />
                            <Row>
                                <Col md={6}>
                                    <strong>Reparação:</strong> #{alarmeDetalhes.reparacao_id}
                                </Col>
                                <Col md={6}>
                                    <strong>Dias Decorridos:</strong> {alarmeDetalhes.dias_decorridos}
                                </Col>
                            </Row>
                            <hr />
                            <Row>
                                <Col>
                                    <strong>Mensagem:</strong>
                                    <p className="mt-2">{alarmeDetalhes.mensagem}</p>
                                </Col>
                            </Row>
                            <hr />
                            <Row>
                                <Col md={6}>
                                    <strong>Data do Alarme:</strong>
                                    <br />
                                    {new Date(alarmeDetalhes.data_alarme).toLocaleString("pt-PT")}
                                </Col>
                                <Col md={6}>
                                    <strong>Status:</strong>
                                    <br />
                                    {alarmeDetalhes.visto ? (
                                        <Badge bg="success">Visto em {new Date(alarmeDetalhes.data_visto).toLocaleString("pt-PT")}</Badge>
                                    ) : (
                                        <Badge bg="warning">Não Visto</Badge>
                                    )}
                                </Col>
                            </Row>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowModal(false)}>
                        Fechar
                    </Button>
                    {alarmeDetalhes && !alarmeDetalhes.visto && (
                        <Button
                            variant="success"
                            onClick={() => {
                                marcarComoVisto(alarmeDetalhes.id)
                                setShowModal(false)
                            }}
                        >
                            <i className="bi bi-check me-1"></i>
                            Marcar como Visto
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>

            {/* Toast de Notificação */}
            <ToastContainer position="top-end" className="p-3">
                <Toast show={showToast} onClose={() => setShowToast(false)} delay={3000} autohide>
                    <Toast.Header>
                        <i className="bi bi-check-circle-fill text-success me-2"></i>
                        <strong className="me-auto">Sucesso</strong>
                    </Toast.Header>
                    <Toast.Body>{toastMessage}</Toast.Body>
                </Toast>
            </ToastContainer>
        </div>
    )
}

export default AlarmesSistema
