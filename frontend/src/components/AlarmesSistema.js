"use client"

import { useState, useEffect } from "react"

const AlarmesSistema = () => {
    const [alarmes, setAlarmes] = useState([])
    const [stats, setStats] = useState({})
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [selectedAlarme, setSelectedAlarme] = useState(null)
    const [showAllAlarmes, setShowAllAlarmes] = useState(false)
    const [filtroAtivo, setFiltroAtivo] = useState("todos") // todos, criticos, altos, medios

    // Buscar alarmes
    const fetchAlarmes = async () => {
        try {
            const [alarmesRes, statsRes] = await Promise.all([
                fetch("http://localhost:8082/alarmes/todos"),
                fetch("http://localhost:8082/alarmes/estatisticas"),
            ])

            const alarmesData = await alarmesRes.json()
            const statsData = await statsRes.json()

            setAlarmes(alarmesData)
            setStats(statsData)
        } catch (error) {
            console.error("Erro ao buscar alarmes:", error)
        } finally {
            setLoading(false)
        }
    }

    // Marcar alarme como visto
    const marcarComoVisto = async (alarmeId, tipoAlarme) => {
        try {
            await fetch(`http://localhost:8082/alarmes/marcar-visto/${alarmeId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tipo_alarme: tipoAlarme }),
            })

            fetchAlarmes() // Recarregar dados
            setShowModal(false)
        } catch (error) {
            console.error("Erro ao marcar alarme:", error)
        }
    }

    useEffect(() => {
        fetchAlarmes()
        const interval = setInterval(fetchAlarmes, 300000) // 5 min
        return () => clearInterval(interval)
    }, [])

    const getPrioridadeColor = (prioridade) => {
        switch (prioridade) {
            case "Crítico":
                return "#dc2626"
            case "Alto":
                return "#ea580c"
            case "Médio":
                return "#ca8a04"
            default:
                return "#16a34a"
        }
    }

    const getTipoEmoji = (tipo) => {
        switch (tipo) {
            case "sem_orcamento":
                return "📋"
            case "orcamento_aceito":
                return "✅"
            case "orcamento_recusado":
                return "❌"
            default:
                return "⚠️"
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

    // Filtrar alarmes baseado no filtro ativo
    const alarmesFiltrados = alarmes.filter((alarme) => {
        if (filtroAtivo === "todos") return true
        if (filtroAtivo === "criticos") return alarme.prioridade === "Crítico"
        if (filtroAtivo === "altos") return alarme.prioridade === "Alto"
        if (filtroAtivo === "medios") return alarme.prioridade === "Médio"
        return true
    })

    // Determinar quantos alarmes mostrar
    const alarmesParaMostrar = showAllAlarmes ? alarmesFiltrados : alarmesFiltrados.slice(0, 5)

    if (loading) {
        return <div style={{ padding: 10, fontSize: 14 }}>🔄 Carregando alarmes...</div>
    }

    return (
        <div style={{
            fontFamily: "system-ui, sans-serif",
            background: "#f1f5f9",
            borderRadius: 10,
            padding: 20,
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            maxWidth: 600,
            margin: "0 auto",
        }}>
            <header style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    🚨 Alarmes do Sistema
                    <span style={{
                        background: "#e2e8f0",
                        padding: "2px 6px",
                        borderRadius: 8,
                        fontSize: 12,
                    }}>{alarmesFiltrados.length}</span>
                </h2>
            </header>

            {/* Filtros de Prioridade */}
            <div style={{
                display: "flex",
                gap: 6,
                marginBottom: 16,
                flexWrap: "wrap",
            }}>
                <button
                    onClick={() => setFiltroAtivo("todos")}
                    style={{
                        background: filtroAtivo === "todos" ? "rgba(0,0,0,0.1)" : "transparent",
                        border: "1px solid #d1d5db",
                        padding: "4px 8px",
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: "pointer",
                        transition: "all 0.2s",
                    }}
                >
                    Todos ({alarmes.length})
                </button>
                <button
                    onClick={() => setFiltroAtivo("criticos")}
                    style={{
                        background: filtroAtivo === "criticos" ? "rgba(220, 38, 38, 0.1)" : "transparent",
                        border: "1px solid rgba(220, 38, 38, 0.3)",
                        color: filtroAtivo === "criticos" ? "#dc2626" : "inherit",
                        padding: "4px 8px",
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: "pointer",
                        transition: "all 0.2s",
                    }}
                >
                    Críticos ({stats.criticos || 0})
                </button>
                <button
                    onClick={() => setFiltroAtivo("altos")}
                    style={{
                        background: filtroAtivo === "altos" ? "rgba(234, 88, 12, 0.1)" : "transparent",
                        border: "1px solid rgba(234, 88, 12, 0.3)",
                        color: filtroAtivo === "altos" ? "#ea580c" : "inherit",
                        padding: "4px 8px",
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: "pointer",
                        transition: "all 0.2s",
                    }}
                >
                    Altos ({stats.altos || 0})
                </button>
                <button
                    onClick={() => setFiltroAtivo("medios")}
                    style={{
                        background: filtroAtivo === "medios" ? "rgba(202, 138, 4, 0.1)" : "transparent",
                        border: "1px solid rgba(202, 138, 4, 0.3)",
                        color: filtroAtivo === "medios" ? "#ca8a04" : "inherit",
                        padding: "4px 8px",
                        borderRadius: 6,
                        fontSize: 12,
                        cursor: "pointer",
                        transition: "all 0.2s",
                    }}
                >
                    Médios ({stats.medios || 0})
                </button>
            </div>

            {/* Stats */}
            <section style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 10,
                marginBottom: 20,
            }}>
                <div style={{
                    background: "rgba(220, 38, 38, 0.1)",
                    padding: 10,
                    borderRadius: 6,
                    textAlign: "center",
                    border: "1px solid rgba(220, 38, 38, 0.2)",
                }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#dc2626" }}>{stats.criticos || 0}</div>
                    <div style={{ fontSize: 12 }}>Crítico</div>
                </div>

                <div style={{
                    background: "rgba(234, 88, 12, 0.1)",
                    padding: 10,
                    borderRadius: 6,
                    textAlign: "center",
                    border: "1px solid rgba(234, 88, 12, 0.2)",
                }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#ea580c" }}>{stats.altos || 0}</div>
                    <div style={{ fontSize: 12 }}>Alto</div>
                </div>

                <div style={{
                    background: "rgba(202, 138, 4, 0.1)",
                    padding: 10,
                    borderRadius: 6,
                    textAlign: "center",
                    border: "1px solid rgba(202, 138, 4, 0.2)",
                }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#ca8a04" }}>{stats.medios || 0}</div>
                    <div style={{ fontSize: 12 }}>Médio</div>
                </div>

                <div style={{
                    background: "rgba(22, 163, 74, 0.1)",
                    padding: 10,
                    borderRadius: 6,
                    textAlign: "center",
                    border: "1px solid rgba(22, 163, 74, 0.2)",
                }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#16a34a" }}>{stats.total_alarmes || 0}</div>
                    <div style={{ fontSize: 12 }}>Total</div>
                </div>
            </section>

            {/* Lista de Alarmes */}
            <section style={{ maxHeight: showAllAlarmes ? "400px" : "300px", overflowY: "auto" }}>
                {alarmesFiltrados.length === 0 ? (
                    <p style={{ fontSize: 14, textAlign: "center", color: "#64748b", padding: 20 }}>
                        {filtroAtivo === "todos" ? "✅ Nenhum alarme ativo" : `Nenhum alarme ${filtroAtivo}`}
                    </p>
                ) : (
                    alarmesParaMostrar.map((alarme) => (
                        <div
                            key={alarme.id}
                            onClick={() => {
                                setSelectedAlarme(alarme)
                                setShowModal(true)
                            }}
                            style={{
                                background: "#fff",
                                borderLeft: `4px solid ${getPrioridadeColor(alarme.prioridade)}`,
                                borderRadius: 6,
                                padding: 10,
                                marginBottom: 10,
                                cursor: "pointer",
                                transition: "0.2s",
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#f8fafc"
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#fff"
                            }}
                        >
                            <span style={{ fontSize: 20 }}>{getTipoEmoji(alarme.tipo_alarme)}</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{alarme.nomemaquina}</div>
                                <div style={{ fontSize: 12, color: "#64748b" }}>
                                    {alarme.cliente_nome} • {alarme.dias_alerta}d
                                </div>
                            </div>
                            <span style={{
                                background: getPrioridadeColor(alarme.prioridade),
                                color: "white",
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 8,
                                fontWeight: 600,
                            }}>
                                {alarme.prioridade}
                            </span>
                        </div>
                    ))
                )}
            </section>

            {/* Controles de Visualização */}
            {alarmesFiltrados.length > 5 && (
                <div style={{ textAlign: "center", marginTop: 10 }}>
                    <button
                        onClick={() => setShowAllAlarmes(!showAllAlarmes)}
                        style={{
                            background: "#e0f2fe",
                            border: "1px solid #bae6fd",
                            color: "#0369a1",
                            padding: "6px 12px",
                            borderRadius: 6,
                            fontSize: 12,
                            cursor: "pointer",
                            transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = "#bae6fd"
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = "#e0f2fe"
                        }}
                    >
                        {showAllAlarmes ? (
                            <>
                                <span style={{ marginRight: 4 }}>▲</span>
                                Mostrar menos
                            </>
                        ) : (
                            <>
                                <span style={{ marginRight: 4 }}>▼</span>
                                Ver todos ({alarmesFiltrados.length})
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Footer com informações adicionais */}
            <div style={{
                textAlign: "center",
                marginTop: 16,
                fontSize: 12,
                color: "#94a3b8",
                borderTop: "1px solid #e2e8f0",
                paddingTop: 10,
            }}>
                Atualizado: {new Date().toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
            </div>

            {/* Modal de Detalhes */}
            {showModal && selectedAlarme && (
                <div style={{
                    position: "fixed",
                    top: 0, left: 0, right: 0, bottom: 0,
                    background: "rgba(0,0,0,0.5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1000,
                }}>
                    <div style={{
                        background: "white",
                        borderRadius: 10,
                        padding: 20,
                        maxWidth: 500,
                        width: "90%",
                        maxHeight: "80vh",
                        overflow: "auto",
                    }}>
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 16,
                        }}>
                            <h3 style={{
                                margin: 0,
                                fontSize: 18,
                                color: "#1f2937",
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                            }}>
                                🚨 Detalhes do Alarme
                                <span style={{
                                    background: getPrioridadeColor(selectedAlarme.prioridade),
                                    color: "white",
                                    padding: "2px 8px",
                                    borderRadius: 12,
                                    fontSize: 12,
                                    fontWeight: "600",
                                }}>
                                    {selectedAlarme.prioridade}
                                </span>
                            </h3>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    fontSize: 18,
                                    cursor: "pointer",
                                    padding: 4,
                                    color: "#6b7280",
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            {/* Informações principais */}
                            <div style={{
                                background: "#f8fafc",
                                padding: 12,
                                borderRadius: 6,
                                marginBottom: 12,
                                border: `2px solid ${getPrioridadeColor(selectedAlarme.prioridade)}20`,
                            }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 14 }}>
                                    <div>
                                        <strong>Equipamento:</strong>
                                        <div>{selectedAlarme.nomemaquina}</div>
                                    </div>
                                    <div>
                                        <strong>Cliente:</strong>
                                        <div>{selectedAlarme.cliente_nome}</div>
                                    </div>
                                    <div>
                                        <strong>Tipo de Alarme:</strong>
                                        <div>
                                            {getTipoEmoji(selectedAlarme.tipo_alarme)} {getTipoLabel(selectedAlarme.tipo_alarme)}
                                        </div>
                                    </div>
                                    <div>
                                        <strong>Dias em atraso:</strong>
                                        <div style={{ color: getPrioridadeColor(selectedAlarme.prioridade), fontWeight: "bold" }}>
                                            {selectedAlarme.dias_alerta} dias
                                        </div>
                                    </div>
                                    <div>
                                        <strong>Data de Entrada:</strong>
                                        <div>{new Date(selectedAlarme.dataentrega).toLocaleDateString("pt-PT")}</div>
                                    </div>
                                    <div>
                                        <strong>Estado:</strong>
                                        <div>{selectedAlarme.estadoreparacao || "Em análise"}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Informações adicionais */}
                            {(selectedAlarme.numreparacao || selectedAlarme.estadoorcamento) && (
                                <div style={{
                                    background: "#f0f9ff",
                                    padding: 12,
                                    borderRadius: 6,
                                    marginBottom: 12,
                                    fontSize: 14,
                                }}>
                                    {selectedAlarme.numreparacao && (
                                        <div style={{ marginBottom: 4 }}>
                                            <strong>Nº Reparação:</strong> {selectedAlarme.numreparacao}
                                        </div>
                                    )}
                                    {selectedAlarme.estadoorcamento && (
                                        <div>
                                            <strong>Estado Orçamento:</strong> {selectedAlarme.estadoorcamento}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Descrição */}
                            {selectedAlarme.descricao && (
                                <div style={{
                                    background: "#fefce8",
                                    padding: 12,
                                    borderRadius: 6,
                                    marginBottom: 12,
                                    fontSize: 14,
                                }}>
                                    <strong>Descrição:</strong>
                                    <div style={{ marginTop: 4, lineHeight: 1.4 }}>{selectedAlarme.descricao}</div>
                                </div>
                            )}

                            {/* Contato do cliente */}
                            {(selectedAlarme.cliente_telefone || selectedAlarme.cliente_email) && (
                                <div style={{
                                    background: "#f0fdf4",
                                    padding: 12,
                                    borderRadius: 6,
                                    marginBottom: 12,
                                    fontSize: 14,
                                }}>
                                    <strong>Contato do Cliente:</strong>
                                    {selectedAlarme.cliente_telefone && (
                                        <div style={{ marginTop: 4 }}>📞 {selectedAlarme.cliente_telefone}</div>
                                    )}
                                    {selectedAlarme.cliente_email && (
                                        <div style={{ marginTop: 4 }}>✉️ {selectedAlarme.cliente_email}</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div style={{
                            display: "flex",
                            gap: 10,
                            justifyContent: "flex-end",
                        }}>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    padding: "8px 16px",
                                    border: "1px solid #d1d5db",
                                    background: "white",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    fontSize: 14,
                                }}
                            >
                                Fechar
                            </button>
                            {!selectedAlarme.visto && (
                                <button
                                    onClick={() => marcarComoVisto(selectedAlarme.id, selectedAlarme.tipo_alarme)}
                                    style={{
                                        padding: "8px 16px",
                                        border: "none",
                                        background: "#10b981",
                                        color: "white",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                        fontSize: 14,
                                    }}
                                >
                                    ✅ Marcar como Visto
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AlarmesSistema