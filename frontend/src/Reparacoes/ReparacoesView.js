"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import axios from "axios"
import DataTable from "react-data-table-component"
import { useNavigate, useParams } from "react-router-dom"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

// --- CONSTANTES E UTILITÁRIOS (Fora do componente para performance) ---
const API_BASE_URL = "http://localhost:8082"
const AXIOS_TIMEOUT = 10000

// Formatação de Moeda
const formatCurrency = (value) => {
    if (!value || isNaN(value)) return "0,00 €"
    return Number(value).toLocaleString("pt-PT", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
    })
}

// Formatação de Data
const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    try {
        const date = new Date(dateString)
        if (isNaN(date.getTime())) return "Data inválida"
        return date.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" })
    } catch {
        return "Data inválida"
    }
}

// Lógica de Status Centralizada
const getStatusInfo = (reparacao) => {
    if (!reparacao) return { text: "Desconhecido", class: "bg-secondary", id: "unknown" }

    const estRep = reparacao.estadoreparacao?.toLowerCase() || ""

    if (estRep.includes("sem reparação") || estRep.includes("sem reparacao"))
        return { text: "Sem Reparação", class: "bg-danger", id: "sem_reparacao" }

    if (reparacao.datasaida) return { text: "Entregue", class: "bg-success", id: "entregue" }
    if (reparacao.dataconclusao) return { text: "Pronta", class: "bg-info", id: "pronta" }
    if (reparacao.dataentrega) return { text: "Em Andamento", class: "bg-warning text-dark", id: "andamento" }

    return { text: "Pendente", class: "bg-secondary", id: "pendente" }
}

// Estilos da Tabela
const tableCustomStyles = {
    header: { style: { minHeight: "56px" } },
    headRow: { style: { borderTop: "1px solid #e3e6ea", backgroundColor: "#f8f9fa", fontWeight: "bold" } },
    cells: { style: { borderRight: "1px solid #e3e6ea", fontSize: "14px" } },
}

function ReparacoesView() {
    // --- STATES ---
    const [view, setView] = useState("list") // 'list' | 'detail'
    const [reparacoes, setReparacoes] = useState([])
    const [reparacao, setReparacao] = useState(null)
    const [pecas, setPecas] = useState([])

    // UI States
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
    const [searchTerm, setSearchTerm] = useState("")
    const [filterStatus, setFilterStatus] = useState("all")

    // Hooks
    const navigate = useNavigate()
    const { id } = useParams()

    // Axios Config
    const axiosConfig = useMemo(() => ({
        timeout: AXIOS_TIMEOUT,
        headers: { "Content-Type": "application/json" },
    }), [])

    // --- EFEITOS ---

    // Roteamento e Carregamento Inicial
    useEffect(() => {
        if (id && !isNaN(id)) {
            setView("detail")
            fetchDetalhesReparacao(id)
        } else {
            setView("list")
            fetchListaReparacoes()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    // --- DATA FETCHING OTIMIZADO ---

    const fetchListaReparacoes = async () => {
        setLoading(true)
        setError("")
        try {
            const response = await axios.get(`${API_BASE_URL}/reparacoes`, axiosConfig)
            setReparacoes(Array.isArray(response.data) ? response.data : [])
        } catch (err) {
            handleError(err, "Erro ao carregar lista de reparações")
        } finally {
            setLoading(false)
        }
    }

    // Fetch Paralelo (Reparação + Peças)
    const fetchDetalhesReparacao = async (reparacaoId) => {
        setLoading(true)
        setError("")
        try {
            const [repRes, pecasRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/reparacoes/${reparacaoId}`, axiosConfig),
                axios.get(`${API_BASE_URL}/reparacoes/${reparacaoId}/pecas`, axiosConfig).catch(() => ({ data: [] })) // Falha nas peças não quebra tudo
            ])

            if (repRes.data) {
                setReparacao(repRes.data)
                setPecas(Array.isArray(pecasRes.data) ? pecasRes.data : [])
            } else {
                setError("Reparação não encontrada")
            }
        } catch (err) {
            handleError(err, "Erro ao carregar detalhes")
        } finally {
            setLoading(false)
        }
    }

    const handleError = (err, defaultMsg) => {
        console.error(defaultMsg, err)
        const msg = err.response?.data?.message || defaultMsg
        setError(msg)
    }

    // --- ACTIONS ---

    const handleDelete = useCallback(async (row) => {
        const targetId = row?.id || id
        if (!window.confirm(`Tem certeza que deseja excluir a reparação #${targetId}?`)) return

        try {
            await axios.delete(`${API_BASE_URL}/reparacoes/${targetId}`, axiosConfig)
            alert("Excluído com sucesso!")

            if (view === "detail") {
                navigate("/reparacoes")
            } else {
                // Otimista: remove da lista sem refetch
                setReparacoes(prev => prev.filter(r => r.id !== targetId))
            }
        } catch (err) {
            handleError(err, "Erro ao excluir")
        }
    }, [id, view, navigate, axiosConfig])

    const handlePDF = useCallback(async (action) => {
        if (!reparacao) return
        const url = `${API_BASE_URL}/reparacoes/${reparacao.id}/pdf`

        if (action === 'view') {
            window.open(url, "_blank")
        } else {
            try {
                const res = await axios.get(url, { responseType: "blob", ...axiosConfig })
                const blobUrl = window.URL.createObjectURL(new Blob([res.data]))
                const link = document.createElement("a")
                link.href = blobUrl
                link.setAttribute("download", `Reparação nº ${reparacao.numreparacao || reparacao.id}.pdf`)
                document.body.appendChild(link)
                link.click()
                link.remove()
            } catch (err) {
                handleError(err, "Erro ao baixar PDF")
            }
        }
    }, [reparacao, axiosConfig])

    // --- MEMOS & CÁLCULOS ---

    // Totais Financeiros (Memoizado)
    const totais = useMemo(() => {
        if (!reparacao) return {}

        const maoObraGeral = Number(reparacao.mao_obra || 0)
        const totalPecas = pecas.reduce((acc, p) => acc + (Number(p.preco_total) || 0) + (Number(p.mao_obra) || 0), 0)
        const pecasSemMO = pecas.reduce((acc, p) => acc + (Number(p.preco_total) || 0), 0)

        const subtotal = maoObraGeral + totalPecas
        const descontoVal = Number(reparacao.desconto || 0)
        const valorDesconto = reparacao.tipoDesconto === "percentual"
            ? (subtotal * descontoVal) / 100
            : descontoVal

        const totalGeral = Math.max(0, subtotal - valorDesconto)
        const iva = totalGeral * 0.23

        return {
            maoObraGeral,
            pecasTotal: totalPecas,
            pecasSemMO,
            subtotal,
            valorDesconto,
            totalGeral,
            totalComIva: totalGeral + iva,
            temValores: totalGeral > 0 || maoObraGeral > 0 || pecas.length > 0
        }
    }, [reparacao, pecas])

    // Estatísticas da Lista (Reduce Single Pass - O(N))
    const stats = useMemo(() => {
        const init = { total: 0, andamento: 0, pronta: 0, entregue: 0, pendente: 0 }
        return reparacoes.reduce((acc, curr) => {
            acc.total++
            const statusId = getStatusInfo(curr).id
            if (acc[statusId] !== undefined) acc[statusId]++
            return acc
        }, init)
    }, [reparacoes])

    // Filtragem da Lista
    const filteredReparacoes = useMemo(() => {
        const term = searchTerm.toLowerCase()
        return reparacoes.filter(r => {
            const statusMatch = filterStatus === "all" || getStatusInfo(r).id === filterStatus
            if (!statusMatch) return false
            if (!term) return true

            return (
                r.nomemaquina?.toLowerCase().includes(term) ||
                r.nomecentro?.toLowerCase().includes(term) ||
                r.cliente_nome?.toLowerCase().includes(term) ||
                r.estadoreparacao?.toLowerCase().includes(term)
            )
        })
    }, [reparacoes, searchTerm, filterStatus])

    // --- DEFINIÇÃO DE COLUNAS ---

    const columnsReparacoes = useMemo(() => [
        {
            name: "Ações", width: "140px", ignoreRowClick: true,
            cell: row => (
                <div className="d-flex gap-1">
                    <button onClick={() => navigate(`/reparacoes/${row.id}`)} className="btn btn-outline-info btn-sm"><i className="bi bi-eye"></i></button>
                    <button onClick={() => navigate(`/reparacoes/edit/${row.id}`)} className="btn btn-outline-primary btn-sm"><i className="bi bi-pencil"></i></button>
                    <button onClick={() => handleDelete(row)} className="btn btn-outline-danger btn-sm"><i className="bi bi-trash"></i></button>
                </div>
            )
        },
        {
            name: "Status", width: "120px", selector: row => getStatusInfo(row).id, cell: row => {
                const s = getStatusInfo(row); return <span className={`badge ${s.class}`}>{s.text}</span>
            }, sortable: true
        },
        { name: "ID", selector: row => row.id, width: "70px", sortable: true },
        { name: "Cliente", selector: row => row.cliente_nome, wrap: true, sortable: true },
        { name: "Máquina", selector: row => row.nomemaquina, wrap: true, sortable: true },
        { name: "Centro", selector: row => row.nomecentro, wrap: true, sortable: true },
        { name: "Data", selector: row => row.dataentrega, cell: row => formatDate(row.dataentrega), width: "110px", sortable: true },
        { name: "Total", selector: row => row.totalGeral, cell: row => <span className="fw-bold text-success">{formatCurrency(row.totalGeral)}</span>, width: "100px", sortable: true },
    ], [navigate, handleDelete])

    const columnsPecas = useMemo(() => [
        { name: "Peça / Ref", selector: row => `${row.tipopeca || ''} ${row.marca || ''}`, wrap: true },
        { name: "Qtd", selector: row => row.quantidade, width: "70px", cell: row => <span className="badge bg-info">{row.quantidade}</span> },
        { name: "Unitário", selector: row => row.preco_unitario, cell: row => formatCurrency(row.preco_unitario), width: "100px" },
        { name: "Total (+MO)", selector: row => (Number(row.preco_total) + Number(row.mao_obra)), cell: row => <span className="fw-bold text-primary">{formatCurrency(Number(row.preco_total) + Number(row.mao_obra))}</span>, width: "120px" },
        { name: "Observação", selector: row => row.observacao, wrap: true, cell: row => <small className="text-muted fst-italic">{row.observacao || "-"}</small> },
        { name: "Status", width: "110px", cell: row => <span className={`badge ${row.existe_no_sistema ? "bg-success" : "bg-warning text-dark"}`}>{row.existe_no_sistema ? "Disp." : "N/A"}</span> }
    ], [])

    // --- SUB-RENDERIZADORES (Para limpar o return principal) ---

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Carregando...</span></div>
            </div>
        )
    }

    if (error && !reparacao && reparacoes.length === 0) {
        return <div className="alert alert-danger m-4">{error} <button className="btn btn-sm btn-outline-danger ms-2" onClick={() => window.location.reload()}>Recarregar</button></div>
    }

    // --- VIEW: DETALHES (MODERNIZADA) ---
    const renderDetailView = () => {
        const s = getStatusInfo(reparacao)

        // Verifica se há descrição
        const temDescricao = reparacao.descricao && reparacao.descricao !== "Sem descrição.";

        return (
            <div className="container-fluid bg-light min-vh-100 py-4">
                <div className="container">
                    {/* --- CABEÇALHO SUPERIOR --- */}
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4">
                        <div>
                            <nav aria-label="breadcrumb">
                                <ol className="breadcrumb mb-1" style={{ fontSize: '0.85rem' }}>
                                    <li className="breadcrumb-item">
                                        <span className="text-decoration-none text-muted" role="button" onClick={() => navigate("/reparacoes")}>Reparações</span>
                                    </li>
                                    <li className="breadcrumb-item active">Detalhes</li>
                                </ol>
                            </nav>
                            <div className="d-flex align-items-center gap-3">
                                <h2 className="fw-bold text-dark mb-0">Reparação #{reparacao.numreparacao || reparacao.id}</h2>
                                <span className={`badge ${s.class} rounded-pill px-3 py-2`}>{s.text}</span>
                            </div>
                        </div>

                        <div className="d-flex gap-2 mt-3 mt-md-0 bg-white p-2 rounded shadow-sm">
                            <button className="btn btn-outline-secondary btn-sm px-3" onClick={() => navigate("/reparacoes")}>
                                <i className="bi bi-arrow-left me-2"></i>Voltar
                            </button>
                            <button className="btn btn-outline-primary btn-sm px-3" onClick={() => navigate(`/reparacoes/edit/${reparacao.id}`)}>
                                <i className="bi bi-pencil me-2"></i>Editar
                            </button>
                            <button className="btn btn-outline-danger btn-sm px-3" onClick={() => handleDelete(reparacao)}>
                                <i className="bi bi-trash me-2"></i>Apagar
                            </button>
                        </div>
                    </div>

                    <div className="row g-4">
                        {/* --- COLUNA PRINCIPAL (ESQUERDA) --- */}
                        <div className="col-lg-8">

                            {/* CARTÃO DO EQUIPAMENTO */}
                            <div className="card border-0 shadow-sm rounded-4 mb-4 overflow-hidden">
                                <div className="card-body p-4">
                                    <div className="d-flex align-items-center mb-4">
                                        <div className="bg-primary bg-opacity-10 p-3 rounded-circle text-primary me-3">
                                            <i className="bi bi-laptop fs-4"></i>
                                        </div>
                                        <div>
                                            <h6 className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '0.75rem' }}>Equipamento</h6>
                                            <h4 className="fw-bold mb-0">{reparacao.nomemaquina}</h4>
                                            <span className="text-muted small"><i className="bi bi-geo-alt me-1"></i>{reparacao.nomecentro}</span>
                                        </div>
                                    </div>

                                    <div className="bg-light rounded-3 p-3 mb-4 border border-light">
                                        <h6 className="fw-bold text-secondary mb-2"><i className="bi bi-card-text me-2"></i>Descrição da Avaria</h6>
                                        <p className="text-secondary mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                                            {temDescricao ? reparacao.descricao : <span className="fst-italic text-muted">Nenhuma descrição fornecida.</span>}
                                        </p>
                                    </div>

                                    {/* TIMELINE VISUAL DE DATAS */}
                                    <div className="row text-center position-relative mt-4">
                                        <div className="col-4">
                                            <div className="text-success mb-2"><i className="bi bi-box-arrow-in-down fs-4"></i></div>
                                            <small className="text-muted d-block fw-bold text-uppercase" style={{ fontSize: '0.7rem' }}>Entrada</small>
                                            <span className="fw-bold text-dark">{formatDate(reparacao.dataentrega)}</span>
                                        </div>
                                        <div className="col-4 border-start border-end">
                                            <div className="text-primary mb-2"><i className="bi bi-gear-wide-connected fs-4"></i></div>
                                            <small className="text-muted d-block fw-bold text-uppercase" style={{ fontSize: '0.7rem' }}>Conclusão</small>
                                            <span className="fw-bold text-dark">{formatDate(reparacao.dataconclusao)}</span>
                                        </div>
                                        <div className="col-4">
                                            <div className="text-secondary mb-2"><i className="bi bi-box-arrow-right fs-4"></i></div>
                                            <small className="text-muted d-block fw-bold text-uppercase" style={{ fontSize: '0.7rem' }}>Saída</small>
                                            <span className="fw-bold text-dark">{formatDate(reparacao.datasaida)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CARTÃO DE PEÇAS */}
                            <div className="card border-0 shadow-sm rounded-4 mb-4">
                                <div className="card-header bg-white py-3 px-4 border-bottom d-flex justify-content-between align-items-center">
                                    <h5 className="mb-0 fw-bold text-dark">
                                        <i className="bi bi-tools me-2 text-warning"></i>Peças Utilizadas
                                    </h5>
                                    <span className="badge bg-light text-dark border">{pecas.length} itens</span>
                                </div>
                                <div className="card-body p-0">
                                    {pecas.length > 0 ? (
                                        <DataTable
                                            columns={columnsPecas}
                                            data={pecas}
                                            customStyles={{
                                                headRow: { style: { backgroundColor: '#fff', borderBottom: '1px solid #eee', color: '#6c757d' } },
                                                rows: { style: { fontSize: '0.9rem' } }
                                            }}
                                        />
                                    ) : (
                                        <div className="text-center py-5">
                                            <div className="bg-light rounded-circle d-inline-flex p-3 mb-3">
                                                <i className="bi bi-box-seam text-muted fs-1"></i>
                                            </div>
                                            <h6 className="text-muted">Nenhuma peça registada.</h6>
                                        </div>
                                    )}
                                </div>
                                {pecas.length > 0 && (
                                    <div className="card-footer bg-white border-top p-3 text-end">
                                        <span className="text-muted me-2">Total Peças:</span>
                                        <span className="fw-bold text-primary fs-5">{formatCurrency(totais.pecasTotal)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* --- COLUNA LATERAL (DIREITA) --- */}
                        <div className="col-lg-4">

                            {/* CARTÃO CLIENTE */}
                            <div className="card border-0 shadow-sm rounded-4 mb-4">
                                <div className="card-body p-4">
                                    <h6 className="text-muted text-uppercase fw-bold mb-4" style={{ fontSize: '0.75rem' }}>
                                        <i className="bi bi-person-circle me-2"></i>Dados do Cliente
                                    </h6>

                                    <div className="mb-3">
                                        <label className="small text-muted">Nome</label>
                                        <div className="fw-bold text-dark fs-5">{reparacao.cliente_nome}</div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="small text-muted">Telefone</label>
                                        <div className="d-flex align-items-center">
                                            <div className="bg-success bg-opacity-10 p-1 rounded me-2 text-success"><i className="bi bi-telephone-fill"></i></div>
                                            <span className="fw-bold">{reparacao.cliente_telefone || "N/A"}</span>
                                        </div>
                                    </div>

                                    <div className="mb-0">
                                        <label className="small text-muted">Morada</label>
                                        <div className="d-flex align-items-start">
                                            <div className="bg-danger bg-opacity-10 p-1 rounded me-2 text-danger mt-1"><i className="bi bi-geo-alt-fill"></i></div>
                                            <span className="text-secondary" style={{ fontSize: '0.9rem' }}>{reparacao.cliente_morada || "N/A"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* CARTÃO ORÇAMENTO/RESUMO */}
                            <div className="card border-0 shadow-sm rounded-4 bg-primary text-white">
                                <div className="card-body p-4 position-relative overflow-hidden">
                                    {/* Elemento decorativo de fundo */}
                                    <i className="bi bi-currency-euro position-absolute text-white opacity-25" style={{ fontSize: '8rem', right: '-20px', bottom: '-30px' }}></i>

                                    <h5 className="fw-bold mb-4 border-bottom border-white border-opacity-25 pb-2">Resumo Financeiro</h5>

                                    <div className="d-flex justify-content-between mb-2">
                                        <span className="text-white text-opacity-75">Mão de Obra</span>
                                        <span className="fw-bold">{formatCurrency(totais.maoObraGeral)}</span>
                                    </div>
                                    <div className="d-flex justify-content-between mb-2">
                                        <span className="text-white text-opacity-75">Peças</span>
                                        <span className="fw-bold">{formatCurrency(totais.pecasTotal)}</span>
                                    </div>
                                    {totais.valorDesconto > 0 && (
                                        <div className="d-flex justify-content-between mb-2 text-warning">
                                            <span>Desconto</span>
                                            <span>- {formatCurrency(totais.valorDesconto)}</span>
                                        </div>
                                    )}
                                    <div className="d-flex justify-content-between mb-1">
                                        <span className="small text-white text-opacity-75">Total Geral (s/ IVA)</span>
                                        <span className="fw-bold">{formatCurrency(totais.totalGeral)}</span>
                                    </div>
                                    <div className="mt-4 pt-3 border-top border-white border-opacity-25">
                                        <div className="d-flex justify-content-between align-items-center">
                                            <span className="fs-6 text-white text-opacity-75">Total (c/ IVA)</span>
                                            <span className="fs-2 fw-bold">{formatCurrency(totais.totalComIva)}</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 d-grid gap-2">
                                        <button className="btn btn-light fw-bold text-primary" onClick={() => handlePDF('download')}>
                                            <i className="bi bi-file-earmark-pdf me-2"></i>Baixar Orçamento
                                        </button>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // --- VIEW: LISTA ---
    const renderListView = () => (
        <div className="container-fluid mt-4">
            <div className="card shadow-sm">
                <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
                    <h4 className="mb-0"><i className="bi bi-tools me-2"></i>Lista de Reparações</h4>
                    <button className="btn btn-light btn-sm" onClick={() => navigate("/reparacoes/registo")}>
                        <i className="bi bi-plus-circle me-1"></i> Nova
                    </button>
                </div>
                <div className="card-body">
                    {/* Cards Estatísticos */}
                    <div className="row mb-4 g-2">
                        {[
                            { l: "Em Andamento", v: stats.andamento, c: "bg-warning text-dark" },
                            { l: "Prontas", v: stats.pronta, c: "bg-info text-white" },
                            { l: "Entregues", v: stats.entregue, c: "bg-success text-white" },
                            { l: "Total", v: stats.total, c: "bg-primary text-white" }
                        ].map((stat, i) => (
                            <div key={i} className="col-6 col-md-3">
                                <div className={`card ${stat.c} text-center py-2`}>
                                    <h5 className="mb-0">{stat.v}</h5>
                                    <small>{stat.l}</small>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Filtros */}
                    <div className="row mb-3">
                        <div className="col-md-8">
                            <input type="text" className="form-control" placeholder="Pesquisar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="col-md-4">
                            <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                <option value="all">Todos os Status</option>
                                <option value="pendente">Pendente</option>
                                <option value="andamento">Em Andamento</option>
                                <option value="pronta">Pronta</option>
                                <option value="entregue">Entregue</option>
                            </select>
                        </div>
                    </div>

                    {/* Tabela */}
                    <DataTable
                        columns={columnsReparacoes}
                        data={filteredReparacoes}
                        pagination
                        highlightOnHover
                        striped
                        responsive
                        customStyles={tableCustomStyles}
                        noDataComponent={<div className="p-4 text-muted">Nenhuma reparação encontrada.</div>}
                    />
                </div>
            </div>
        </div>
    )

    // --- RENDER PRINCIPAL ---
    return view === "detail" ? renderDetailView() : renderListView()
}

export default ReparacoesView