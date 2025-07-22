"use client"

import { useState, useEffect } from "react"
import { Card, Row, Col, Alert, ProgressBar, Badge, Button, Form } from "react-bootstrap"
import { Doughnut, Bar } from "react-chartjs-2"
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    BarElement,
} from "chart.js"

// Registrar componentes do Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement)

function AlarmesDashboard() {
    const [estatisticas, setEstatisticas] = useState({})
    const [alarmes, setAlarmes] = useState([])
    const [alarmesFiltrados, setAlarmesFiltrados] = useState([])
    const [alarmesPorTipo, setAlarmesPorTipo] = useState([])
    const [tendencias, setTendencias] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [filtroTipo, setFiltroTipo] = useState("todos")
    const [filtroPrioridade, setFiltroPrioridade] = useState("todos")
    const [filtroVisto, setFiltroVisto] = useState("todos")
    const [gerandoPDF, setGerandoPDF] = useState(false)

    useEffect(() => {
        carregarDados()
    }, [])

    useEffect(() => {
        aplicarFiltros()
    }, [alarmes, filtroTipo, filtroPrioridade, filtroVisto])

    const carregarDados = async () => {
        try {
            setLoading(true)

            const [estatisticasRes, alarmesRes, tiposRes, tendenciasRes] = await Promise.all([
                fetch("http://localhost:8082/alarmes/estatisticas"),
                fetch("http://localhost:8082/alarmes/todos"),
                fetch("http://localhost:8082/alarmes/por-tipo"),
                fetch("http://localhost:8082/alarmes/tendencias"),
            ])

            if (!estatisticasRes.ok || !alarmesRes.ok || !tiposRes.ok || !tendenciasRes.ok) {
                throw new Error("Erro ao carregar dados do dashboard")
            }

            const [estatisticasData, alarmesData, tiposData, tendenciasData] = await Promise.all([
                estatisticasRes.json(),
                alarmesRes.json(),
                tiposRes.json(),
                tendenciasRes.json(),
            ])

            setEstatisticas(estatisticasData)
            setAlarmes(alarmesData)
            setAlarmesPorTipo(tiposData)
            setTendencias(tendenciasData)
        } catch (err) {
            console.error("Erro ao carregar dados:", err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const aplicarFiltros = () => {
        let filtrados = [...alarmes]

        if (filtroTipo !== "todos") {
            filtrados = filtrados.filter((alarme) => alarme.tipo_alarme === filtroTipo)
        }

        if (filtroPrioridade !== "todos") {
            filtrados = filtrados.filter((alarme) => alarme.prioridade === filtroPrioridade)
        }

        if (filtroVisto !== "todos") {
            const visto = filtroVisto === "visto"
            filtrados = filtrados.filter((alarme) => alarme.visto === visto)
        }

        setAlarmesFiltrados(filtrados)
    }

    const marcarComoVisto = async (reparacaoId, tipoAlarme) => {
        try {
            const response = await fetch(`http://localhost:8082/alarmes/marcar-visto/${reparacaoId}`, {
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

            await carregarDados()
        } catch (err) {
            console.error("Erro ao marcar alarme como visto:", err)
            setError(err.message)
        }
    }

    const gerarPDFAlarmes = async () => {
        try {
            setGerandoPDF(true)
            const response = await fetch("http://localhost:8082/alarmes/pdf")

            if (!response.ok) {
                throw new Error("Erro ao gerar PDF de alarmes")
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement("a")
            link.href = url
            link.download = `relatorio-alarmes-${new Date().toISOString().split("T")[0]}.pdf`
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
        } catch (err) {
            console.error("Erro ao gerar PDF de alarmes:", err)
            setError("Erro ao gerar PDF de alarmes: " + err.message)
        } finally {
            setGerandoPDF(false)
        }
    }

    const verDetalhes = (reparacaoId) => {
        console.log("Ver detalhes da reparação:", reparacaoId)
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

    const getPrioridadeColor = (prioridade) => {
        switch (prioridade) {
            case "Crítico":
                return "danger"
            case "Alto":
                return "warning"
            case "Médio":
                return "info"
            default:
                return "secondary"
        }
    }

    const formatarData = (dataString) => {
        if (!dataString) return "Data não disponível"
        try {
            const data = new Date(dataString)
            if (isNaN(data.getTime())) return "Data inválida"

            return data.toLocaleDateString("pt-PT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            })
        } catch (error) {
            console.error("Erro ao formatar data:", error, dataString)
            return "Data inválida"
        }
    }

    // Configuração do gráfico de pizza (tipos de alarmes)
    const dadosGraficoPizza = {
        labels: alarmesPorTipo.map((tipo) => getTipoLabel(tipo.tipo_alarme)),
        datasets: [
            {
                data: alarmesPorTipo.map((tipo) => tipo.quantidade),
                backgroundColor: ["#dc3545", "#ffc107", "#17a2b8"],
                borderColor: ["#dc3545", "#ffc107", "#17a2b8"],
                borderWidth: 2,
            },
        ],
    }

    // Configuração do gráfico de barras (tempo médio)
    const dadosGraficoBarras = {
        labels: ["Sem Orçamento", "Orçamento Aceito", "Orçamento Recusado"],
        datasets: [
            {
                label: "Tempo Médio (dias)",
                data: [
                    tendencias.tempo_medio_sem_orcamento || 0,
                    tendencias.tempo_medio_aceito || 0,
                    tendencias.tempo_medio_recusado || 0,
                ],
                backgroundColor: ["#dc3545", "#ffc107", "#17a2b8"],
                borderColor: ["#dc3545", "#ffc107", "#17a2b8"],
                borderWidth: 1,
            },
        ],
    }



    const opcoesGrafico = {
        responsive: true,
        plugins: {
            legend: {
                position: "top",
            },
        },
    }

    if (loading) {
        return (
            <div className="container-fluid py-4">
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Carregando...</span>
                    </div>
                    <p className="mt-2">Carregando dashboard...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="container-fluid py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>
                    <i className="bi bi-graph-up me-2 text-primary"></i>
                    Dashboard de Alarmes
                </h2>
                <div className="d-flex gap-2 align-items-center">
                    <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={gerarPDFAlarmes}
                        disabled={gerandoPDF}
                    >
                        {gerandoPDF ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                                Gerando...
                            </>
                        ) : (
                            <>
                                <i className="bi bi-file-earmark-pdf me-1"></i>
                                Gerar PDF
                            </>
                        )}
                    </Button>
                    <Badge bg="info" className="fs-6">
                        Atualizado: {new Date().toLocaleTimeString("pt-PT")}
                    </Badge>
                </div>
            </div>

            {error && (
                <Alert variant="danger" dismissible onClose={() => setError(null)}>
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {error}
                </Alert>
            )}

            {/* Estatísticas Principais */}
            <Row className="mb-4">
                <Col md={3}>
                    <Card className="text-center border-primary h-100">
                        <Card.Body>
                            <i className="bi bi-bell-fill text-primary fs-1 mb-2"></i>
                            <h3 className="text-primary">{estatisticas.total_alarmes || 0}</h3>
                            <p className="mb-0">Total de Alarmes</p>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="text-center border-danger h-100">
                        <Card.Body>
                            <i className="bi bi-exclamation-triangle-fill text-danger fs-1 mb-2"></i>
                            <h3 className="text-danger">{estatisticas.criticos || 0}</h3>
                            <p className="mb-0">Críticos</p>
                            <small className="text-muted">≥30 dias</small>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="text-center border-warning h-100">
                        <Card.Body>
                            <i className="bi bi-exclamation-circle-fill text-warning fs-1 mb-2"></i>
                            <h3 className="text-warning">{estatisticas.altos || 0}</h3>
                            <p className="mb-0">Alta Prioridade</p>
                            <small className="text-muted">20-29 dias</small>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={3}>
                    <Card className="text-center border-success h-100">
                        <Card.Body>
                            <i className="bi bi-check-circle-fill text-success fs-1 mb-2"></i>
                            <h3 className="text-success">{tendencias.taxa_resolucao || 0}%</h3>
                            <p className="mb-0">Taxa de Resolução</p>
                            <small className="text-muted">Esta semana</small>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Gráficos */}
            <Row className="mb-4">
                <Col md={6}>
                    <Card className="h-100">
                        <Card.Header>
                            <h5 className="mb-0">
                                <i className="bi bi-pie-chart me-2"></i>
                                Distribuição por Tipo
                            </h5>
                        </Card.Header>
                        <Card.Body>
                            {alarmesPorTipo.length > 0 ? (
                                <Doughnut data={dadosGraficoPizza} options={opcoesGrafico} />
                            ) : (
                                <div className="text-center text-muted py-5">
                                    <i className="bi bi-info-circle fs-1 mb-3"></i>
                                    <p>Nenhum alarme ativo</p>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="h-100">
                        <Card.Header>
                            <h5 className="mb-0">
                                <i className="bi bi-bar-chart me-2"></i>
                                Tempo Médio por Tipo
                            </h5>
                        </Card.Header>
                        <Card.Body>
                            <Bar data={dadosGraficoBarras} options={opcoesGrafico} />
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Filtros */}
            <Card className="mb-4">
                <Card.Header>
                    <h5 className="mb-0">
                        <i className="bi bi-funnel me-2"></i>
                        Filtros de Alarmes
                    </h5>
                </Card.Header>
                <Card.Body>
                    <Row>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>Tipo de Alarme</Form.Label>
                                <Form.Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                                    <option value="todos">Todos os tipos</option>
                                    <option value="sem_orcamento">Sem Orçamento</option>
                                    <option value="orcamento_aceito">Orçamento Aceito</option>
                                    <option value="orcamento_recusado">Orçamento Recusado</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>Prioridade</Form.Label>
                                <Form.Select value={filtroPrioridade} onChange={(e) => setFiltroPrioridade(e.target.value)}>
                                    <option value="todos">Todas as prioridades</option>
                                    <option value="Crítico">Crítico</option>
                                    <option value="Alto">Alto</option>
                                    <option value="Médio">Médio</option>
                                    <option value="Baixo">Baixo</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>Status</Form.Label>
                                <Form.Select value={filtroVisto} onChange={(e) => setFiltroVisto(e.target.value)}>
                                    <option value="todos">Todos</option>
                                    <option value="nao_visto">Não vistos</option>
                                    <option value="visto">Vistos</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {/* Lista de Alarmes */}
            <Card>
                <Card.Header className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">
                        <i className="bi bi-list-ul me-2"></i>
                        Lista de Alarmes ({alarmesFiltrados.length})
                    </h5>
                    <Button variant="outline-primary" size="sm" onClick={carregarDados}>
                        <i className="bi bi-arrow-clockwise me-1"></i>
                        Atualizar
                    </Button>
                </Card.Header>
                <Card.Body>
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
                                            <Badge bg={getPrioridadeColor(alarme.prioridade)}>{alarme.prioridade}</Badge>
                                        </Card.Header>
                                        <Card.Body>
                                            <h6 className="mb-2">
                                                <i className="bi bi-gear me-1"></i>
                                                {alarme.nomemaquina || "Equipamento não especificado"}
                                            </h6>
                                            <p className="text-muted small mb-2">
                                                <i className="bi bi-hash me-1"></i>
                                                Reparação #{alarme.numreparacao || alarme.id}
                                            </p>
                                            {alarme.cliente_nome && (
                                                <p className="text-muted small mb-2">
                                                    <i className="bi bi-person me-1"></i>
                                                    {alarme.cliente_nome}
                                                </p>
                                            )}
                                            <p className="text-muted small mb-2">
                                                <i className="bi bi-calendar me-1"></i>
                                                Entrada: {formatarData(alarme.dataentrega)}
                                            </p>
                                            <p className="text-muted small mb-2">
                                                <i className="bi bi-clock me-1"></i>
                                                <strong>{alarme.dias_alerta} dias</strong> desde a entrada
                                            </p>
                                            {alarme.descricao && (
                                                <p className="text-muted small mb-2">
                                                    <i className="bi bi-file-text me-1"></i>
                                                    {alarme.descricao.substring(0, 100)}
                                                    {alarme.descricao.length > 100 ? "..." : ""}
                                                </p>
                                            )}
                                            <div className="mt-2">
                                                <Badge bg="secondary" className="me-2">
                                                    {alarme.estadoorcamento || "Sem orçamento"}
                                                </Badge>
                                                <Badge bg="info">{alarme.estadoreparacao || "Em análise"}</Badge>
                                            </div>
                                        </Card.Body>
                                        <Card.Footer className="d-flex justify-content-between">
                                            <Button variant="outline-primary" size="sm" onClick={() => verDetalhes(alarme.id)}>
                                                <i className="bi bi-eye me-1"></i>
                                                Detalhes
                                            </Button>
                                            {!alarme.visto && (
                                                <Button
                                                    variant="success"
                                                    size="sm"
                                                    onClick={() => marcarComoVisto(alarme.id, alarme.tipo_alarme)}
                                                >
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
                </Card.Body>
            </Card>

            {/* Detalhes por Tipo */}
            <Row className="mb-4 mt-4">
                <Col md={4}>
                    <Card className="border-danger h-100">
                        <Card.Header className="bg-danger text-white">
                            <h6 className="mb-0">
                                <i className="bi bi-clipboard-x me-2"></i>
                                Sem Orçamento
                            </h6>
                        </Card.Header>
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <span>Quantidade:</span>
                                <Badge bg="danger">{estatisticas.sem_orcamento || 0}</Badge>
                            </div>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <span>Tempo Médio:</span>
                                <span>{tendencias.tempo_medio_sem_orcamento || 0} dias</span>
                            </div>
                            <ProgressBar
                                variant="danger"
                                now={((estatisticas.sem_orcamento || 0) / (estatisticas.total_alarmes || 1)) * 100}
                                className="mb-2"
                            />
                            <small className="text-muted">Reparações há mais de 15 dias sem orçamento definido</small>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="border-warning h-100">
                        <Card.Header className="bg-warning text-dark">
                            <h6 className="mb-0">
                                <i className="bi bi-check-circle me-2"></i>
                                Orçamento Aceito
                            </h6>
                        </Card.Header>
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <span>Quantidade:</span>
                                <Badge bg="warning">{estatisticas.orcamento_aceito || 0}</Badge>
                            </div>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <span>Tempo Médio:</span>
                                <span>{tendencias.tempo_medio_aceito || 0} dias</span>
                            </div>
                            <ProgressBar
                                variant="warning"
                                now={((estatisticas.orcamento_aceito || 0) / (estatisticas.total_alarmes || 1)) * 100}
                                className="mb-2"
                            />
                            <small className="text-muted">Orçamentos aceitos há mais de 30 dias sem conclusão</small>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={4}>
                    <Card className="border-info h-100">
                        <Card.Header className="bg-info text-white">
                            <h6 className="mb-0">
                                <i className="bi bi-x-circle me-2"></i>
                                Orçamento Recusado
                            </h6>
                        </Card.Header>
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <span>Quantidade:</span>
                                <Badge bg="info">{estatisticas.orcamento_recusado || 0}</Badge>
                            </div>
                            <div className="d-flex justify-content-between align-items-center mb-2">
                                <span>Tempo Médio:</span>
                                <span>{tendencias.tempo_medio_recusado || 0} dias</span>
                            </div>
                            <ProgressBar
                                variant="info"
                                now={((estatisticas.orcamento_recusado || 0) / (estatisticas.total_alarmes || 1)) * 100}
                                className="mb-2"
                            />
                            <small className="text-muted">Orçamentos recusados há mais de 15 dias - verificar equipamentos</small>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Métricas de Performance */}
            <Row>
                <Col md={6}>
                    <Card className="border-success">
                        <Card.Header className="bg-success text-white">
                            <h6 className="mb-0">
                                <i className="bi bi-graph-up-arrow me-2"></i>
                                Performance da Semana
                            </h6>
                        </Card.Header>
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <span>Reparações Resolvidas:</span>
                                <Badge bg="success" className="fs-6">
                                    {tendencias.resolvidos_semana || 0}
                                </Badge>
                            </div>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <span>Total de Reparações:</span>
                                <Badge bg="secondary" className="fs-6">
                                    {tendencias.total_semana || 0}
                                </Badge>
                            </div>
                            <div className="d-flex justify-content-between align-items-center">
                                <span>Taxa de Resolução:</span>
                                <Badge bg="primary" className="fs-6">
                                    {tendencias.taxa_resolucao || 0}%
                                </Badge>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="border-primary">
                        <Card.Header className="bg-primary text-white">
                            <h6 className="mb-0">
                                <i className="bi bi-lightbulb me-2"></i>
                                Recomendações
                            </h6>
                        </Card.Header>
                        <Card.Body>
                            {estatisticas.criticos > 0 && (
                                <Alert variant="danger" className="mb-2 py-2">
                                    <small>
                                        <i className="bi bi-exclamation-triangle me-1"></i>
                                        {estatisticas.criticos} alarmes críticos precisam de atenção imediata
                                    </small>
                                </Alert>
                            )}
                            {estatisticas.sem_orcamento > 5 && (
                                <Alert variant="warning" className="mb-2 py-2">
                                    <small>
                                        <i className="bi bi-clipboard-x me-1"></i>
                                        Muitas reparações sem orçamento - revisar processo
                                    </small>
                                </Alert>
                            )}
                            {tendencias.taxa_resolucao < 70 && (
                                <Alert variant="info" className="mb-2 py-2">
                                    <small>
                                        <i className="bi bi-graph-down me-1"></i>
                                        Taxa de resolução baixa - otimizar fluxo de trabalho
                                    </small>
                                </Alert>
                            )}
                            {estatisticas.total_alarmes === 0 && (
                                <Alert variant="success" className="mb-0 py-2">
                                    <small>
                                        <i className="bi bi-check-circle me-1"></i>
                                        Excelente! Nenhum alarme ativo no momento
                                    </small>
                                </Alert>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    )
}

export default AlarmesDashboard