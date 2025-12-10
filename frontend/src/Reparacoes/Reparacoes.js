"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import axios from "axios"
import DataTable from "react-data-table-component"
import { useNavigate } from "react-router-dom"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

// --- CONSTANTES E UTILITÁRIOS ---
const API_BASE_URL = "http://localhost:8082"

const customStyles = {
    headRow: {
        style: {
            backgroundColor: "#f9fafb",
            borderBottomWidth: "1px",
            borderBottomColor: "#e5e7eb",
            minHeight: "50px",
        },
    },
    headCells: {
        style: {
            color: "#6b7280",
            fontSize: "0.75rem",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
        },
    },
    rows: {
        style: {
            minHeight: "60px",
            "&:hover": {
                backgroundColor: "#f3f4f6",
                cursor: "pointer",
                transition: "all 0.2s",
            },
        },
    },
    pagination: {
        style: {
            borderTop: "1px solid #e5e7eb",
        },
    },
}

function removerAcentos(str) {
    if (!str) return ""
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function ReparacoesView() {
    const [reparacoes, setReparacoes] = useState([])
    const [alarmes, setAlarmes] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    // -- Estados persistidos para filtros e paginação --
    const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem("reparacoesSearchTerm") || "")
    const [filterStatus, setFilterStatus] = useState(() => sessionStorage.getItem("reparacoesFilterStatus") || "all")
    const [currentPage, setCurrentPage] = useState(() => Number(sessionStorage.getItem("reparacoesCurrentPage")) || 1)
    const [perPage, setPerPage] = useState(() => Number(sessionStorage.getItem("reparacoesPerPage")) || 10)

    // Efeitos para guardar o estado na sessionStorage
    useEffect(() => {
        sessionStorage.setItem("reparacoesSearchTerm", searchTerm)
        sessionStorage.setItem("reparacoesFilterStatus", filterStatus)
    }, [searchTerm, filterStatus])

    useEffect(() => {
        sessionStorage.setItem("reparacoesCurrentPage", currentPage)
    }, [currentPage])

    useEffect(() => {
        sessionStorage.setItem("reparacoesPerPage", perPage)
    }, [perPage])

    useEffect(() => {
        const loadData = async () => {
            setLoading(true)
            try {
                const [repResponse, alarmResponse] = await Promise.all([
                    axios.get(`${API_BASE_URL}/reparacoes`),
                    axios.get(`${API_BASE_URL}/alarmes/resumo`)
                ])
                setReparacoes(Array.isArray(repResponse.data) ? repResponse.data : [])
                setAlarmes(alarmResponse.data.alarmes || [])
            } catch (error) {
                console.error("Erro ao carregar dados:", error)
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    const handleDelete = useCallback(async (row, e) => {
        e.stopPropagation();
        if (!window.confirm("Tem certeza que deseja deletar esta reparação?")) return

        try {
            await axios.delete(`${API_BASE_URL}/reparacoes/${row.id}`)
            setReparacoes(prev => prev.filter(r => r.id !== row.id))
            alert("Reparação deletada com sucesso!")
        } catch (error) {
            alert("Erro ao deletar a reparação")
        }
    }, [])

    const getStatus = useCallback((reparacao) => {
        const statusRep = reparacao.estadoreparacao?.toLowerCase() || ""
        const statusOrc = reparacao.estadoorcamento?.toLowerCase() || ""

        if (statusRep.includes("sem reparação") || statusOrc.includes("recusado")) return "sem_reparacao"
        if (reparacao.datasaida) return "entregue"
        if (reparacao.dataconclusao) return "pronta"
        if (reparacao.dataentrega) return "andamento"
        return "pendente"
    }, [])

    const filteredReparacoes = useMemo(() => {
        const termoLimpo = removerAcentos(searchTerm)
        return reparacoes.filter((reparacao) => {
            if (filterStatus !== "all" && getStatus(reparacao) !== filterStatus) return false
            if (!termoLimpo) return true
            return (
                removerAcentos(reparacao.nomemaquina).includes(termoLimpo) ||
                removerAcentos(reparacao.nomecentro).includes(termoLimpo) ||
                removerAcentos(reparacao.cliente_nome).includes(termoLimpo) ||
                removerAcentos(reparacao.numreparacao?.toString()).includes(termoLimpo)
            )
        })
    }, [reparacoes, searchTerm, filterStatus, getStatus])

    const stats = useMemo(() => {
        const initialStats = { total: 0, andamento: 0, pronta: 0, entregue: 0 }
        return reparacoes.reduce((acc, curr) => {
            acc.total++
            const status = getStatus(curr)
            if (acc[status] !== undefined) acc[status]++
            return acc
        }, initialStats)
    }, [reparacoes, getStatus])

    const statCardsConfig = [
        { title: stats.andamento, label: "Em Andamento", icon: "bi-hourglass-split", color: "text-warning", bg: "bg-warning" },
        { title: stats.pronta, label: "Prontas", icon: "bi-check-circle-fill", color: "text-info", bg: "bg-info" },
        { title: stats.entregue, label: "Entregues", icon: "bi-box-seam-fill", color: "text-success", bg: "bg-success" },
        { title: stats.total, label: "Total Registado", icon: "bi-folder-fill", color: "text-primary", bg: "bg-primary" },
    ]

    const getStatusBadge = (status) => {
        const styles = {
            entregue: "bg-success bg-opacity-10 text-success border-success",
            pronta: "bg-info bg-opacity-10 text-info border-info",
            andamento: "bg-warning bg-opacity-10 text-warning border-warning",
            pendente: "bg-secondary bg-opacity-10 text-secondary border-secondary",
            sem_reparacao: "bg-danger bg-opacity-10 text-danger border-danger",
        }

        const labels = {
            entregue: "Entregue", pronta: "Pronta", andamento: "Em Andamento",
            pendente: "Pendente", sem_reparacao: "Sem Reparação"
        }

        const styleClass = styles[status] || styles.pendente

        return (
            <span className={`badge rounded-pill border ${styleClass} px-3 py-2 fw-normal`}>
                {labels[status] || "Pendente"}
            </span>
        )
    }

    const columns = useMemo(() => [
        {
            name: "Status",
            selector: row => getStatus(row),
            cell: row => getStatusBadge(getStatus(row)),
            sortable: true,
            width: "140px",
        },
        { name: "Nº Rep.", selector: row => row.numreparacao, sortable: true, width: "100px", style: { fontWeight: 'bold', color: '#374151' } },
        { name: "Cliente", selector: row => row.cliente_nome, sortable: true, wrap: true },
        { name: "Máquina", selector: row => row.nomemaquina, sortable: true, wrap: true },
        { name: "Centro", selector: row => row.nomecentro, sortable: true, hide: "sm" },
        {
            name: "Entrada",
            selector: row => row.dataentrega,
            cell: row => <span className="text-secondary fw-medium ">{row.dataentrega ? new Date(row.dataentrega).toLocaleDateString() : "-"}</span>,
            sortable: true,
            width: "110px"
        },
        // --- NOVA COLUNA DE CONCLUSÃO ADICIONADA AQUI ---
        {
            name: "Conclusão",
            selector: row => row.dataconclusao,
            cell: row => row.dataconclusao ? <span className="text-secondary fw-medium">{new Date(row.dataconclusao).toLocaleDateString()}</span> : <span className="text-muted small">-</span>,
            sortable: true,
            width: "110px"
        },
        // -----------------------------------------------
        {
            name: "Ações",
            width: "130px",
            cell: (row) => (
                <div className="d-flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/reparacoes/edit/${row.id}`) }}
                        className="btn btn-sm btn-light text-primary border hover-shadow" title="Editar">
                        <i className="bi bi-pencil-square"></i>
                    </button>
                    <button onClick={(e) => handleDelete(row, e)}
                        className="btn btn-sm btn-light text-danger border hover-shadow" title="Deletar">
                        <i className="bi bi-trash"></i>
                    </button>
                </div>
            ),
            ignoreRowClick: true,
        },
    ], [handleDelete, navigate, getStatus])

    const handlePageChange = (page) => {
        setCurrentPage(page)
    }

    const handlePerPageChange = (newPerPage) => {
        setPerPage(newPerPage)
    }

    const handleRowClick = (row) => {
        navigate(`/reparacoes/view/${row.id}`)
    }

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
                <div className="spinner-border text-primary" style={{ width: "3rem", height: "3rem" }} role="status">
                    <span className="visually-hidden">Carregando...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="container-fluid bg-light min-vh-100 py-4 px-4">

            {/* Cabeçalho Principal */}
            <div className="d-flex justify-content-between align-items-center mb-5">
                <div>
                    <h3 className="fw-bold text-dark mb-1">Gestão de Reparações</h3>
                    <p className="text-muted mb-0">Gerencie todas as manutenções e estados em tempo real.</p>
                </div>
                <button className="btn btn-primary btn-lg shadow-sm d-flex align-items-center gap-2" onClick={() => navigate("/reparacoes/registo")}>
                    <i className="bi bi-plus-lg"></i>
                    <span>Nova Reparação</span>
                </button>
            </div>

            {/* Cards de Estatísticas */}
            <div className="row mb-5 g-4">
                {statCardsConfig.map((card, index) => (
                    <div key={index} className="col-xl-3 col-md-6">
                        <div className="card border-0 shadow-sm h-100 overflow-hidden">
                            <div className="card-body p-4 d-flex align-items-center justify-content-between">
                                <div>
                                    <p className="text-muted text-uppercase fw-semibold small mb-1">{card.label}</p>
                                    <h2 className="fw-bold mb-0 text-dark">{card.title}</h2>
                                </div>
                                <div className={`rounded-circle p-3 d-flex align-items-center justify-content-center ${card.bg} bg-opacity-10`}>
                                    <i className={`bi ${card.icon} fs-3 ${card.color}`}></i>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Área da Tabela */}
            <div className="card border-0 shadow-sm rounded-3">
                <div className="card-body p-4">

                    {/* Barra de Ferramentas (Filtros) */}
                    <div className="row g-3 mb-4 align-items-center">
                        <div className="col-md-6">
                            <div className="input-group input-group-lg border rounded-3 overflow-hidden">
                                <span className="input-group-text bg-white border-0 pe-0"><i className="bi bi-search text-muted"></i></span>
                                <input
                                    type="text"
                                    className="form-control border-0 shadow-none ps-3"
                                    placeholder="Buscar por cliente, máquina ou número..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="col-md-3 ms-auto">
                            <select
                                className="form-select form-select-lg border-0 bg-light"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                style={{ cursor: 'pointer' }}
                            >
                                <option value="all">Todos os Status</option>
                                <option value="pendente">Pendente</option>
                                <option value="andamento">Em Andamento</option>
                                <option value="pronta">Pronta</option>
                                <option value="entregue">Entregue</option>
                                <option value="sem_reparacao">Sem Reparação</option>
                            </select>
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="rounded-3 overflow-hidden border">
                        <DataTable
                            columns={columns}
                            data={filteredReparacoes}
                            pagination
                            paginationPerPage={perPage}
                            paginationRowsPerPageOptions={[10, 15, 20, 30]}
                            paginationDefaultPage={currentPage}
                            onChangePage={handlePageChange}
                            onChangeRowsPerPage={handlePerPageChange}
                            highlightOnHover
                            pointerOnHover
                            onRowClicked={handleRowClick}
                            responsive
                            customStyles={customStyles}
                            noDataComponent={
                                <div className="text-center py-5">
                                    <div className="mb-3 text-muted opacity-25">
                                        <i className="bi bi-inbox fs-1"></i>
                                    </div>
                                    <h6 className="text-muted">Nenhuma reparação encontrada.</h6>
                                </div>
                            }
                        />
                    </div>
                </div>
            </div>

            <style>{`
                .hover-shadow:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 .125rem .25rem rgba(0,0,0,.075)!important;
                }
                .hover-shadow {
                    transition: all 0.2s;
                }
            `}</style>
        </div>
    )
}

export default ReparacoesView