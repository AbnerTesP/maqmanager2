"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Card, Row, Col, Alert, ProgressBar, Badge, Button, Form, Spinner, Pagination } from "react-bootstrap"
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

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement)

// --- Constants ---
const API_BASE_URL = "http://localhost:8082/alarmes"

// --- Helper Functions ---
const getTipoLabel = (tipo) => {
    const labels = {
        sem_orcamento: "Sem Orçamento",
        orcamento_aceito: "Orçamento Aceito",
        orcamento_recusado: "Orçamento Recusado",
    }
    return labels[tipo] || tipo
}

const getTipoIcon = (tipo) => {
    const icons = {
        sem_orcamento: "bi-clipboard-x",
        orcamento_aceito: "bi-check-circle",
        orcamento_recusado: "bi-x-circle",
    }
    return icons[tipo] || "bi-bell"
}

const getPrioridadeColor = (prioridade) => {
    const colors = {
        Crítico: "danger",
        Alto: "warning",
        Médio: "info",
    }
    return colors[prioridade] || "secondary"
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
        console.error("Erro ao formatar data:", error)
        return "Data inválida"
    }
}

// --- Custom Hook for Data Fetching ---
const useAlarmData = () => {
    const [data, setData] = useState({
        estatisticas: {},
        alarmes: [],
        alarmesPorTipo: [],
        tendencias: {},
    })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const fetchData = async () => {
        setLoading(true)
        setError(null)
        try {
            const [estatisticasRes, alarmesRes, tiposRes, tendenciasRes] = await Promise.all([
                fetch(`${API_BASE_URL}/estatisticas`),
                fetch(`${API_BASE_URL}/todos`),
                fetch(`${API_BASE_URL}/por-tipo`),
                fetch(`${API_BASE_URL}/tendencias`),
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

            setData({
                estatisticas: estatisticasData,
                alarmes: alarmesData,
                alarmesPorTipo: tiposData,
                tendencias: tendenciasData,
            })
        } catch (err) {
            console.error("Erro ao carregar dados:", err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    return { ...data, loading, error, refetch: fetchData }
}

// --- Sub-components ---

const StatCard = ({ title, value, subtitle, icon, color, borderColor }) => (
    <Card className={`text-center border-${borderColor} h-100`}>
        <Card.Body>
            <i className={`bi ${icon} text-${color} fs-1 mb-2`}></i>
            <h3 className={`text-${color}`}>{value}</h3>
            <p className="mb-0">{title}</p>
            {subtitle && <small className="text-muted">{subtitle}</small>}
        </Card.Body>
    </Card>
)

const ChartCard = ({ title, icon, children }) => (
    <Card className="h-100">
        <Card.Header>
            <h5 className="mb-0">
                <i className={`bi ${icon} me-2`}></i>
                {title}
            </h5>
        </Card.Header>
        <Card.Body>{children}</Card.Body>
    </Card>
)

const FilterSection = ({ filters, setFilter }) => (
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
                        <Form.Select
                            value={filters.tipo}
                            onChange={(e) => setFilter("tipo", e.target.value)}
                        >
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
                        <Form.Select
                            value={filters.prioridade}
                            onChange={(e) => setFilter("prioridade", e.target.value)}
                        >
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
                        <Form.Select
                            value={filters.visto}
                            onChange={(e) => setFilter("visto", e.target.value)}
                        >
                            <option value="todos">Todos</option>
                            <option value="nao_visto">Não vistos</option>
                            <option value="visto">Vistos</option>
                        </Form.Select>
                    </Form.Group>
                </Col>
            </Row>
        </Card.Body>
    </Card>
)

const AlarmeCard = ({ alarme, onMarkAsSeen, onViewDetails }) => (
    <Col md={6} lg={4} className="mb-3">
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
                <Button variant="outline-primary" size="sm" onClick={() => onViewDetails(alarme.id)}>
                    <i className="bi bi-eye me-1"></i>
                    Detalhes
                </Button>
                {!alarme.visto ? (
                    <Button variant="success" size="sm" onClick={() => onMarkAsSeen(alarme.id, alarme.tipo_alarme)}>
                        <i className="bi bi-check me-1"></i>
                        Marcar Visto
                    </Button>
                ) : (
                    <Badge bg="success">
                        <i className="bi bi-check-circle me-1"></i>
                        Visto
                    </Badge>
                )}
            </Card.Footer>
        </Card>
    </Col>
)

const DetailCard = ({ title, icon, quantity, avgTime, progressColor, progressValue, description, color }) => (
    <Card className={`border-${color} h-100`}>
        <Card.Header className={`bg-${color} ${color === "warning" ? "text-dark" : "text-white"}`}>
            <h6 className="mb-0">
                <i className={`bi ${icon} me-2`}></i>
                {title}
            </h6>
        </Card.Header>
        <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <span>Quantidade:</span>
                <Badge bg={color}>{quantity}</Badge>
            </div>
            <div className="d-flex justify-content-between align-items-center mb-2">
                <span>Tempo Médio:</span>
                <span>{avgTime} dias</span>
            </div>
            <ProgressBar variant={color} now={progressValue} className="mb-2" />
            <small className="text-muted">{description}</small>
        </Card.Body>
    </Card>
)

// --- Main Component ---

function AlarmesDashboard() {
    const { estatisticas, alarmes, alarmesPorTipo, tendencias, loading, error, refetch } = useAlarmData()

    // Estado para filtros e paginação com persistência na sessão
    const [filtros, setFiltros] = useState(() => {
        const saved = sessionStorage.getItem('dashboardAlarmesFiltros')
        return saved ? JSON.parse(saved) : { tipo: "todos", prioridade: "todos", visto: "todos" }
    })
    const [currentPage, setCurrentPage] = useState(() => Number(sessionStorage.getItem('dashboardAlarmesPage')) || 1)
    const ITEMS_PER_PAGE = 6 // 6 itens por página (2 linhas de 3 cards)
    const mounted = useRef(false)

    const [gerandoPDF, setGerandoPDF] = useState(false)

    const alarmesFiltrados = useMemo(() => {
        return alarmes.filter((alarme) => {
            if (filtros.tipo !== "todos" && alarme.tipo_alarme !== filtros.tipo) return false
            if (filtros.prioridade !== "todos" && alarme.prioridade !== filtros.prioridade) return false
            if (filtros.visto !== "todos") {
                const visto = filtros.visto === "visto"
                if (alarme.visto !== visto) return false
            }
            return true
        })
    }, [alarmes, filtros])

    // Persistir filtros e resetar página ao mudar filtro (mas não no carregamento inicial)
    useEffect(() => {
        sessionStorage.setItem('dashboardAlarmesFiltros', JSON.stringify(filtros))
        if (mounted.current) {
            setCurrentPage(1)
        } else {
            mounted.current = true
        }
    }, [filtros])

    // Persistir página atual
    useEffect(() => {
        sessionStorage.setItem('dashboardAlarmesPage', String(currentPage))
    }, [currentPage])

    // Lógica de Paginação
    const totalPages = Math.ceil(alarmesFiltrados.length / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const paginatedAlarmes = alarmesFiltrados.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page)
        }
    }

    const handleFilterChange = (key, value) => {
        setFiltros((prev) => ({ ...prev, [key]: value }))
    }

    const marcarComoVisto = async (reparacaoId, tipoAlarme) => {
        try {
            const response = await fetch(`${API_BASE_URL}/marcar-visto/${reparacaoId}`, {
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

            await refetch()
        } catch (err) {
            console.error("Erro ao marcar alarme como visto:", err)
            // Consider adding a toast notification for error
        }
    }

    const gerarPDFAlarmes = async () => {
        try {
            setGerandoPDF(true)
            const response = await fetch(`${API_BASE_URL}/pdf`)

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
            // Consider adding a toast notification for error
        } finally {
            setGerandoPDF(false)
        }
    }

    const verDetalhes = (reparacaoId) => {
        console.log("Ver detalhes da reparação:", reparacaoId)
        // Add navigation logic here
    }

    // Chart Data
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
            <div className="container-fluid py-4 text-center">
                <Spinner animation="border" variant="primary" role="status">
                    <span className="visually-hidden">Carregando...</span>
                </Spinner>
                <p className="mt-2">Carregando dashboard...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="container-fluid py-4">
                <Alert variant="danger">
                    <i className="bi bi-exclamation-triangle me-2"></i>
                    {error}
                    <div className="mt-2">
                        <Button variant="outline-danger" size="sm" onClick={refetch}>Tentar Novamente</Button>
                    </div>
                </Alert>
            </div>
        )
    }

    return (
        <div className="container-fluid py-4">
            {/* Header */}
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
                                <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-1" />
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

            {/* Key Statistics */}
            <Row className="mb-4">
                <Col md={3}>
                    <StatCard
                        title="Total de Alarmes"
                        value={estatisticas.total_alarmes || 0}
                        icon="bi-bell-fill"
                        color="primary"
                        borderColor="primary"
                    />
                </Col>
                <Col md={3}>
                    <StatCard
                        title="Críticos"
                        value={estatisticas.criticos || 0}
                        subtitle="≥30 dias"
                        icon="bi-exclamation-triangle-fill"
                        color="danger"
                        borderColor="danger"
                    />
                </Col>
                <Col md={3}>
                    <StatCard
                        title="Alta Prioridade"
                        value={estatisticas.altos || 0}
                        subtitle="20-29 dias"
                        icon="bi-exclamation-circle-fill"
                        color="warning"
                        borderColor="warning"
                    />
                </Col>
                <Col md={3}>
                    <StatCard
                        title="Taxa de Resolução"
                        value={`${tendencias.taxa_resolucao || 0}%`}
                        subtitle="Esta semana"
                        icon="bi-check-circle-fill"
                        color="success"
                        borderColor="success"
                    />
                </Col>
            </Row>

            {/* Charts */}
            <Row className="mb-4">
                <Col md={6}>
                    <ChartCard title="Distribuição por Tipo" icon="bi-pie-chart">
                        {alarmesPorTipo.length > 0 ? (
                            <Doughnut data={dadosGraficoPizza} options={opcoesGrafico} />
                        ) : (
                            <div className="text-center text-muted py-5">
                                <i className="bi bi-info-circle fs-1 mb-3"></i>
                                <p>Nenhum alarme ativo</p>
                            </div>
                        )}
                    </ChartCard>
                </Col>
                <Col md={6}>
                    <ChartCard title="Tempo Médio por Tipo" icon="bi-bar-chart">
                        <Bar data={dadosGraficoBarras} options={opcoesGrafico} />
                    </ChartCard>
                </Col>
            </Row>

            {/* Filters */}
            <FilterSection filters={filtros} setFilter={handleFilterChange} />

            {/* Alarms List */}
            <Card>
                <Card.Header className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">
                        <i className="bi bi-list-ul me-2"></i>
                        Lista de Alarmes ({alarmesFiltrados.length})
                    </h5>
                    <Button variant="outline-primary" size="sm" onClick={refetch}>
                        <i className="bi bi-arrow-clockwise me-1"></i>
                        Atualizar
                    </Button>
                </Card.Header>
                <Card.Body>
                    {paginatedAlarmes.length === 0 ? (
                        <Alert variant="info" className="text-center">
                            <i className="bi bi-info-circle me-2"></i>
                            Nenhum alarme encontrado com os filtros selecionados.
                        </Alert>
                    ) : (
                        <>
                            <Row>
                                {paginatedAlarmes.map((alarme) => (
                                    <AlarmeCard
                                        key={alarme.id}
                                        alarme={alarme}
                                        onMarkAsSeen={marcarComoVisto}
                                        onViewDetails={verDetalhes}
                                    />
                                ))}
                            </Row>

                            {/* Controles de Paginação */}
                            {totalPages > 1 && (
                                <div className="d-flex justify-content-center mt-4">
                                    <Pagination>
                                        <Pagination.Prev onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} />
                                        {[...Array(totalPages).keys()].map(number => (
                                            <Pagination.Item key={number + 1} active={number + 1 === currentPage} onClick={() => handlePageChange(number + 1)}>
                                                {number + 1}
                                            </Pagination.Item>
                                        ))}
                                        <Pagination.Next onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} />
                                    </Pagination>
                                </div>
                            )}
                        </>
                    )}
                </Card.Body>
            </Card>

            {/* Detailed Breakdown */}
            <Row className="mb-4 mt-4">
                <Col md={4}>
                    <DetailCard
                        title="Sem Orçamento"
                        icon="bi-clipboard-x"
                        quantity={estatisticas.sem_orcamento || 0}
                        avgTime={tendencias.tempo_medio_sem_orcamento || 0}
                        progressValue={((estatisticas.sem_orcamento || 0) / (estatisticas.total_alarmes || 1)) * 100}
                        description="Reparações há mais de 15 dias sem orçamento definido"
                        color="danger"
                    />
                </Col>
                <Col md={4}>
                    <DetailCard
                        title="Orçamento Aceito"
                        icon="bi-check-circle"
                        quantity={estatisticas.orcamento_aceito || 0}
                        avgTime={tendencias.tempo_medio_aceito || 0}
                        progressValue={((estatisticas.orcamento_aceito || 0) / (estatisticas.total_alarmes || 1)) * 100}
                        description="Orçamentos aceitos há mais de 30 dias sem conclusão"
                        color="warning"
                    />
                </Col>
                <Col md={4}>
                    <DetailCard
                        title="Orçamento Recusado"
                        icon="bi-x-circle"
                        quantity={estatisticas.orcamento_recusado || 0}
                        avgTime={tendencias.tempo_medio_recusado || 0}
                        progressValue={((estatisticas.orcamento_recusado || 0) / (estatisticas.total_alarmes || 1)) * 100}
                        description="Orçamentos recusados há mais de 15 dias - verificar equipamentos"
                        color="info"
                    />
                </Col>
            </Row>

            {/* Performance & Recommendations */}
            <Row>
                <Col md={6}>
                    <Card className="border-success h-100">
                        <Card.Header className="bg-success text-white">
                            <h6 className="mb-0">
                                <i className="bi bi-graph-up-arrow me-2"></i>
                                Performance da Semana
                            </h6>
                        </Card.Header>
                        <Card.Body>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <span>Reparações Resolvidas:</span>
                                <Badge bg="success" className="fs-6">{tendencias.resolvidos_semana || 0}</Badge>
                            </div>
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <span>Total de Reparações:</span>
                                <Badge bg="secondary" className="fs-6">{tendencias.total_semana || 0}</Badge>
                            </div>
                            <div className="d-flex justify-content-between align-items-center">
                                <span>Taxa de Resolução:</span>
                                <Badge bg="primary" className="fs-6">{tendencias.taxa_resolucao || 0}%</Badge>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col md={6}>
                    <Card className="border-primary h-100">
                        <Card.Header className="bg-primary text-white">
                            <h6 className="mb-0">
                                <i className="bi bi-lightbulb me-2"></i>
                                Recomendações
                            </h6>
                        </Card.Header>
                        <Card.Body>
                            {estatisticas.criticos > 0 && (
                                <Alert variant="danger" className="mb-2 py-2">
                                    <small><i className="bi bi-exclamation-triangle me-1"></i> {estatisticas.criticos} alarmes críticos precisam de atenção imediata</small>
                                </Alert>
                            )}
                            {estatisticas.sem_orcamento > 5 && (
                                <Alert variant="warning" className="mb-2 py-2">
                                    <small><i className="bi bi-clipboard-x me-1"></i> Muitas reparações sem orçamento - revisar processo</small>
                                </Alert>
                            )}
                            {tendencias.taxa_resolucao < 70 && (
                                <Alert variant="info" className="mb-2 py-2">
                                    <small><i className="bi bi-graph-down me-1"></i> Taxa de resolução baixa - otimizar fluxo de trabalho</small>
                                </Alert>
                            )}
                            {estatisticas.total_alarmes === 0 && (
                                <Alert variant="success" className="mb-0 py-2">
                                    <small><i className="bi bi-check-circle me-1"></i> Excelente! Nenhum alarme ativo no momento</small>
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