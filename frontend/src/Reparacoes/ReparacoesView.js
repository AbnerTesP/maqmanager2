"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import axios from "axios"
import DataTable from "react-data-table-component"
import { useNavigate, useParams } from "react-router-dom"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

// Constantes
const API_BASE_URL = "http://localhost:8082"
const AXIOS_TIMEOUT = 10000

function ReparacoesView() {
    // Estados principais
    const [view, setView] = useState("list") // 'list' ou 'detail'
    const [reparacoes, setReparacoes] = useState([])
    const [reparacao, setReparacao] = useState(null)
    const [pecas, setPecas] = useState([])

    // Estados de controle
    const [loading, setLoading] = useState(true)
    const [loadingPecas, setLoadingPecas] = useState(false)
    const [error, setError] = useState("")

    // Estados de filtros (para lista)
    const [searchTerm, setSearchTerm] = useState("")
    const [filterStatus, setFilterStatus] = useState("all")

    // Hooks
    const navigate = useNavigate()
    const { id } = useParams()

    // Configuração do axios
    const axiosConfig = useMemo(
        () => ({
            timeout: AXIOS_TIMEOUT,
            headers: { "Content-Type": "application/json" },
        }),
        [],
    )

    // Determinar view baseado na URL
    useEffect(() => {
        if (id && !isNaN(id)) {
            setView("detail")
            fetchReparacao(id)
        } else {
            setView("list")
            fetchReparacoes()
        }
    }, [id])

    // Função para limpar erro
    const clearError = useCallback(() => {
        setError("")
    }, [])

    // Tratamento de erros melhorado
    const handleError = useCallback(
        (error, defaultMessage) => {
            console.error(defaultMessage, error)

            let errorMessage = defaultMessage

            if (error.code === "ECONNABORTED") {
                errorMessage = "Timeout: A operação demorou muito tempo."
            } else if (error.response?.status === 404) {
                errorMessage = view === "detail" ? "Reparação não encontrada." : "Nenhuma reparação encontrada."
            } else if (error.response?.status >= 500) {
                errorMessage = "Erro interno do servidor. Tente novamente mais tarde."
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message
            } else if (!navigator.onLine) {
                errorMessage = "Sem conexão com a internet."
            }

            setError(errorMessage)
            setTimeout(clearError, 8000)
        },
        [clearError, view],
    )

    // ==================== FUNÇÕES DE API ====================

    // Buscar lista de reparações
    const fetchReparacoes = useCallback(async () => {
        setLoading(true)
        setError("")

        try {
            const response = await axios.get(`${API_BASE_URL}/reparacoes`, axiosConfig)
            setReparacoes(Array.isArray(response.data) ? response.data : [])
        } catch (error) {
            handleError(error, "Erro ao carregar as reparações")
            setReparacoes([])
        } finally {
            setLoading(false)
        }
    }, [axiosConfig, handleError])

    // Buscar reparação específica
    const fetchReparacao = useCallback(
        async (reparacaoId) => {
            if (!reparacaoId || isNaN(reparacaoId)) {
                setError("ID da reparação inválido")
                setLoading(false)
                return
            }

            setLoading(true)
            setError("")

            try {
                const response = await axios.get(`${API_BASE_URL}/reparacoes/${reparacaoId}`, axiosConfig)

                if (response.data) {
                    setReparacao(response.data)
                    console.log("Dados da reparação carregados:", response.data)
                    await fetchPecasReparacao(reparacaoId)
                } else {
                    setError("Dados da reparação não encontrados")
                }
            } catch (error) {
                handleError(error, "Erro ao carregar detalhes da reparação")
            } finally {
                setLoading(false)
            }
        },
        [axiosConfig, handleError],
    )

    // Buscar peças da reparação
    const fetchPecasReparacao = useCallback(
        async (reparacaoId) => {
            setLoadingPecas(true)

            try {
                const response = await axios.get(`${API_BASE_URL}/reparacoes/${reparacaoId}/pecas`, axiosConfig)
                setPecas(Array.isArray(response.data) ? response.data : [])
            } catch (error) {
                if (error.response?.status !== 404) {
                    handleError(error, "Erro ao carregar peças da reparação")
                }
                setPecas([])
            } finally {
                setLoadingPecas(false)
            }
        },
        [axiosConfig, handleError],
    )

    // ==================== FUNÇÕES DE NAVEGAÇÃO ====================

    const handleBackToList = useCallback(() => {
        setView("list")
        setReparacao(null)
        setPecas([])
        navigate("/reparacoes")
    }, [navigate])

    const handleViewDetail = useCallback(
        (row) => {
            navigate(`/reparacoes/${row.id}`)
        },
        [navigate],
    )

    const handleEdit = useCallback(
        (row) => {
            const reparacaoId = row?.id || id
            navigate(`/reparacoes/edit/${reparacaoId}`)
        },
        [navigate, id],
    )

    const handleDelete = useCallback(
        async (row) => {
            const reparacaoId = row?.id || id
            const confirmMessage = `Tem certeza que deseja excluir a reparação #${reparacaoId}?\n\nEsta ação não pode ser desfeita.`

            if (!window.confirm(confirmMessage)) return

            try {
                setLoading(true)
                await axios.delete(`${API_BASE_URL}/reparacoes/${reparacaoId}`, axiosConfig)

                alert("Reparação excluída com sucesso!")

                if (view === "detail") {
                    handleBackToList()
                } else {
                    fetchReparacoes()
                }
            } catch (error) {
                handleError(error, "Erro ao excluir a reparação")
            } finally {
                setLoading(false)
            }
        },
        [id, view, axiosConfig, handleError, handleBackToList, fetchReparacoes],
    )

    // ==================== FUNÇÕES UTILITÁRIAS ====================

    const formatDate = useCallback((dateString) => {
        if (!dateString) return "N/A"

        try {
            const date = new Date(dateString)
            if (isNaN(date.getTime())) return "Data inválida"

            return date.toLocaleDateString("pt-PT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
            })
        } catch {
            return "Data inválida"
        }
    }, [])

    const formatCurrency = useCallback((value) => {
        if (!value || isNaN(value)) return "0,00 €"
        return Number(value).toLocaleString("pt-PT", {
            style: "currency",
            currency: "EUR",
            minimumFractionDigits: 2,
        })
    }, [])

    const getStatus = useCallback((reparacao) => {
        if (!reparacao) return { text: "Desconhecido", class: "bg-secondary" }

        if (reparacao.estadoreparacao === "Sem reparação") {
            return { text: "Sem Reparação", class: "bg-danger" }
        }

        if (reparacao.datasaida) return { text: "Entregue", class: "bg-success" }
        if (reparacao.dataconclusao) return { text: "Pronta", class: "bg-info" }
        if (reparacao.dataentrega) return { text: "Em Andamento", class: "bg-warning text-dark" }

        return { text: "Pendente", class: "bg-secondary" }
    }, [])

    const getStatusBadge = useCallback(
        (reparacao) => {
            const status = getStatus(reparacao)
            return <span className={`badge ${status.class}`}>{status.text}</span>
        },
        [getStatus],
    )

    // ==================== FILTROS E ESTATÍSTICAS ====================

    const filteredReparacoes = useMemo(() => {
        return reparacoes.filter((reparacao) => {
            const matchesSearch =
                (reparacao.nomemaquina && reparacao.nomemaquina.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (reparacao.nomecentro && reparacao.nomecentro.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (reparacao.estadoreparacao && reparacao.estadoreparacao.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (reparacao.cliente_nome && reparacao.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase()))

            const matchesStatus = filterStatus === "all" || getStatus(reparacao).text.toLowerCase().includes(filterStatus)

            return matchesSearch && matchesStatus
        })
    }, [reparacoes, searchTerm, filterStatus, getStatus])

    const stats = useMemo(() => {
        return {
            total: reparacoes.length,
            andamento: reparacoes.filter((r) => getStatus(r).text === "Em Andamento").length,
            pronta: reparacoes.filter((r) => getStatus(r).text === "Pronta").length,
            entregue: reparacoes.filter((r) => getStatus(r).text === "Entregue").length,
            pendente: reparacoes.filter((r) => getStatus(r).text === "Pendente").length,
        }
    }, [reparacoes, getStatus])

    // ==================== CÁLCULOS FINANCEIROS (ORÇAMENTO) ====================

    const calcularTotais = useMemo(() => {
        if (view !== "detail" || !reparacao) return {}

        // Mão de obra geral da reparação
        const maoObraGeral = Number(reparacao.mao_obra || 0)

        // Calcular totais das peças
        const totalPecasSemMaoObra = pecas.reduce((total, peca) => total + (Number(peca.preco_total) || 0), 0)
        const totalMaoObraPecas = pecas.reduce((total, peca) => total + (Number(peca.mao_obra) || 0), 0)
        const totalPecasComMaoObra = totalPecasSemMaoObra + totalMaoObraPecas

        // Desconto (se houver)
        const desconto = Number(reparacao.desconto || 0)
        const tipoDesconto = reparacao.tipoDesconto || "percentual"

        let valorDesconto = 0
        const subtotal = maoObraGeral + totalPecasComMaoObra

        if (desconto > 0) {
            if (tipoDesconto === "percentual") {
                valorDesconto = (subtotal * desconto) / 100
            } else {
                valorDesconto = desconto
            }
        }

        const totalGeral = subtotal - valorDesconto
        const valorIva = Math.max(0, totalGeral) * 0.23
        const totalComIva = Math.max(0, totalGeral) + valorIva

        return {
            maoObraGeral,
            totalPecasSemMaoObra,
            totalMaoObraPecas,
            totalPecasComMaoObra,
            subtotal,
            desconto,
            tipoDesconto,
            valorDesconto,
            totalGeral: Math.max(0, totalGeral),
            totalComIva: Number(totalComIva.toFixed(2)), // Arredonda para 2 casas decimais
            valorIva: Number(valorIva.toFixed(2)), // Arredonda para 2 casas decimais
        }
    }, [view, reparacao, pecas])

    // ==================== COLUNAS DAS TABELAS ====================

    const reparacoesColumns = useMemo(
        () => [
            {
                name: "Ações",
                cell: (row) => (
                    <div className="d-flex gap-1">
                        <button onClick={() => handleViewDetail(row)} className="btn btn-outline-info btn-sm" title="Visualizar">
                            <i className="bi bi-eye"></i>
                        </button>
                        <button onClick={() => handleEdit(row)} className="btn btn-outline-primary btn-sm" title="Editar">
                            <i className="bi bi-pencil"></i>
                        </button>
                        <button onClick={() => handleDelete(row)} className="btn btn-outline-danger btn-sm" title="Deletar">
                            <i className="bi bi-trash"></i>
                        </button>
                    </div>
                ),
                ignoreRowClick: true,
                width: "140px",
            },
            {
                name: "Status",
                cell: (row) => getStatusBadge(row),
                sortable: true,
                width: "120px",
            },
            {
                name: "ID",
                selector: (row) => row.id,
                sortable: true,
                width: "70px",
            },
            {
                name: "Cliente",
                selector: (row) => row.cliente_nome || "N/A",
                sortable: true,
                wrap: true,
                width: "150px",
            },
            {
                name: "Máquina",
                selector: (row) => row.nomemaquina || "N/A",
                sortable: true,
                wrap: true,
            },
            {
                name: "Centro",
                selector: (row) => row.nomecentro || "N/A",
                sortable: true,
                wrap: true,
            },
            {
                name: "Data Entrada",
                selector: (row) => row.dataentrega,
                cell: (row) => formatDate(row.dataentrega),
                sortable: true,
                width: "130px",
            },
            {
                name: "Total",
                selector: (row) => row.totalGeral || 0,
                cell: (row) => <span className="fw-bold text-success">{formatCurrency(row.totalGeral)}</span>,
                sortable: true,
                width: "100px",
            },
            {
                name: "Estado Reparação",
                selector: (row) => row.estadoreparacao || "N/A",
                sortable: true,
                wrap: true,
            },
            {
                name: "Estado Orçamento",
                selector: (row) => row.estadoorcamento || "N/A",
                sortable: true,
                wrap: true,
            },
        ],
        [handleViewDetail, handleEdit, handleDelete, getStatusBadge, formatDate, formatCurrency],
    )

    const pecasColumns = useMemo(
        () => [
            {
                name: "Tipo de Peça",
                selector: (row) => row.tipopeca || "N/A",
                sortable: true,
                wrap: true,
                width: "180px",
            },
            {
                name: "Ref. Interna",
                selector: (row) => row.marca || "N/A",
                sortable: true,
                wrap: true,
                width: "180px",
            },
            {
                name: "Qtd",
                selector: (row) => row.quantidade || 1,
                sortable: true,
                width: "70px",
                cell: (row) => <span className="badge bg-info">{row.quantidade || 1}</span>,
            },
            {
                name: "Preço Unit.",
                selector: (row) => row.preco_unitario || 0,
                sortable: true,
                width: "100px",
                cell: (row) => <span className="fw-bold text-success">{formatCurrency(row.preco_unitario)}</span>,
            },
            {
                name: "Total",
                selector: (row) => Number(row.preco_total || 0) + Number(row.mao_obra || 0),
                sortable: true,
                width: "120px",
                cell: (row) => (
                    <span className="fw-bold text-primary">
                        {formatCurrency(Number(row.preco_total || 0) + Number(row.mao_obra || 0))}
                    </span>
                ),
            },
            {
                name: "Desconto",
                selector: (row) => {
                    if (row.tipo_desconto === "unitario") {
                        return row.desconto_unitario || 0
                    } else if (row.tipo_desconto === "percentual") {
                        return row.desconto_percentual || 0
                    }
                    return 0
                },
                sortable: true,
                width: "120px",
                cell: (row) => {
                    if (row.tipo_desconto === "unitario") {
                        return (
                            <span className="fw-bold text-primary">
                                -{formatCurrency(row.desconto_unitario || 0)} <small className="text-muted">(un.)</small>
                            </span>
                        )
                    } else if (row.tipo_desconto === "percentual") {
                        return (
                            <span className="fw-bold text-primary">
                                -{row.desconto_percentual || 0}% <small className="text-muted">(%)</small>
                            </span>
                        )
                    }
                    return <span className="text-muted">—</span>
                },
            },
            {
                name: "Observações",
                selector: (peca) => peca.observacao || "",
                cell: (peca) => (
                    <div className="text-wrap" style={{ maxWidth: "200px" }}>
                        {peca.observacao ? (
                            <small className="text-muted">
                                <i className="bi bi-chat-text me-1"></i>
                                {peca.observacao}
                            </small>
                        ) : (
                            <small className="text-muted fst-italic">Sem observações</small>
                        )}
                    </div>
                ),
                wrap: true,
                width: "220px",
            },
            {
                name: "Status",
                cell: (row) => (
                    <span className={`badge ${row.existe_no_sistema ? "bg-success" : "bg-warning text-dark"}`}>
                        <i className={`bi ${row.existe_no_sistema ? "bi-check-circle" : "bi-exclamation-circle"} me-1`}></i>
                        {row.existe_no_sistema ? "Disponível" : "Não Encontrada"}
                    </span>
                ),
                width: "130px",
            },
        ],
        [formatCurrency],
    )

    // ==================== HANDLERS DE EVENTOS ====================

    const handleSearch = useCallback((e) => {
        setSearchTerm(e.target.value)
    }, [])

    const handleStatusFilter = useCallback((e) => {
        setFilterStatus(e.target.value)
    }, [])

    const handleGerarPDF = useCallback(async () => {
        if (!reparacao) return

        try {
            const response = await axios.get(`${API_BASE_URL}/reparacoes/${reparacao.id}/pdf`, {
                responseType: "blob",
                ...axiosConfig,
            })

            // Criar URL do blob e fazer download
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement("a")
            link.href = url
            link.setAttribute("download", `orcamento_reparacao_${reparacao.id}.pdf`)
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
        } catch (error) {
            handleError(error, "Erro ao gerar PDF")
        }
    }, [reparacao, axiosConfig, handleError])

    const handleVisualizarPDF = useCallback(async () => {
        if (!reparacao) return

        try {
            const pdfUrl = `${API_BASE_URL}/reparacoes/${reparacao.id}/pdf`
            window.open(pdfUrl, "_blank")
        } catch (error) {
            handleError(error, "Erro ao visualizar PDF")
        }
    }, [reparacao, handleError])

    // ==================== ESTILOS CUSTOMIZADOS ====================

    const customStyles = {
        header: {
            style: {
                minHeight: "56px",
            },
        },
        headRow: {
            style: {
                borderTopStyle: "solid",
                borderTopWidth: "1px",
                borderTopColor: "#e3e6ea",
                backgroundColor: "#f8f9fa",
                fontWeight: "bold",
            },
        },
        cells: {
            style: {
                "&:not(:last-of-type)": {
                    borderRightStyle: "solid",
                    borderRightWidth: "1px",
                    borderRightColor: "#e3e6ea",
                },
                fontSize: "14px",
                textAlign: "left",
            },
        },
        rows: {
            style: {
                fontSize: "14px",
            },
        },
    }

    // ==================== COMPONENTES AUXILIARES ====================

    const ClienteInfo = useMemo(() => {
        if (view !== "detail" || !reparacao) return null

        const hasClienteData =
            reparacao?.cliente_nome ||
            reparacao?.cliente_numero ||
            reparacao?.cliente_morada ||
            reparacao?.cliente_telefone ||
            reparacao?.cliente_email ||
            reparacao?.cliente_nif

        if (!hasClienteData) return null

        return (
            <div className="card shadow-sm mb-4">
                <div className="card-header bg-info text-white">
                    <h5 className="mb-0">
                        <i className="bi bi-person-fill me-2"></i>
                        Dados do Cliente
                    </h5>
                </div>
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-6">
                            <div className="d-flex align-items-center">
                                <i className="bi bi-person text-muted me-2"></i>
                                <div>
                                    <small className="text-muted">Nome</small>
                                    <div className="fw-bold">{reparacao.cliente_nome || "N/A"}</div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="d-flex align-items-center">
                                <i className="bi bi-hash text-muted me-2"></i>
                                <div>
                                    <small className="text-muted">Nº Interno</small>
                                    <div className="fw-bold">{reparacao.cliente_numero || "N/A"}</div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="d-flex align-items-center">
                                <i className="bi bi-geo-alt text-muted me-2"></i>
                                <div>
                                    <small className="text-muted">Morada</small>
                                    <div className="fw-bold">{reparacao.cliente_morada || "N/A"}</div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="d-flex align-items-center">
                                <i className="bi bi-telephone text-muted me-2"></i>
                                <div>
                                    <small className="text-muted">Telefone</small>
                                    <div className="fw-bold">{reparacao.cliente_telefone || "N/A"}</div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="d-flex align-items-center">
                                <i className="bi bi-envelope text-muted me-2"></i>
                                <div>
                                    <small className="text-muted">Email</small>
                                    <div className="fw-bold">{reparacao.cliente_email || "N/A"}</div>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="d-flex align-items-center">
                                <i className="bi bi-card-text text-muted me-2"></i>
                                <div>
                                    <small className="text-muted">NIF</small>
                                    <div className="fw-bold">{reparacao.cliente_nif || "N/A"}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }, [view, reparacao])

    // ==================== ORÇAMENTO COMPLETO ====================
    const OrcamentoCompleto = useMemo(() => {
        if (view !== "detail" || !reparacao) return null

        const temValores = calcularTotais.totalGeral > 0 || calcularTotais.maoObraGeral > 0 || pecas.length > 0

        if (!temValores) return null

        return (
            <div className="card shadow-sm mb-4">
                <div className="card-header bg-success text-white">
                    <div className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0">
                            <i className="bi bi-receipt me-2"></i>
                            ORÇAMENTO DA REPARAÇÃO
                        </h5>
                        <div className="d-flex gap-2">
                            <button className="btn btn-light btn-sm" onClick={handleVisualizarPDF} title="Visualizar PDF">
                                <i className="bi bi-eye me-1"></i>
                                Visualizar
                            </button>
                            <button className="btn btn-warning btn-sm" onClick={handleGerarPDF} title="Baixar PDF">
                                <i className="bi bi-download me-1"></i>
                                Baixar PDF
                            </button>
                        </div>
                    </div>
                </div>
                <div className="card-body">
                    {/* Resumo Visual */}
                    <div className="row g-4 mb-4">
                        <div className="col-md-3">
                            <div className="text-center p-3 bg-light rounded">
                                <i className="bi bi-wrench-adjustable text-primary fs-2 mb-2"></i>
                                <h6 className="text-muted mb-1">Peças</h6>
                                <h4 className="text-primary mb-0">{formatCurrency(calcularTotais.totalPecasSemMaoObra)}</h4>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="text-center p-3 bg-light rounded">
                                <i className="bi bi-person-workspace text-info fs-2 mb-2"></i>
                                <h6 className="text-muted mb-1">Mão de Obra Geral</h6>
                                <h4 className="text-info mb-0">{formatCurrency(calcularTotais.maoObraGeral)}</h4>
                                <small className="text-muted">Diagnóstico + Montagem</small>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="text-center p-3 bg-light rounded">
                                <i className="bi bi-percent text-warning fs-2 mb-2"></i>
                                <h6 className="text-muted mb-1">Desconto</h6>
                                <h4 className="text-warning mb-0">
                                    {calcularTotais.desconto > 0 ? (
                                        <>
                                            {calcularTotais.tipoDesconto === "percentual"
                                                ? `${calcularTotais.desconto}%`
                                                : formatCurrency(calcularTotais.desconto)}
                                            <br />
                                            <small className="text-muted">-{formatCurrency(calcularTotais.valorDesconto)}</small>
                                        </>
                                    ) : (
                                        "—"
                                    )}
                                </h4>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="text-center p-3 bg-success text-white rounded">
                                <i className="bi bi-currency-euro fs-2 mb-2"></i>
                                <h6 className="mb-1">TOTAL GERAL</h6>
                                <h3 className="mb-0">{formatCurrency(calcularTotais.totalGeral)}</h3>
                            </div>
                        </div>
                        <div className="col-md-3">
                            <div className="text-center p-3 bg-dark text-white rounded">
                                <i className="bi bi-currency-euro fs-2 mb-2"></i>
                                <h6 className="mb-1">Total com IVA (23%)</h6>
                                <h3 className="mb-0">{formatCurrency(calcularTotais.totalComIva)}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Detalhamento do Orçamento */}
                    <div className="row">
                        <div className="col-md-8">
                            <h6 className="text-muted mb-3">
                                <i className="bi bi-list-ul me-2"></i>
                                Detalhamento dos Custos
                            </h6>
                            <div className="table-responsive">
                                <table className="table table-sm">
                                    <tbody>
                                        <tr>
                                            <td>
                                                <i className="bi bi-wrench-adjustable text-primary me-2"></i>
                                                Peças ({pecas.length} itens)
                                            </td>
                                            <td className="text-end fw-bold">
                                                {formatCurrency(calcularTotais.totalPecasSemMaoObra)}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td>
                                                <i className="bi bi-person-workspace text-info me-2"></i>
                                                Mão de Obra (Geral)
                                            </td>
                                            <td className="text-end fw-bold">
                                                {formatCurrency(calcularTotais.maoObraGeral)}
                                            </td>
                                        </tr>
                                        <tr className="border-top">
                                            <td className="fw-bold">Subtotal</td>
                                            <td className="text-end fw-bold">
                                                {formatCurrency(calcularTotais.subtotal)}
                                            </td>
                                        </tr>
                                        {calcularTotais.desconto > 0 && (
                                            <tr className="text-warning">
                                                <td>
                                                    <i className="bi bi-percent me-2"></i>
                                                    Desconto (
                                                    {calcularTotais.tipoDesconto === "percentual"
                                                        ? `${calcularTotais.desconto}%`
                                                        : "Valor fixo"}
                                                    )
                                                </td>
                                                <td className="text-end fw-bold">
                                                    -{formatCurrency(calcularTotais.valorDesconto)}
                                                </td>
                                            </tr>
                                        )}
                                        <tr className="border-top bg-success text-white">
                                            <td className="fw-bold fs-5">
                                                <i className="bi bi-currency-euro me-2"></i>
                                                Total Geral
                                            </td>
                                            <td className="text-end fw-bold fs-5">
                                                {formatCurrency(calcularTotais.totalGeral)}
                                            </td>
                                        </tr>
                                        <tr className="border-top bg-success text-white">
                                            <td className="fw-bold fs-5" colSpan={1}>
                                                <i className="bi bi-currency-euro me-2"></i>
                                                Total com IVA
                                            </td>
                                            <td className="text-end fw-bold  fs-5">
                                                {formatCurrency(calcularTotais.totalComIva)}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            {/* Descrição da Reparação */}
                            {reparacao?.descricao && (
                                <div className="mt-4">
                                    <h6 className="text-muted mb-2">
                                        <i className="bi bi-chat-left-text me-2"></i>
                                        Descrição da Reparação
                                    </h6>
                                    <div className="alert alert-secondary" style={{ whiteSpace: "pre-line" }}>
                                        {reparacao.descricao}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="col-md-4">
                            <h6 className="text-muted mb-3">
                                <i className="bi bi-info-circle me-2"></i>
                                Informações do Orçamento
                            </h6>
                            <div className="card bg-light">
                                <div className="card-body">
                                    <div className="mb-2">
                                        <small className="text-muted">Estado do Orçamento</small>
                                        <div>
                                            <span
                                                className={`badge ${reparacao.estadoorcamento?.toLowerCase().includes("aceite")
                                                    ? "bg-success"
                                                    : reparacao.estadoorcamento?.toLowerCase().includes("recusado")
                                                        ? "bg-danger"
                                                        : "bg-warning text-dark"
                                                    }`}
                                            >
                                                {reparacao.estadoorcamento || "Pendente"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <small className="text-muted">Data de Criação</small>
                                        <div className="fw-bold">{formatDate(reparacao.dataentrega)}</div>
                                    </div>
                                    <div className="mb-2">
                                        <small className="text-muted">Validade</small>
                                        <div className="fw-bold text-warning">30 dias</div>
                                    </div>
                                    <div>
                                        <small className="text-muted">Número da Reparação</small>
                                        <div className="fw-bold">#{reparacao.numreparacao || reparacao.id}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }, [view, reparacao, calcularTotais, pecas, formatCurrency, formatDate, handleVisualizarPDF, handleGerarPDF])

    // ==================== RENDERIZAÇÃO CONDICIONAL ====================

    // Estado de loading
    if (loading) {
        return (
            <div className="container mt-4">
                <div className="d-flex justify-content-center align-items-center" style={{ height: "400px" }}>
                    <div className="text-center">
                        <div className="spinner-border text-primary mb-3" role="status" style={{ width: "3rem", height: "3rem" }}>
                            <span className="visually-hidden">Carregando...</span>
                        </div>
                        <h5 className="text-muted">
                            {view === "detail" ? "Carregando detalhes da reparação..." : "Carregando reparações..."}
                        </h5>
                        <p className="text-muted">Por favor, aguarde</p>
                    </div>
                </div>
            </div>
        )
    }

    // Estado de erro
    if (error && ((view === "list" && reparacoes.length === 0) || (view === "detail" && !reparacao))) {
        return (
            <div className="container mt-4">
                <div className="alert alert-danger d-flex align-items-center" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-3 fs-4"></i>
                    <div className="flex-grow-1">
                        <h4 className="alert-heading">Erro ao Carregar {view === "detail" ? "Reparação" : "Reparações"}</h4>
                        <p className="mb-3">{error}</p>
                        <div className="d-flex gap-2">
                            <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={view === "detail" ? () => fetchReparacao(id) : fetchReparacoes}
                            >
                                <i className="bi bi-arrow-clockwise me-1"></i>
                                Tentar Novamente
                            </button>
                            {view === "detail" && (
                                <button className="btn btn-primary btn-sm" onClick={handleBackToList}>
                                    <i className="bi bi-arrow-left me-1"></i>
                                    Voltar à Lista
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ==================== RENDERIZAÇÃO PRINCIPAL ====================

    if (view === "detail") {
        // Reparação não encontrada
        if (!reparacao) {
            return (
                <div className="container mt-4">
                    <div className="alert alert-warning d-flex align-items-center" role="alert">
                        <i className="bi bi-exclamation-triangle-fill me-3 fs-4"></i>
                        <div className="flex-grow-1">
                            <h4 className="alert-heading">Reparação Não Encontrada</h4>
                            <p className="mb-3">A reparação solicitada não foi encontrada no sistema.</p>
                            <button className="btn btn-primary" onClick={handleBackToList}>
                                <i className="bi bi-arrow-left me-2"></i>
                                Voltar à Lista
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        const status = getStatus(reparacao)

        return (
            <div className="container mt-4">
                {/* Breadcrumb */}
                <nav aria-label="breadcrumb" className="mb-3">
                    <ol className="breadcrumb">
                        <li className="breadcrumb-item">
                            <button className="btn btn-link p-0 text-decoration-none" onClick={handleBackToList}>
                                Reparações
                            </button>
                        </li>
                        <li className="breadcrumb-item active" aria-current="page">
                            Reparação #{id}
                        </li>
                    </ol>
                </nav>

                {/* Cabeçalho */}
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <div>
                        <h2 className="mb-1">
                            <i className="bi bi-tools me-2"></i>
                            Reparação #{id}
                        </h2>
                        <p className="text-muted mb-0">
                            {reparacao.nomemaquina} - {formatDate(reparacao.dataentrega)}
                        </p>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-primary" onClick={handleBackToList}>
                            <i className="bi bi-arrow-left me-1"></i>
                            Voltar
                        </button>
                        <button className="btn btn-warning" onClick={() => handleEdit(reparacao)}>
                            <i className="bi bi-pencil me-1"></i>
                            Editar
                        </button>
                        <button className="btn btn-danger" onClick={() => handleDelete(reparacao)}>
                            <i className="bi bi-trash me-1"></i>
                            Excluir
                        </button>
                    </div>
                </div>

                {/* Alerta de erro */}
                {error && (
                    <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        {error}
                        <button type="button" className="btn-close" onClick={clearError} aria-label="Close"></button>
                    </div>
                )}

                {/* Informações do Cliente */}
                {ClienteInfo}

                {/* ORÇAMENTO COMPLETO - AQUI É ONDE APARECE O ORÇAMENTO */}
                {OrcamentoCompleto}

                {pecas.some((peca) => peca.observacao) && (
                    <div className="card shadow-sm mb-4">
                        <div className="card-header bg-info text-white">
                            <h5 className="mb-0">
                                <i className="bi bi-chat-text me-2"></i>
                                Observações das Peças
                            </h5>
                        </div>

                        
                        <div className="card-body">
                            {pecas
                                .filter((peca) => peca.observacao)
                                .map((peca, index) => (
                                    <div key={index} className="mb-3 p-3 bg-light rounded">
                                        <h6 className="text-primary mb-2">
                                            <i className="bi bi-wrench-adjustable me-1"></i>
                                            {peca.tipopeca} - {peca.marca}
                                        </h6>
                                        <p className="mb-0 text-muted">
                                            <i className="bi bi-chat-quote me-1"></i>
                                            {peca.observacao || "Sem observações"}
                                        </p>
                                    </div>
                                ))}
                        </div>
                    </div>
                )}

                {/* Detalhes da reparação */}
                <div className="card shadow-sm mb-4">
                    <div className="card-header bg-primary text-white">
                        <div className="d-flex justify-content-between align-items-center">
                            <h5 className="mb-0">
                                <i className="bi bi-info-circle me-2"></i>
                                Informações da Reparação
                            </h5>
                            <span className={`badge ${status.class} fs-6`}>{status.text}</span>
                        </div>
                    </div>
                    <div className="card-body">
                        <div className="row g-4">
                            <div className="col-md-6">
                                <div className="mb-3">
                                    <div className="d-flex align-items-center mb-2">
                                        <i className="bi bi-laptop text-primary me-2"></i>
                                        <h6 className="text-muted mb-0">Máquina</h6>
                                    </div>
                                    <h5 className="fw-bold">{reparacao.nomemaquina || "N/A"}</h5>
                                </div>

                                <div className="mb-3">
                                    <div className="d-flex align-items-center mb-2">
                                        <i className="bi bi-building text-primary me-2"></i>
                                        <h6 className="text-muted mb-0">Centro de Reparação</h6>
                                    </div>
                                    <h5 className="fw-bold">{reparacao.nomecentro || "N/A"}</h5>
                                </div>

                                <div className="mb-3">
                                    <div className="d-flex align-items-center mb-2">
                                        <i className="bi bi-hash text-primary me-2"></i>
                                        <h6 className="text-muted mb-0">Número da Reparação</h6>
                                    </div>
                                    <h5 className="fw-bold">{reparacao.numreparacao || "N/A"}</h5>
                                </div>
                            </div>

                            <div className="col-md-6">
                                <div className="mb-3">
                                    <div className="d-flex align-items-center mb-2">
                                        <i className="bi bi-cash-coin text-primary me-2"></i>
                                        <h6 className="text-muted mb-0">Estado do Orçamento</h6>
                                    </div>
                                    <span
                                        className={`badge ${reparacao.estadoorcamento?.toLowerCase().includes("aceite")
                                            ? "bg-success"
                                            : reparacao.estadoorcamento?.toLowerCase().includes("recusado")
                                                ? "bg-danger"
                                                : "bg-warning text-dark"
                                            } fs-6`}
                                    >
                                        {reparacao.estadoorcamento || "N/A"}
                                    </span>
                                </div>

                                <div className="mb-3">
                                    <div className="d-flex align-items-center mb-2">
                                        <i className="bi bi-wrench text-primary me-2"></i>
                                        <h6 className="text-muted mb-0">Estado da Reparação</h6>
                                    </div>
                                    <span className={`badge ${status.class} fs-6`}>{reparacao.estadoreparacao || "N/A"}</span>
                                </div>
                            </div>
                        </div>

                        <hr className="my-4" />

                        {/* Timeline de datas */}
                        <div className="row g-3">
                            <div className="col-md-4">
                                <div className="card bg-light border-0">
                                    <div className="card-body text-center py-4">
                                        <i className="bi bi-calendar-plus text-primary fs-1 mb-3"></i>
                                        <h6 className="text-muted mb-2">Data de Entrada</h6>
                                        <h5 className="fw-bold">{formatDate(reparacao.dataentrega)}</h5>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="card bg-light border-0">
                                    <div className="card-body text-center py-4">
                                        <i className="bi bi-calendar-check text-info fs-1 mb-3"></i>
                                        <h6 className="text-muted mb-2">Data de Conclusão</h6>
                                        <h5 className="fw-bold">{formatDate(reparacao.dataconclusao)}</h5>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="card bg-light border-0">
                                    <div className="card-body text-center py-4">
                                        <i className="bi bi-calendar-x text-success fs-1 mb-3"></i>
                                        <h6 className="text-muted mb-2">Data de Saída</h6>
                                        <h5 className="fw-bold">{formatDate(reparacao.datasaida)}</h5>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Peças da Reparação */}
                <div className="card shadow-sm">
                    <div className="card-header bg-primary text-white">
                        <div className="d-flex justify-content-between align-items-center">
                            <h5 className="mb-0">
                                <i className="bi bi-wrench-adjustable me-2"></i>
                                Peças da Reparação
                            </h5>
                            {pecas.length > 0 && (
                                <div className="d-flex align-items-center gap-3">
                                    <span className="badge bg-light text-primary">
                                        {pecas.length} {pecas.length === 1 ? "peça" : "peças"}
                                    </span>
                                    <span className="badge bg-warning text-dark">
                                        Total: {formatCurrency(calcularTotais.totalPecasComMaoObra)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="card-body">
                        {loadingPecas ? (
                            <div className="text-center py-5">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Carregando...</span>
                                </div>
                                <p className="mt-3 text-muted">Carregando peças...</p>
                            </div>
                        ) : pecas.length > 0 ? (
                            <DataTable
                                columns={pecasColumns}
                                data={pecas}
                                pagination
                                paginationPerPage={10}
                                paginationRowsPerPageOptions={[5, 10, 15, 20]}
                                highlightOnHover
                                responsive
                                striped
                                customStyles={customStyles}
                                noDataComponent={
                                    <div className="text-center py-4">
                                        <i className="bi bi-search text-muted fs-1"></i>
                                        <p className="mt-2 text-muted">Nenhuma peça encontrada</p>
                                    </div>
                                }
                            />
                        ) : (
                            <div className="text-center py-5">
                                <i className="bi bi-inbox text-muted" style={{ fontSize: "4rem" }}></i>
                                <h5 className="mt-3 text-muted">Nenhuma Peça Registrada</h5>
                                <p className="text-muted">Esta reparação não possui peças associadas.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // ==================== VIEW DE LISTA ====================

    return (
        <div className="container-fluid mt-4">
            <div className="row">
                <div className="col-12">
                    <div className="card shadow-sm">
                        <div className="card-header bg-primary text-white">
                            <div className="d-flex justify-content-between align-items-center">
                                <h4 className="mb-0">
                                    <i className="bi bi-tools me-2"></i>
                                    Lista de Reparações
                                </h4>
                                <button className="btn btn-light btn-sm" onClick={() => navigate("/reparacoes/new")}>
                                    <i className="bi bi-plus-circle me-1"></i>
                                    Nova Reparação
                                </button>
                            </div>
                        </div>

                        <div className="card-body">
                            {/* Alerta de erro */}
                            {error && (
                                <div className="alert alert-warning alert-dismissible fade show mb-4" role="alert">
                                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                    {error}
                                    <button type="button" className="btn-close" onClick={clearError} aria-label="Close"></button>
                                </div>
                            )}

                            {/* Estatísticas */}
                            <div className="row mb-4">
                                <div className="col-md-3 col-6 mb-2">
                                    <div className="card bg-warning text-dark">
                                        <div className="card-body text-center py-2">
                                            <h5 className="card-title mb-1">{stats.andamento}</h5>
                                            <p className="card-text small mb-0">Em Andamento</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-3 col-6 mb-2">
                                    <div className="card bg-info text-white">
                                        <div className="card-body text-center py-2">
                                            <h5 className="card-title mb-1">{stats.pronta}</h5>
                                            <p className="card-text small mb-0">Prontas</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-3 col-6 mb-2">
                                    <div className="card bg-success text-white">
                                        <div className="card-body text-center py-2">
                                            <h5 className="card-title mb-1">{stats.entregue}</h5>
                                            <p className="card-text small mb-0">Entregues</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-3 col-6 mb-2">
                                    <div className="card bg-primary text-white">
                                        <div className="card-body text-center py-2">
                                            <h5 className="card-title mb-1">{stats.total}</h5>
                                            <p className="card-text small mb-0">Total</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Filtros */}
                            <div className="row mb-3">
                                <div className="col-md-8 mb-2">
                                    <div className="input-group">
                                        <span className="input-group-text">
                                            <i className="bi bi-search"></i>
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control"
                                            placeholder="Pesquisar por máquina, centro, cliente ou estado da reparação..."
                                            value={searchTerm}
                                            onChange={handleSearch}
                                        />
                                    </div>
                                </div>
                                <div className="col-md-4 mb-2">
                                    <select className="form-select" value={filterStatus} onChange={handleStatusFilter}>
                                        <option value="all">Todos os Status</option>
                                        <option value="pendente">Pendente</option>
                                        <option value="andamento">Em Andamento</option>
                                        <option value="pronta">Pronta</option>
                                        <option value="entregue">Entregue</option>
                                    </select>
                                </div>
                            </div>

                            {/* Tabela */}
                            <div className="table-responsive">
                                <DataTable
                                    columns={reparacoesColumns}
                                    data={filteredReparacoes}
                                    pagination
                                    paginationPerPage={10}
                                    paginationRowsPerPageOptions={[5, 10, 15, 20]}
                                    highlightOnHover
                                    striped
                                    responsive
                                    customStyles={customStyles}
                                    noDataComponent={
                                        <div className="text-center py-4">
                                            <i className="bi bi-inbox display-4 text-muted"></i>
                                            <p className="mt-2 text-muted">
                                                {searchTerm || filterStatus !== "all"
                                                    ? "Nenhuma reparação encontrada com os filtros aplicados"
                                                    : "Nenhuma reparação cadastrada"}
                                            </p>
                                        </div>
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
        .card {
          border: none;
          border-radius: 10px;
        }

        .card-header {
          border-radius: 10px 10px 0 0 !important;
          border: none;
        }

        .badge {
          font-size: 0.75em;
          padding: 0.5em 0.75em;
          border-radius: 20px;
        }

        .btn-outline-primary:hover,
        .btn-outline-danger:hover,
        .btn-outline-info:hover {
          transform: translateY(-1px);
          transition: all 0.2s ease;
        }

        .input-group-text {
          background-color: #f8f9fa;
          border-right: none;
        }

        .form-control:focus {
          border-color: #0d6efd;
          box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
        }

        .table-responsive {
          border-radius: 8px;
          overflow: hidden;
        }

        .card:hover {
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1) !important;
          transition: box-shadow 0.3s ease;
        }

        @media (max-width: 768px) {
          .card-header h4 {
            font-size: 1.1rem;
          }

          .btn-sm {
            padding: 0.25rem 0.5rem;
            font-size: 0.75rem;
          }
        }
      `}</style>
        </div>
    )
}

export default ReparacoesView