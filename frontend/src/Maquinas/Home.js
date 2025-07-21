"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import axios from "axios"
import DataTable from "react-data-table-component"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"
import * as XLSX from "xlsx"
import { saveAs } from "file-saver"
import { useNavigate } from "react-router-dom"
import Dropdown from "react-bootstrap/Dropdown"
import DropdownButton from "react-bootstrap/DropdownButton"
import "../Estilos/Home.css"

function Home() {
    const [machines, setMachines] = useState([])
    const [brands, setBrands] = useState([])
    const [selectedBrand, setSelectedBrand] = useState("")
    const [selectedMachineParts, setSelectedMachineParts] = useState({})
    const [expandedRows, setExpandedRows] = useState([])
    const [machineFiles, setMachineFiles] = useState({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [loadingParts, setLoadingParts] = useState({})
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

    // Função para tratar erros de forma consistente
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

    const fetchMachines = useCallback(
        async (brand = "") => {
            setLoading(true)
            setError("")

            try {
                const url = brand
                    ? `http://localhost:8082/machines?brand=${encodeURIComponent(brand)}`
                    : "http://localhost:8082/machines"

                const response = await axios.get(url, axiosConfig)

                if (response.data && Array.isArray(response.data)) {
                    setMachines(response.data)
                    await fetchFilesForMachines(response.data)
                } else {
                    throw new Error("Dados inválidos recebidos do servidor")
                }
            } catch (error) {
                handleError(error, "Erro ao buscar as máquinas!")
                setMachines([])
            } finally {
                setLoading(false)
            }
        },
        [axiosConfig, handleError],
    )

    const fetchFilesForMachines = useCallback(
        async (machines) => {
            if (!machines || machines.length === 0) return

            try {
                const filesPromises = machines.map(async (machine) => {
                    try {
                        const response = await axios.get(`http://localhost:8082/machines/${machine.id}/files`, {
                            ...axiosConfig,
                            timeout: 10000,
                        })
                        return { machineId: machine.id, files: response.data || [] }
                    } catch (error) {
                        console.warn(`Erro ao buscar arquivos para máquina ${machine.id}:`, error)
                        return { machineId: machine.id, files: [] }
                    }
                })

                const results = await Promise.allSettled(filesPromises)
                const filesMap = {}

                results.forEach((result) => {
                    if (result.status === "fulfilled") {
                        const { machineId, files } = result.value
                        filesMap[machineId] = files
                    }
                })

                setMachineFiles(filesMap)
            } catch (error) {
                console.error("Erro geral ao buscar arquivos:", error)
            }
        },
        [axiosConfig],
    )

    const fetchBrands = useCallback(async () => {
        try {
            const response = await axios.get("http://localhost:8082/brands", axiosConfig)
            setBrands(response.data || [])
        } catch (error) {
            handleError(error, "Erro ao buscar as marcas!")
            setBrands([])
        }
    }, [axiosConfig, handleError])

    useEffect(() => {
        fetchMachines()
        fetchBrands()
    }, [fetchMachines, fetchBrands])

    const handleView = useCallback(
        (row) => {
            if (expandedRows.includes(row.id)) {
                setExpandedRows((prev) => prev.filter((id) => id !== row.id))
            } else {
                fetchMachineParts(row.id)
                setExpandedRows((prev) => [...prev, row.id])
            }
        },
        [expandedRows],
    )

    const fetchMachineParts = useCallback(
        async (machineId) => {
            if (selectedMachineParts[machineId]) return

            setLoadingParts((prev) => ({ ...prev, [machineId]: true }))

            try {
                const response = await axios.get(`http://localhost:8082/machines/${machineId}/pecas`, axiosConfig)

                setSelectedMachineParts((prevState) => ({
                    ...prevState,
                    [machineId]: response.data || [],
                }))
            } catch (error) {
                handleError(error, "Erro ao buscar as peças!")
                setSelectedMachineParts((prevState) => ({
                    ...prevState,
                    [machineId]: [],
                }))
            } finally {
                setLoadingParts((prev) => ({ ...prev, [machineId]: false }))
            }
        },
        [selectedMachineParts, axiosConfig, handleError],
    )

    const handleBrandChange = useCallback(
        (brand) => {
            setSelectedBrand(brand)
            setExpandedRows([])
            setSelectedMachineParts({})
            fetchMachines(brand)
        },
        [fetchMachines],
    )

    const handleEdit = useCallback(
        (row) => {
            navigate(`/machines/edit/${row.id}`)
        },
        [navigate],
    )

    const handleDownload = useCallback(
        (row) => {
            const files = machineFiles[row.id]
            if (files && files.length > 0) {
                const file = files[0]
                const fileUrl = `http://localhost:8082/uploads/${encodeURIComponent(file.nome)}`

                // Criar um link temporário para download
                const link = document.createElement("a")
                link.href = fileUrl
                link.target = "_blank"
                link.rel = "noopener noreferrer"
                document.body.appendChild(link)
                link.click()
                document.body.removeChild(link)
            } else {
                alert("Nenhum arquivo encontrado para esta máquina.")
            }
        },
        [machineFiles],
    )

    const handleDelete = useCallback(
        async (row) => {
            const confirmMessage = `Tem certeza que deseja excluir a máquina "${row.modelo}" da marca "${row.marca}"?`

            if (window.confirm(confirmMessage)) {
                try {
                    await axios.delete(`http://localhost:8082/machines/${row.id}`, axiosConfig)
                    alert("Máquina excluída com sucesso.")

                    // Remover da lista local para atualização imediata
                    setMachines((prev) => prev.filter((machine) => machine.id !== row.id))

                    // Limpar dados relacionados
                    setSelectedMachineParts((prev) => {
                        const newState = { ...prev }
                        delete newState[row.id]
                        return newState
                    })

                    setMachineFiles((prev) => {
                        const newState = { ...prev }
                        delete newState[row.id]
                        return newState
                    })
                } catch (error) {
                    handleError(error, "Erro ao excluir a máquina.")
                }
            }
        },
        [axiosConfig, handleError],
    )

    const machineColumns = useMemo(
        () => [
            {
                name: "Ações",
                cell: (row) => (
                    <div className="d-flex">
                        <button
                            onClick={() => handleView(row)}
                            className="btn btn-primary btn-sm me-2"
                            title="Visualizar peças"
                            disabled={loading}
                        >
                            <i className="bi bi-eye"></i>
                        </button>
                        <button
                            onClick={() => handleEdit(row)}
                            className="btn btn-warning btn-sm me-2"
                            title="Editar máquina"
                            disabled={loading}
                        >
                            <i className="bi bi-pencil"></i>
                        </button>
                        {machineFiles[row.id] && machineFiles[row.id].length > 0 && (
                            <button
                                onClick={() => handleDownload(row)}
                                className="btn btn-success btn-sm me-2"
                                title="Baixar arquivo"
                                disabled={loading}
                            >
                                <i className="bi bi-download"></i>
                            </button>
                        )}
                        <button
                            onClick={() => handleDelete(row)}
                            className="btn btn-danger btn-sm"
                            title="Excluir máquina"
                            disabled={loading}
                        >
                            <i className="bi bi-trash"></i>
                        </button>
                    </div>
                ),
                ignoreRowClick: true,
                width: "200px",
            },
            {
                name: "Data",
                selector: (row) => {
                    try {
                        return new Date(row.date).toLocaleDateString("pt-PT")
                    } catch {
                        return "Data inválida"
                    }
                },
                sortable: true,
                width: "120px",
            },
            { name: "Tipo", selector: (row) => row.tipo || "N/A", sortable: true },
            { name: "Marca", selector: (row) => row.marca || "N/A", sortable: true },
            { name: "Modelo", selector: (row) => row.modelo || "N/A", sortable: true },
        ],
        [handleView, handleEdit, handleDownload, handleDelete, machineFiles, loading],
    )

    const partsColumns = useMemo(
        () => [
            { name: "Tipo de Peça", selector: (row) => row.tipopeca || "N/A", sortable: true },
            { name: "Marca", selector: (row) => row.marca || "N/A", sortable: true },
            { name: "Modelo da Máquina", selector: (row) => row.modelo_maquina || "N/A", sortable: true },
        ],
        [],
    )

    const exportToExcel = useCallback(() => {
        if (machines.length === 0) {
            alert("Não há dados para exportar.")
            return
        }

        try {
            const exportData = machines.map(({ id, ...rest }) => ({
                Data: new Date(rest.date).toLocaleDateString("pt-PT"),
                Tipo: rest.tipo || "N/A",
                Marca: rest.marca || "N/A",
                Modelo: rest.modelo || "N/A",
            }))

            const worksheet = XLSX.utils.json_to_sheet(exportData)
            const workbook = XLSX.utils.book_new()
            XLSX.utils.book_append_sheet(workbook, worksheet, "Maquinas")

            // Ajustar largura das colunas
            const colWidths = [
                { wch: 12 }, // Data
                { wch: 15 }, // Tipo
                { wch: 15 }, // Marca
                { wch: 20 }, // Modelo
            ]
            worksheet["!cols"] = colWidths

            const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
            const dataBlob = new Blob([excelBuffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            })

            const today = new Date().toLocaleDateString("pt-PT").replace(/\//g, "-")
            const filename = `Maquinas_${today}.xlsx`
            saveAs(dataBlob, filename)

            alert(`Arquivo ${filename} exportado com sucesso!`)
        } catch (error) {
            console.error("Erro ao exportar:", error)
            alert("Erro ao exportar dados para Excel.")
        }
    }, [machines])

    const ExpandableComponent = useCallback(
        ({ data }) => {
            const parts = selectedMachineParts[data.id] || []
            const isLoadingParts = loadingParts[data.id]

            if (isLoadingParts) {
                return (
                    <div className="p-3 text-center">
                        <div className="spinner-border spinner-border-sm me-2" role="status">
                            <span className="visually-hidden">Carregando...</span>
                        </div>
                        Carregando peças...
                    </div>
                )
            }

            if (parts.length === 0) {
                return <div className="p-3 text-center text-muted">Nenhuma peça encontrada para esta máquina.</div>
            }

            return (
                <div className="p-2">
                    <h6 className="mb-2">Peças da Máquina:</h6>
                    <DataTable columns={partsColumns} data={parts} dense noHeader />
                </div>
            )
        },
        [selectedMachineParts, loadingParts, partsColumns],
    )

    const CustomExpander = () => <div />

    return (
        <div className="home-container">
            {/* Header Section */}
            <div className="header-section">
                <div className="container">
                    <div className="row align-items-center">
                        <div className="col-md-8">
                            <div className="header-content">
                                <h1 className="page-title">
                                    <i className="bi bi-gear-fill me-3"></i>
                                    Registo de Máquinas
                                </h1>
                                <p className="page-subtitle">Gerencie e monitore todas as suas máquinas industriais</p>
                            </div>
                        </div>
                        <div className="col-md-4 text-md-end">
                            <div className="stats-card">
                                <div className="stats-number">{machines.length}</div>
                                <div className="stats-label">
                                    Máquina{machines.length !== 1 ? "s" : ""} Registrada{machines.length !== 1 ? "s" : ""}
                                </div>
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
                                    <button
                                        className="btn btn-primary btn-modern"
                                        onClick={() => fetchMachines(selectedBrand)}
                                        disabled={loading}
                                    >
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
                                        disabled={loading || machines.length === 0}
                                    >
                                        <i className="bi bi-file-earmark-excel me-2"></i>
                                        Exportar Excel
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="col-md-6">
                            <div className="control-group">
                                <label className="control-label">Filtrar por Marca</label>
                                <div className="filter-group">
                                    <DropdownButton
                                        id="dropdown-brand-filter"
                                        title={
                                            <span className="dropdown-title">
                                                <i className="bi bi-funnel-fill me-2"></i>
                                                {selectedBrand || "Todas as Marcas"}
                                            </span>
                                        }
                                        variant="outline-secondary"
                                        className="filter-dropdown"
                                        disabled={loading}
                                    >
                                        <Dropdown.Item onClick={() => handleBrandChange("")} active={!selectedBrand}>
                                            <i className="bi bi-list me-2"></i>
                                            Todas as Marcas
                                        </Dropdown.Item>
                                        <Dropdown.Divider />
                                        {brands.map((brand) => (
                                            <Dropdown.Item
                                                key={brand}
                                                onClick={() => handleBrandChange(brand)}
                                                active={selectedBrand === brand}
                                            >
                                                <i className="bi bi-tag me-2"></i>
                                                {brand}
                                            </Dropdown.Item>
                                        ))}
                                    </DropdownButton>

                                    {selectedBrand && (
                                        <button
                                            className="btn btn-outline-danger btn-sm ms-2"
                                            onClick={() => handleBrandChange("")}
                                            title="Limpar filtro"
                                        >
                                            <i className="bi bi-x-circle"></i>
                                        </button>
                                    )}
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
                                Lista de Máquinas
                            </h5>
                            {selectedBrand && (
                                <span className="filter-badge">
                                    <i className="bi bi-funnel me-1"></i>
                                    Filtrado por: {selectedBrand}
                                </span>
                            )}
                        </div>
                        <div className="table-body">
                            <DataTable
                                columns={machineColumns}
                                data={machines}
                                expandableRows
                                expandableRowsComponent={ExpandableComponent}
                                expandOnRowClicked
                                expandableRowExpanded={(row) => expandedRows.includes(row.id)}
                                expandableIcon={{ collapsed: <CustomExpander />, expanded: <CustomExpander /> }}
                                pagination
                                paginationPerPage={10}
                                paginationRowsPerPageOptions={[5, 10, 15, 20, 25]}
                                progressPending={loading}
                                progressComponent={
                                    <div className="loading-container">
                                        <div className="loading-spinner">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Carregando...</span>
                                            </div>
                                        </div>
                                        <p className="loading-text">Carregando máquinas...</p>
                                    </div>
                                }
                                noDataComponent={
                                    <div className="no-data-container">
                                        <div className="no-data-icon">
                                            <i className="bi bi-inbox"></i>
                                        </div>
                                        <h6 className="no-data-title">Nenhuma máquina encontrada</h6>
                                        <p className="no-data-text">
                                            {selectedBrand
                                                ? `Não há máquinas cadastradas para a marca "${selectedBrand}"`
                                                : "Não há máquinas cadastradas no sistema"}
                                        </p>
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

export default Home
