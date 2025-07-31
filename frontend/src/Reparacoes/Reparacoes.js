"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import axios from "axios"
import DataTable from "react-data-table-component"
import { useNavigate } from "react-router-dom"
import "../Estilos/Reparacoes.css"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

function ReparacoesView() {
    const [reparacoes, setReparacoes] = useState([])
    const [alarmes, setAlarmes] = useState([])
    const [searchTerm, setSearchTerm] = useState("")
    const [loading, setLoading] = useState(true)
    const [filterStatus, setFilterStatus] = useState("all")
    const navigate = useNavigate()

    useEffect(() => {
        fetchReparacoes()
    }, [])

    const fetchReparacoes = useCallback(() => {
        setLoading(true)
        axios
            .get("http://localhost:8082/reparacoes")
            .then((response) => {
                setReparacoes(Array.isArray(response.data) ? response.data : []);
                setLoading(false)
            })
            .catch((error) => {
                console.error("Erro ao buscar as reparações!", error)
                alert("Erro ao carregar as reparações")
                setLoading(false)
            })
    }, [])

    useEffect(() => {
        fetchReparacoes()
    }, [fetchReparacoes])

    function removerAcentos(str) {
        if (!str) return ""
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    }

    // Buscar alarmes ativos ao montar
    useEffect(() => {
        axios.get("http://localhost:8082/alarmes/resumo")
            .then(res => setAlarmes(res.data.alarmes || []))
            .catch(() => setAlarmes([]))
    }, [])

    const handleView = useCallback(
        (row) => {
            navigate(`/reparacoes/view/${row.id}`)
        },
        [navigate],
    )

    const handleEdit = useCallback(
        (row) => {
            navigate(`/reparacoes/edit/${row.id}`)
        },
        [navigate],
    )

    const handleDelete = useCallback(
        (row) => {
            if (window.confirm("Tem certeza que deseja deletar esta reparação?")) {
                axios
                    .delete(`http://localhost:8082/reparacoes/${row.id}`)
                    .then((response) => {
                        alert("Reparação deletada com sucesso!")
                        fetchReparacoes()
                    })
                    .catch((error) => {
                        console.error("Erro ao deletar a reparação!", error)
                        alert("Erro ao deletar a reparação")
                    })
            }
        },
        [fetchReparacoes],
    )

    const handleSearch = useCallback((e) => {
        setSearchTerm(e.target.value)
    }, [])


    const
        handleStatusFilter = useCallback((e) => {
            setFilterStatus(e.target.value)
        }, [])

    // IDs das reparações com alarme
    const reparacoesComAlarme = useMemo(
        () => new Set(alarmes.map(a => a.reparacao_id)),
        [alarmes]
    )

    const conditionalRowStyles = [
        {
            when: row => reparacoesComAlarme.has(row.id),
            style: {
                backgroundColor: "#fff3cd", // amarelo claro (Bootstrap warning)
            },
        },
    ]

    // Função para determinar o status da reparação
    const getStatus = useCallback((reparacao) => {
        // Verificar se é "Sem reparação" primeiro
        if (
            reparacao.estadoreparacao &&
            (reparacao.estadoreparacao.toLowerCase().includes("sem reparação") ||
                reparacao.estadoreparacao.toLowerCase().includes("sem reparacao"))
        ) {
            return "sem_reparacao"
        }

        // Verificar se orçamento foi recusado (backup)
        if (
            reparacao.estadoorcamento &&
            (reparacao.estadoorcamento.toLowerCase().includes("recusado") ||
                reparacao.estadoorcamento.toLowerCase().includes("rejeitado") ||
                reparacao.estadoorcamento.toLowerCase().includes("negado"))
        ) {
            return "sem_reparacao"
        }
        if (reparacao.datasaida) return "entregue"
        if (reparacao.dataconclusao) return "pronta"
        if (reparacao.dataentrega) return "andamento"
        return "pendente"
    }, [])

    // Função para renderizar badge de status
    const getStatusBadge = useCallback(
        (reparacao) => {
            const status = getStatus(reparacao)
            const badges = {
                entregue: <span className="badge bg-success">Entregue</span>,
                pronta: <span className="badge bg-info">Pronta</span>,
                andamento: <span className="badge bg-warning text-dark">Em Andamento</span>,
                pendente: <span className="badge bg-secondary">Pendente</span>,
                sem_reparacao: <span className="badge bg-secondary">Sem Reparação</span>,
            }
            return badges[status]
        },
        [getStatus],
    )

    // Função para formatar datas
    const formatDate = useCallback((dateString) => {
        if (!dateString) return "-"
        return new Date(dateString).toLocaleDateString("pt-BR")
    }, [])

    // Filtrar reparações com base na pesquisa e status
    const filteredReparacoes = useMemo(() => {
        const buscaNormalizada = removerAcentos(searchTerm.toLowerCase())
        return reparacoes.filter((reparacao) => {
            const matchesSearch =
                removerAcentos(reparacao.nomemaquina?.toLowerCase()).includes(buscaNormalizada) ||
                removerAcentos(reparacao.nomecentro?.toLowerCase()).includes(buscaNormalizada) ||
                removerAcentos(reparacao.estadoreparacao?.toLowerCase()).includes(buscaNormalizada) ||
                removerAcentos(reparacao.numreparacao?.toString()).includes(buscaNormalizada) ||
                removerAcentos(reparacao.cliente_nome?.toLowerCase()).includes(buscaNormalizada)

            const matchesStatus = filterStatus === "all" || getStatus(reparacao) === filterStatus

            return matchesSearch && matchesStatus
        })
    }, [reparacoes, searchTerm, filterStatus, getStatus])

    // Estatísticas para o dashboard
    const stats = useMemo(() => {
        return {
            total: reparacoes.length,
            andamento: reparacoes.filter((r) => getStatus(r) === "andamento").length,
            pronta: reparacoes.filter((r) => getStatus(r) === "pronta").length,
            entregue: reparacoes.filter((r) => getStatus(r) === "entregue").length,
            pendente: reparacoes.filter((r) => getStatus(r) === "pendente").length,
            sem_reparacao: reparacoes.filter((r) => getStatus(r) === "sem_reparacao").length,
        }
    }, [reparacoes, getStatus])

    const reparacoesColumns = useMemo(
        () => [

            {
                name: "Ações",
                cell: (row) => (
                    <div className="d-flex gap-1">
                        <button onClick={() => handleView(row)} className="btn btn-outline-primary btn-sm" title="Visualizar">
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
                name: "Nº de Rep.",
                selector: (row) => row.numreparacao || "-",
                sortable: true,
                wrap: true,
                width: "120px",
            },
            {
                name: "Máquina",
                selector: (row) => row.nomemaquina || "-",
                sortable: true,
                wrap: true,
                width: "150px",
            },
            {
                name: "Centro",
                selector: (row) => row.nomecentro || "-",
                sortable: true,
                wrap: true,
                width: "150px",
            },
            {
                name: "Data Entrada",
                selector: (row) => row.dataentrega,
                cell: (row) => formatDate(row.dataentrega),
                sortable: true,
                width: "130px",
            },
            {
                name: "Data Conclusão",
                selector: (row) => row.dataconclusao || "",
                cell: (row) => formatDate(row.dataconclusao),
                sortable: true,
                width: "140px",
            },
            {
                name: "Data Saída",
                selector: (row) => row.datasaida || "",
                cell: (row) => formatDate(row.datasaida),
                sortable: true,
                width: "130px",
            },
            {
                name: "Estado Rep.",
                selector: (row) => row.estadoreparacao || "-",
                sortable: true,
                wrap: true,
                width: "150px",
            },
            {
                name: "Estado Orç.",
                selector: (row) => row.estadoorcamento || "-",
                sortable: true,
                wrap: true,
                width: "150px",
            },
            {
                name: "Cliente",
                selector: (row) => row.cliente_nome || "-",
                sortable: true,
                wrap: true,
                width: "200px",
            },
        ],
        [handleEdit, handleDelete, getStatusBadge, formatDate],
    )

    // Estilos customizados para a tabela
    const customStyles = {
        header: {
            style: {
                minHeight: "56px",
            },
        },
        headRow: {
            style: {
                borderTopStyle: "solid",
                borderTopWidth: "2px",
                borderTopColor: "#e3e6ea",
                backgroundColor: "#f8f9fa",
            },
        },
        headCells: {
            style: {
                "&:not(:last-of-type)": {
                    borderRightStyle: "solid",
                    borderRightWidth: "1px",
                    borderRightColor: "#e3e6ea",
                },
                fontWeight: "600",
                fontSize: "14px",
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
            },
        },
    }

    if (loading) {
        return (
            <div className="container mt-4">
                <div className="d-flex justify-content-center align-items-center" style={{ height: "400px" }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Carregando...</span>
                    </div>
                </div>
            </div>
        )
    }

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
                                <button className="btn btn-light btn-sm" onClick={() => navigate("/reparacoes/registo")}>
                                    <i className="bi bi-plus-circle me-1"></i>
                                    Nova Reparação
                                </button>
                            </div>
                        </div>

                        <div className="card-body">
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
                                            placeholder="Pesquisar por nº de reparação, centro ou estado da reparação..."
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
                                        <option value="sem_reparacao">Sem Reparação</option>
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
                                    conditionalRowStyles={conditionalRowStyles}
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
        </div>
    )
}

export default ReparacoesView
