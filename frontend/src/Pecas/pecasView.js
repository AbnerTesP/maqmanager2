"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import axios from "axios"
import DataTable from "react-data-table-component"
import { useNavigate } from "react-router-dom"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"
import "./PecasView.css"

function PecasView() {
    const [pecas, setPecas] = useState([])
    const [searchTerm, setSearchTerm] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [selectedRows, setSelectedRows] = useState([])
    const [filterType, setFilterType] = useState("all") // all, tipopeca, marca, maquina
    const navigate = useNavigate()

    // Configuração base do axios
    const axiosConfig = useMemo(
        () => ({
            timeout: 30000,
            headers: {
                Authorization: localStorage.getItem("token"),
            },
        }),
        [],
    )

    // Função para tratar erros
    const handleError = useCallback(
        (error, defaultMessage) => {
            console.error(defaultMessage, error)

            let errorMessage = defaultMessage
            if (error.code === "ECONNABORTED") {
                errorMessage = "Timeout: A operação demorou muito tempo."
            } else if (error.response?.status === 401) {
                errorMessage = "Sessão expirada. Faça login novamente."
                localStorage.removeItem("token")
                navigate("/login")
                return
            } else if (error.response?.status >= 500) {
                errorMessage = "Erro interno do servidor. Tente novamente mais tarde."
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message
            }

            setError(errorMessage)
            setTimeout(() => setError(""), 5000)
        },
        [navigate],
    )

    const fetchPecas = useCallback(async () => {
        setLoading(true)
        setError("")

        try {
            const response = await axios.get("http://localhost:8082/pecas", axiosConfig)

            if (response.data && Array.isArray(response.data)) {
                setPecas(response.data)
            } else {
                throw new Error("Dados inválidos recebidos do servidor")
            }
        } catch (error) {
            handleError(error, "Erro ao buscar as peças!")
            setPecas([])
        } finally {
            setLoading(false)
        }
    }, [axiosConfig, handleError])

    useEffect(() => {
        fetchPecas()
    }, [fetchPecas])

    const handleEdit = useCallback(
        (row) => {
            navigate(`/pecas/edit/${row.id}`)
        },
        [navigate],
    )

    const handleDelete = useCallback(
        async (row) => {
            const confirmMessage = `Tem certeza que deseja excluir a peça "${row.tipopeca}" da marca "${row.marca}"?`

            if (window.confirm(confirmMessage)) {
                try {
                    const response = await axios.delete(`http://localhost:8082/pecas/${row.id}`, axiosConfig)

                    // Mostrar mensagem de sucesso
                    const successMsg = response.data.message || "Peça excluída com sucesso!"
                    const alertDiv = document.createElement("div")
                    alertDiv.className = "alert alert-success alert-modern fade show"
                    alertDiv.innerHTML = `
            <div class="alert-content">
              <i class="bi bi-check-circle-fill alert-icon"></i>
              <div class="alert-text"><strong>Sucesso!</strong> ${successMsg}</div>
            </div>
          `
                    document.querySelector(".main-content").prepend(alertDiv)

                    // Remover da lista local
                    setPecas((prev) => prev.filter((peca) => peca.id !== row.id))

                    // Remover alerta após 3 segundos
                    setTimeout(() => {
                        alertDiv.remove()
                    }, 3000)
                } catch (error) {
                    handleError(error, "Erro ao excluir a peça.")
                }
            }
        },
        [axiosConfig, handleError],
    )

    const handleSearch = useCallback((e) => {
        setSearchTerm(e.target.value)
    }, [])

    const handleBulkDelete = useCallback(async () => {
        if (selectedRows.length === 0) {
            alert("Selecione pelo menos uma peça para excluir.")
            return
        }

        const confirmMessage = `Tem certeza que deseja excluir ${selectedRows.length} peça(s) selecionada(s)?`

        if (window.confirm(confirmMessage)) {
            try {
                const deletePromises = selectedRows.map((row) =>
                    axios.delete(`http://localhost:8082/pecas/${row.id}`, axiosConfig),
                )

                await Promise.all(deletePromises)

                // Remover da lista local
                const selectedIds = selectedRows.map((row) => row.id)
                setPecas((prev) => prev.filter((peca) => !selectedIds.includes(peca.id)))
                setSelectedRows([])

                alert(`${selectedRows.length} peça(s) excluída(s) com sucesso!`)
            } catch (error) {
                handleError(error, "Erro ao excluir peças selecionadas.")
            }
        }
    }, [selectedRows, axiosConfig, handleError])

    const exportToExcel = useCallback(() => {
        if (filteredPecas.length === 0) {
            alert("Não há dados para exportar.")
            return
        }

        try {
            const exportData = filteredPecas.map(({ id, ...rest }) => ({
                "Tipo de Peça": rest.tipopeca || "N/A",
                "Marca da Peça": rest.marca || "N/A",
                "Tipo da Máquina": rest.maquina_tipo || "N/A",
                "Marca da Máquina": rest.maquina_marca || "N/A",
                "Modelo da Máquina": rest.modelo_maquina || "N/A",
            }))

            const worksheet = XLSX.utils.json_to_sheet(exportData)
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, "Pecas")

            // Ajustar largura das colunas
            const colWidths = [
                { wch: 20 }, // Tipo de Peça
                { wch: 20 }, // Marca da Peça
                { wch: 20 }, // Tipo da Máquina
                { wch: 20 }, // Marca da Máquina
                { wch: 20 }, // Modelo da Máquina
            ]
            worksheet["!cols"] = colWidths

            const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
            const dataBlob = new Blob([excelBuffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            })

            const today = new Date().toLocaleDateString("pt-PT").replace(/\//g, "-")
            const filename = `Pecas_${today}.xlsx`
            saveAs(dataBlob, filename)

            alert(`Arquivo ${filename} exportado com sucesso!`)
        } catch (error) {
            console.error("Erro ao exportar:", error)
            alert("Erro ao exportar dados para Excel.")
        }
    }, [])

    // Filtrar peças baseado no termo de busca e tipo de filtro
    const filteredPecas = useMemo(() => {
        if (!searchTerm) return pecas

        return pecas.filter((peca) => {
            const searchLower = searchTerm.toLowerCase()

            switch (filterType) {
                case "tipopeca":
                    return peca.tipopeca?.toLowerCase().includes(searchLower)
                case "marca":
                    return peca.marca?.toLowerCase().includes(searchLower)
                case "maquina":
                    return (
                        peca.maquina_tipo?.toLowerCase().includes(searchLower) ||
                        peca.maquina_marca?.toLowerCase().includes(searchLower) ||
                        peca.modelo_maquina?.toLowerCase().includes(searchLower)
                    )
                default:
                    return (
                        peca.tipopeca?.toLowerCase().includes(searchLower) ||
                        peca.marca?.toLowerCase().includes(searchLower) ||
                        peca.maquina_tipo?.toLowerCase().includes(searchLower) ||
                        peca.maquina_marca?.toLowerCase().includes(searchLower) ||
                        peca.modelo_maquina?.toLowerCase().includes(searchLower)
                    )
            }
        })
    }, [pecas, searchTerm, filterType])

    const pecasColumns = useMemo(
        () => [
            {
                name: "Ações",
                cell: (row) => (
                    <div className="d-flex">
                        <button
                            onClick={() => handleEdit(row)}
                            className="btn btn-primary btn-sm me-2"
                            title="Editar peça"
                            disabled={loading}
                        >
                            <i className="bi bi-pencil"></i>
                        </button>
                        <button
                            onClick={() => handleDelete(row)}
                            className="btn btn-danger btn-sm"
                            title="Excluir peça"
                            disabled={loading}
                        >
                            <i className="bi bi-trash"></i>
                        </button>
                    </div>
                ),
                ignoreRowClick: true,
                width: "120px",
            },
            {
                name: "Tipo de Peça",
                selector: (row) => row.tipopeca || "N/A",
                sortable: true,
                wrap: true,
            },
            {
                name: "Marca da Peça",
                selector: (row) => row.marca || "N/A",
                sortable: true,
                wrap: true,
            },
            {
                name: "Tipo da Máquina",
                selector: (row) => row.maquina_tipo || "N/A",
                sortable: true,
                wrap: true,
            },
            {
                name: "Marca da Máquina",
                selector: (row) => row.maquina_marca || "N/A",
                sortable: true,
                wrap: true,
            },
            {
                name: "Modelo da Máquina",
                selector: (row) => row.modelo_maquina || "N/A",
                sortable: true,
                wrap: true,
            },
        ],
        [handleEdit, handleDelete, loading],
    )

    const handleSelectedRowsChange = useCallback((state) => {
        setSelectedRows(state.selectedRows)
    }, [])

    // Auto-hide error messages
    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => {
                setError("")
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [error])

    return (
        <div className="pecas-container">
            {/* Header Section */}
            <div className="header-section">
                <div className="container">
                    <div className="row align-items-center">
                        <div className="col-md-8">
                            <div className="header-content">
                                <h1 className="page-title">
                                    <i className="bi bi-wrench-adjustable-circle-fill me-3"></i>
                                    Lista de Peças
                                </h1>
                                <p className="page-subtitle">Gerencie e monitore todas as peças do seu inventário</p>
                            </div>
                        </div>
                        <div className="col-md-4 text-md-end">
                            <div className="stats-card">
                                <div className="stats-number">{filteredPecas.length}</div>
                                <div className="stats-label">{searchTerm ? "Peças Filtradas" : "Total de Peças"}</div>
                                {searchTerm && <div className="stats-total">de {pecas.length} total</div>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container main-content">
                {/* Error Alert */}
                {error && (
                    <div className="alert alert-danger alert-modern alert-dismissible fade show" role="alert">
                        <div className="alert-content">
                            <i className="bi bi-exclamation-triangle-fill alert-icon"></i>
                            <div className="alert-text">
                                <strong>Ops!</strong> {error}
                            </div>
                        </div>
                        <button type="button" className="btn-close" onClick={() => setError("")} aria-label="Close"></button>
                    </div>
                )}

                {/* Controls Section */}
                <div className="controls-section">
                    <div className="row g-3">
                        <div className="col-md-6">
                            <div className="control-group">
                                <label className="control-label">Ações Rápidas</label>
                                <div className="button-group">
                                    <button className="btn btn-primary btn-modern" onClick={fetchPecas} disabled={loading}>
                                        {loading ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status">
                                                    <span className="visually-hidden">Carregando...</span>
                                                </span>
                                                Atualizando...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-arrow-clockwise me-2"></i>
                                                Atualizar
                                            </>
                                        )}
                                    </button>
                                    <button
                                        className="btn btn-success btn-modern"
                                        onClick={exportToExcel}
                                        disabled={loading || filteredPecas.length === 0}
                                    >
                                        <i className="bi bi-file-earmark-excel me-2"></i>
                                        Exportar Excel
                                    </button>
                                    {selectedRows.length > 0 && (
                                        <button className="btn btn-danger btn-modern" onClick={handleBulkDelete} disabled={loading}>
                                            <i className="bi bi-trash me-2"></i>
                                            Excluir ({selectedRows.length})
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="control-group">
                                <label className="control-label">Pesquisar e Filtrar</label>
                                <div className="search-group">
                                    <div className="search-input-wrapper">
                                        <i className="bi bi-search search-icon"></i>
                                        <input
                                            type="text"
                                            className="form-control search-input"
                                            placeholder="Pesquisar peças..."
                                            value={searchTerm}
                                            onChange={handleSearch}
                                            disabled={loading}
                                        />
                                        {searchTerm && (
                                            <button
                                                className="btn btn-outline-secondary btn-sm clear-search"
                                                onClick={() => setSearchTerm("")}
                                                title="Limpar pesquisa"
                                            >
                                                <i className="bi bi-x-circle"></i>
                                            </button>
                                        )}
                                    </div>
                                    <select
                                        className="form-select filter-select"
                                        value={filterType}
                                        onChange={(e) => setFilterType(e.target.value)}
                                        disabled={loading}
                                    >
                                        <option value="all">🔍 Todos os campos</option>
                                        <option value="tipopeca">🔧 Tipo de Peça</option>
                                        <option value="marca">🏷️ Marca da Peça</option>
                                        <option value="maquina">🏭 Dados da Máquina</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Data Table Section */}
                <div className="table-section">
                    <div className="table-card">
                        <div className="table-header">
                            <h5 className="table-title">
                                <i className="bi bi-table me-2"></i>
                                Inventário de Peças
                            </h5>
                            <div className="table-info">
                                {searchTerm && (
                                    <span className="filter-badge">
                                        <i className="bi bi-funnel me-1"></i>
                                        Filtro: {searchTerm}
                                    </span>
                                )}
                                {selectedRows.length > 0 && (
                                    <span className="selection-badge">
                                        <i className="bi bi-check-square me-1"></i>
                                        {selectedRows.length} selecionada(s)
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="table-body">
                            <DataTable
                                columns={pecasColumns}
                                data={filteredPecas}
                                pagination
                                paginationPerPage={15}
                                paginationRowsPerPageOptions={[10, 15, 20, 25, 50]}
                                selectableRows
                                onSelectedRowsChange={handleSelectedRowsChange}
                                clearSelectedRows={selectedRows.length === 0}
                                progressPending={loading}
                                progressComponent={
                                    <div className="loading-container">
                                        <div className="loading-spinner">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Carregando...</span>
                                            </div>
                                        </div>
                                        <p className="loading-text">Carregando peças...</p>
                                    </div>
                                }
                                noDataComponent={
                                    <div className="no-data-container">
                                        <div className="no-data-icon">
                                            <i className="bi bi-inbox"></i>
                                        </div>
                                        <h6 className="no-data-title">Nenhuma peça encontrada</h6>
                                        <p className="no-data-text">
                                            {searchTerm
                                                ? `Não há peças que correspondam à pesquisa "${searchTerm}"`
                                                : "Não há peças cadastradas no sistema"}
                                        </p>
                                        {searchTerm && (
                                            <button className="btn btn-outline-primary btn-sm" onClick={() => setSearchTerm("")}>
                                                <i className="bi bi-arrow-clockwise me-2"></i>
                                                Limpar filtro
                                            </button>
                                        )}
                                    </div>
                                }
                                highlightOnHover
                                pointerOnHover
                                responsive
                                striped
                                customStyles={{
                                    table: {
                                        style: {
                                            backgroundColor: "transparent",
                                        },
                                    },
                                    headRow: {
                                        style: {
                                            backgroundColor: "#f8f9fa",
                                            borderBottom: "2px solid #dee2e6",
                                            minHeight: "52px",
                                        },
                                    },
                                    headCells: {
                                        style: {
                                            fontSize: "14px",
                                            fontWeight: "600",
                                            color: "#495057",
                                            paddingLeft: "16px",
                                            paddingRight: "16px",
                                        },
                                    },
                                    rows: {
                                        style: {
                                            minHeight: "60px",
                                            "&:hover": {
                                                backgroundColor: "#f8f9fa",
                                                cursor: "pointer",
                                            },
                                        },
                                    },
                                    cells: {
                                        style: {
                                            paddingLeft: "16px",
                                            paddingRight: "16px",
                                            fontSize: "14px",
                                        },
                                    },
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PecasView
