"use client"

import { useState, useEffect } from "react"
import { Card, Row, Col, Badge, ProgressBar, Alert, Spinner } from "react-bootstrap"
import axios from "axios"

function AlarmesDashboard() {
    const [estatisticas, setEstatisticas] = useState({})
    const [alarmesPorTipo, setAlarmesPorTipo] = useState([])
    const [tendencias, setTendencias] = useState({})
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        carregarDashboard()
        // Atualizar a cada 2 minutos
        const interval = setInterval(carregarDashboard, 2 * 60 * 1000)
        return () => clearInterval(interval)
    }, [])

    const carregarDashboard = async () => {
        try {
            setLoading(true)

            // Carregar estatísticas gerais
            const statsResponse = await axios.get("http://localhost:8082/alarmes/estatisticas")
            setEstatisticas(statsResponse.data)

            // Carregar alarmes por tipo
            const tiposResponse = await axios.get("http://localhost:8082/alarmes/por-tipo")
            setAlarmesPorTipo(tiposResponse.data)

            // Carregar tendências
            const tendenciasResponse = await axios.get("http://localhost:8082/alarmes/tendencias")
            setTendencias(tendenciasResponse.data)

            setError(null)
        } catch (err) {
            console.error("Erro ao carregar dashboard:", err)
            setError("Erro ao carregar dados do dashboard")
        } finally {
            setLoading(false)
        }
    }

    const getPrioridadeColor = (prioridade) => {
        switch (prioridade?.toLowerCase()) {
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

    const getTipoInfo = (tipo) => {
        switch (tipo) {
            case "sem_orcamento":
                return {
                    label: "Sem Orçamento",
                    icon: "clipboard-x",
                    color: "warning",
                    descricao: "Reparações aguardando orçamento há 15+ dias",
                }
            case "orcamento_aceito":
                return {
                    label: "Orçamento Aceito",
                    icon: "check-circle",
                    color: "info",
                    descricao: "Reparações com orçamento aceito há 30+ dias",
                }
            case "orcamento_recusado":
                return {
                    label: "Orçamento Recusado",
                    icon: "x-circle",
                    color: "danger",
                    descricao: "Equipamentos com orçamento recusado há 15+ dias",
                }
            default:
                return {
                    label: tipo,
                    icon: "bell",
                    color: "secondary",
                    descricao: "Outros tipos de alarmes",
                }
        }
    }

    if (loading) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2">Carregando dashboard...</p>
            </div>
        )
    }

    if (error) {
        return (
            <Alert variant="danger">
                <i className="bi bi-exclamation-triangle me-2"></i>
                {error}
            </Alert>
        )
    }

    return (
        <div className="container-fluid py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h3>
                    <i className="bi bi-graph-up me-2 text-primary"></i>
                    Dashboard de Alarmes
                </h3>
                <Badge bg="secondary">Última atualização: {new Date().toLocaleTimeString("pt-PT")}</Badge>
            </div>

            {/* Estatísticas Principais */}
            <Row className="mb-4">
                <Col md={3}>
                    <Card className="text-center h-100 border-primary">
                        <Card.Body>
                            <div className="display-6 text-primary mb-2">
                                <i className="bi bi-bell-fill"></i>
                            </div>
                            <h2 className="text-primary mb-1">{estatisticas.total_alarmes || 0}</h2>
                            <p className="text-muted mb-0">Total de Alarmes</p>
                            {tendencias.total_variacao && (
                                <small className={`text-${tendencias.total_variacao > 0 ? "danger" : "success"}`}>
                                    <i className={`bi bi-arrow-${tendencias.total_variacao > 0 ? "up" : "down"}`}></i>
                                    {Math.abs(tendencias.total_variacao)} desde ontem
                                </small>
                            )}
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={3}>
                    <Card className="text-center h-100 border-danger">
                        <Card.Body>
                            <div className="display-6 text-danger mb-2">
                                <i className="bi bi-exclamation-triangle-fill"></i>
                            </div>
                            <h2 className="text-danger mb-1">{estatisticas.criticos || 0}</h2>
                            <p className="text-muted mb-0">Críticos</p>
                            <ProgressBar
                                variant="danger"
                                now={estatisticas.total_alarmes ? (estatisticas.criticos / estatisticas.total_alarmes) * 100 : 0}
                                className="mt-2"
                                style={{ height: "4px" }}
                            />
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={3}>
                    <Card className="text-center h-100 border-warning">
                        <Card.Body>
                            <div className="display-6 text-warning mb-2">
                                <i className="bi bi-exclamation-triangle"></i>
                            </div>
                            <h2 className="text-warning mb-1">{estatisticas.altos || 0}</h2>
                            <p className="text-muted mb-0">Alta Prioridade</p>
                            <ProgressBar
                                variant="warning"
                                now={estatisticas.total_alarmes ? (estatisticas.altos / estatisticas.total_alarmes) * 100 : 0}
                                className="mt-2"
                                style={{ height: "4px" }}
                            />
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={3}>
                    <Card className="text-center h-100 border-success">
                        <Card.Body>
                            <div className="display-6 text-success mb-2">
                                <i className="bi bi-eye-fill"></i>
                            </div>
                            <h2 className="text-success mb-1">{estatisticas.nao_vistos || 0}</h2>
                            <p className="text-muted mb-0">Não Vistos</p>
                            <ProgressBar
                                variant="success"
                                now={
                                    estatisticas.total_alarmes
                                        ? ((estatisticas.total_alarmes - estatisticas.nao_vistos) / estatisticas.total_alarmes) * 100
                                        : 0
                                }
                                className="mt-2"
                                style={{ height: "4px" }}
                            />
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Alarmes por Tipo */}
            <Row className="mb-4">
                <Col md={8}>
                    <Card>
                        <Card.Header>
                            <h5 className="mb-0">
                                <i className="bi bi-pie-chart me-2"></i>
                                Distribuição por Tipo de Alarme
                            </h5>
                        </Card.Header>
                        <Card.Body>
                            {alarmesPorTipo.length === 0 ? (
                                <Alert variant="info" className="text-center mb-0">
                                    <i className="bi bi-info-circle me-2"></i>
                                    Nenhum alarme ativo no momento
                                </Alert>
                            ) : (
                                <Row>
                                    {alarmesPorTipo.map((tipo, index) => {
                                        const tipoInfo = getTipoInfo(tipo.tipo_alarme)
                                        const percentual = estatisticas.total_alarmes
                                            ? (tipo.quantidade / estatisticas.total_alarmes) * 100
                                            : 0

                                        return (
                                            <Col md={4} key={index} className="mb-3">
                                                <Card className={`border-${tipoInfo.color} h-100`}>
                                                    <Card.Body className="text-center">
                                                        <div className={`display-6 text-${tipoInfo.color} mb-2`}>
                                                            <i className={`bi bi-${tipoInfo.icon}`}></i>
                                                        </div>
                                                        <h4 className={`text-${tipoInfo.color} mb-1`}>{tipo.quantidade}</h4>
                                                        <h6 className="text-muted mb-2">{tipoInfo.label}</h6>
                                                        <ProgressBar
                                                            variant={tipoInfo.color}
                                                            now={percentual}
                                                            className="mb-2"
                                                            style={{ height: "6px" }}
                                                        />
                                                        <small className="text-muted">{percentual.toFixed(1)}% do total</small>
                                                        <div className="mt-2">
                                                            <small className="text-muted d-block">{tipoInfo.descricao}</small>
                                                        </div>
                                                    </Card.Body>
                                                </Card>
                                            </Col>
                                        )
                                    })}
                                </Row>
                            )}
                        </Card.Body>
                    </Card>
                </Col>

                <Col md={4}>
                    <Card>
                        <Card.Header>
                            <h5 className="mb-0">
                                <i className="bi bi-clock-history me-2"></i>
                                Tempo Médio de Resposta
                            </h5>
                        </Card.Header>
                        <Card.Body>
                            <div className="mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <span className="text-muted">Sem Orçamento</span>
                                    <Badge bg="warning">{tendencias.tempo_medio_sem_orcamento || 0} dias</Badge>
                                </div>
                                <ProgressBar
                                    variant="warning"
                                    now={Math.min(((tendencias.tempo_medio_sem_orcamento || 0) / 30) * 100, 100)}
                                    style={{ height: "4px" }}
                                />
                            </div>

                            <div className="mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <span className="text-muted">Orç. Aceito</span>
                                    <Badge bg="info">{tendencias.tempo_medio_aceito || 0} dias</Badge>
                                </div>
                                <ProgressBar
                                    variant="info"
                                    now={Math.min(((tendencias.tempo_medio_aceito || 0) / 60) * 100, 100)}
                                    style={{ height: "4px" }}
                                />
                            </div>

                            <div className="mb-3">
                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <span className="text-muted">Orç. Recusado</span>
                                    <Badge bg="danger">{tendencias.tempo_medio_recusado || 0} dias</Badge>
                                </div>
                                <ProgressBar
                                    variant="danger"
                                    now={Math.min(((tendencias.tempo_medio_recusado || 0) / 45) * 100, 100)}
                                    style={{ height: "4px" }}
                                />
                            </div>

                            <hr />

                            <div className="text-center">
                                <h6 className="text-muted mb-1">Taxa de Resolução</h6>
                                <div className="display-6 text-success">{tendencias.taxa_resolucao || 0}%</div>
                                <small className="text-muted">Alarmes resolvidos esta semana</small>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {/* Alertas e Recomendações */}
            <Row>
                <Col>
                    <Card>
                        <Card.Header>
                            <h5 className="mb-0">
                                <i className="bi bi-lightbulb me-2"></i>
                                Alertas e Recomendações
                            </h5>
                        </Card.Header>
                        <Card.Body>
                            {estatisticas.criticos > 5 && (
                                <Alert variant="danger" className="mb-3">
                                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                    <strong>Atenção!</strong> Existem {estatisticas.criticos} alarmes críticos. Recomenda-se contactar os
                                    clientes urgentemente.
                                </Alert>
                            )}

                            {tendencias.tempo_medio_sem_orcamento > 25 && (
                                <Alert variant="warning" className="mb-3">
                                    <i className="bi bi-clock me-2"></i>
                                    <strong>Tempo elevado!</strong> O tempo médio para criar orçamentos está em{" "}
                                    {tendencias.tempo_medio_sem_orcamento} dias. Considere otimizar o processo de orçamentação.
                                </Alert>
                            )}

                            {estatisticas.nao_vistos > 10 && (
                                <Alert variant="info" className="mb-3">
                                    <i className="bi bi-eye-slash me-2"></i>
                                    <strong>Muitos alarmes não vistos!</strong> Existem {estatisticas.nao_vistos} alarmes por verificar.
                                    Recomenda-se uma revisão regular dos alarmes.
                                </Alert>
                            )}

                            {(estatisticas.total_alarmes || 0) === 0 && (
                                <Alert variant="success" className="mb-0">
                                    <i className="bi bi-check-circle-fill me-2"></i>
                                    <strong>Excelente!</strong> Não existem alarmes ativos no momento. Todas as reparações estão dentro
                                    dos prazos estabelecidos.
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
