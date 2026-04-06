"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import axios from "axios"
import DataTable from "react-data-table-component"
import { useNavigate } from "react-router-dom"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { cn } from "../lib/utils"
import {
  Plus,
  Search,
  FileDown,
  Pencil,
  Trash2,
  Clock,
  CheckCircle,
  Package,
  Folder,
  Filter,
  XCircle,
  Copy
} from "lucide-react"

const API_BASE_URL = "http://localhost:8082"

const customStyles = {
  table: {
    style: {
      backgroundColor: 'transparent',
    },
  },
  headRow: {
    style: {
      backgroundColor: "rgb(var(--muted))",
      borderBottomWidth: "1px",
      borderBottomColor: "rgb(var(--border))",
      minHeight: "48px",
    },
  },
  headCells: {
    style: {
      color: "rgb(var(--muted-foreground))",
      fontSize: "0.75rem",
      fontWeight: "600",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      fontFamily: "Barlow Condensed, sans-serif",
    },
  },
  rows: {
    style: {
      minHeight: "56px",
      backgroundColor: "rgb(var(--card))",
      borderBottomColor: "rgb(var(--border))",
      "&:hover": {
        backgroundColor: "rgb(var(--muted) / 0.5)",
        cursor: "pointer",
      },
      transition: "background-color 150ms ease",
    },
  },
  cells: {
    style: {
      color: "rgb(var(--foreground))",
    },
  },
  pagination: {
    style: {
      backgroundColor: "rgb(var(--card))",
      borderTop: "1px solid rgb(var(--border))",
      color: "rgb(var(--foreground))",
    },
    pageButtonsStyle: {
      color: "rgb(var(--foreground))",
      fill: "rgb(var(--foreground))",
      "&:disabled": {
        color: "rgb(var(--muted-foreground))",
        fill: "rgb(var(--muted-foreground))",
      },
      "&:hover:not(:disabled)": {
        backgroundColor: "rgb(var(--muted))",
      },
    },
  },
  noData: {
    style: {
      backgroundColor: "rgb(var(--card))",
      color: "rgb(var(--muted-foreground))",
    },
  },
}

function removerAcentos(str) {
  if (!str) return ""
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function ReparacoesView() {
  const [reparacoes, setReparacoes] = useState([])
  const [centros, setCentros] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem("reparacoesSearchTerm") || "")
  const [filterStatus, setFilterStatus] = useState(() => sessionStorage.getItem("reparacoesFilterStatus") || "all")
  const [selectedCentro, setSelectedCentro] = useState(() => sessionStorage.getItem("reparacoesSelectedCentro") || "all")
  const [currentPage, setCurrentPage] = useState(() => Number(sessionStorage.getItem("reparacoesCurrentPage")) || 1)
  const [perPage, setPerPage] = useState(() => Number(sessionStorage.getItem("reparacoesPerPage")) || 10)

  useEffect(() => {
    sessionStorage.setItem("reparacoesSearchTerm", searchTerm)
    sessionStorage.setItem("reparacoesFilterStatus", filterStatus)
    sessionStorage.setItem("reparacoesSelectedCentro", selectedCentro)
  }, [searchTerm, filterStatus, selectedCentro])

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
        const [repResponse, centrosResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/reparacoes`),
          axios.get(`${API_BASE_URL}/centros`)
        ])
        setReparacoes(Array.isArray(repResponse.data) ? repResponse.data : [])
        setCentros(Array.isArray(centrosResponse.data) ? centrosResponse.data : [])
      } catch (error) {
        console.error("Erro ao carregar dados:", error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleDelete = useCallback(async (row, e) => {
    e.stopPropagation()
    if (!window.confirm("Tem certeza que deseja deletar esta reparação?")) return

    try {
      await axios.delete(`${API_BASE_URL}/reparacoes/${row.id}`)
      setReparacoes(prev => prev.filter(r => r.id !== row.id))
    } catch (error) {
      alert("Erro ao deletar a reparação")
    }
  }, [])

  const getStatus = useCallback((reparacao) => {
    if (reparacao.datasaida) return "entregue"
    if (reparacao.dataconclusao) return "pronta"
    const statusRep = reparacao.estadoreparacao?.toLowerCase() || ""
    const statusOrc = reparacao.estadoorcamento?.toLowerCase() || ""
    if (statusRep.includes("sem reparação") || statusOrc.includes("recusado")) return "sem_reparacao"
    if (reparacao.dataentrega) return "andamento"
    return "pendente"
  }, [])

  const filteredReparacoes = useMemo(() => {
    const termoLimpo = removerAcentos(searchTerm)
    return reparacoes.filter((reparacao) => {
      if (filterStatus !== "all" && getStatus(reparacao) !== filterStatus) return false
      if (selectedCentro !== "all" && reparacao.nomecentro !== selectedCentro) return false
      if (!termoLimpo) return true
      return (
        removerAcentos(reparacao.nomemaquina).includes(termoLimpo) ||
        removerAcentos(reparacao.nomecentro).includes(termoLimpo) ||
        removerAcentos(reparacao.cliente_nome).includes(termoLimpo) ||
        removerAcentos(reparacao.numreparacao?.toString()).includes(termoLimpo)
      )
    }).sort((a, b) => {
      const numA = a.numreparacao ? String(a.numreparacao) : ""
      const numB = b.numreparacao ? String(b.numreparacao) : ""
      return numB.localeCompare(numA, undefined, { numeric: true })
    })
  }, [reparacoes, searchTerm, filterStatus, selectedCentro, getStatus])

  const stats = useMemo(() => {
    const initialStats = { total: 0, andamento: 0, pronta: 0, entregue: 0 }
    return reparacoes.reduce((acc, curr) => {
      acc.total++
      if (curr.datasaida) acc.entregue++
      else if (curr.dataconclusao) acc.pronta++
      else acc.andamento++
      return acc
    }, initialStats)
  }, [reparacoes])

  const statCardsConfig = [
    { value: stats.andamento, label: "Em Andamento", icon: Clock, color: "orange" },
    { value: stats.pronta, label: "Prontas", icon: CheckCircle, color: "info" },
    { value: stats.entregue, label: "Entregues", icon: Package, color: "success" },
    { value: stats.total, label: "Total", icon: Folder, color: "primary" },
  ]

  const statusConfig = {
    entregue: { label: "Entregue", class: "bg-success/10 text-success border-success/30" },
    pronta: { label: "Pronta", class: "bg-info/10 text-info border-info/30" },
    andamento: { label: "Em Andamento", class: "bg-orange/10 text-orange border-orange/30" },
    pendente: { label: "Pendente", class: "bg-muted text-muted-foreground border-border" },
    sem_reparacao: { label: "Sem Reparação", class: "bg-destructive/10 text-destructive border-destructive/30" },
  }

  const columns = useMemo(() => [
    {
      name: "Status",
      selector: row => getStatus(row),
      cell: row => {
        const status = getStatus(row)
        const config = statusConfig[status] || statusConfig.pendente
        return (
          <span className={cn("px-2.5 py-1 text-xs font-medium rounded-md border", config.class)}>
            {config.label}
          </span>
        )
      },
      sortable: true,
      width: "140px",
    },
    {
      name: "Nº Rep.",
      selector: row => row.numreparacao,
      cell: row => <span className="font-mono font-medium text-foreground">{row.numreparacao || "-"}</span>,
      sortable: true,
      width: "100px",
    },
    {
      name: "Cliente",
      selector: row => row.cliente_nome,
      cell: row => <span className="text-foreground font-medium">{row.cliente_nome}</span>,
      sortable: true,
      wrap: true,
    },
    {
      name: "Máquina",
      selector: row => row.nomemaquina,
      cell: row => <span className="text-muted-foreground">{row.nomemaquina}</span>,
      sortable: true,
      wrap: true,
    },
    {
      name: "Centro",
      selector: row => row.nomecentro,
      cell: row => <span className="text-muted-foreground">{row.nomecentro || "-"}</span>,
      sortable: true,
      hide: "md",
    },
    {
      name: "Entrada",
      selector: row => row.dataentrega,
      cell: row => (
        <span className="text-muted-foreground text-sm">
          {row.dataentrega ? new Date(row.dataentrega).toLocaleDateString("pt-PT") : "-"}
        </span>
      ),
      sortable: true,
      width: "110px",
    },
    {
      name: "Conclusão",
      selector: row => row.dataconclusao,
      cell: row => (
        <span className="text-muted-foreground text-sm">
          {row.dataconclusao ? new Date(row.dataconclusao).toLocaleDateString("pt-PT") : "-"}
        </span>
      ),
      sortable: true,
      width: "110px",
    },
    {
      name: "Ações",
      width: "100px",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/reparacoes/edit/${row.id}`) }}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
            title="Editar"
            data-testid={`edit-repair-${row.id}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => handleDelete(row, e)}
            className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Deletar"
            data-testid={`delete-repair-${row.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
      ignoreRowClick: true,
    },
  ], [handleDelete, navigate, getStatus])

  const handleExportPDF = () => {
    const doc = new jsPDF()
    const centerName = selectedCentro === 'all' ? 'Todos os Centros' : selectedCentro

    doc.setFontSize(16)
    doc.text(`Listagem de Reparações - ${centerName}`, 14, 15)
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Gerado em: ${new Date().toLocaleDateString()} às ${new Date().toLocaleTimeString()}`, 14, 22)

    const tableColumn = ["Nº Rep", "Cliente", "Máquina", "Centro", "Entrada", "Conclusão", "Status"]
    const tableRows = []

    filteredReparacoes.forEach(reparacao => {
      const statusId = getStatus(reparacao)
      const statusLabel = statusConfig[statusId]?.label || "Pendente"
      tableRows.push([
        reparacao.numreparacao || "",
        reparacao.cliente_nome || "",
        reparacao.nomemaquina || "",
        reparacao.nomecentro || "",
        reparacao.dataentrega ? new Date(reparacao.dataentrega).toLocaleDateString('pt-PT') : "-",
        reparacao.dataconclusao ? new Date(reparacao.dataconclusao).toLocaleDateString('pt-PT') : "-",
        statusLabel
      ])
    })

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 122, 255] },
      alternateRowStyles: { fillColor: [245, 245, 245] }
    })

    doc.save(`reparacoes_${centerName.replace(/ /g, "_").toLowerCase()}.pdf`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="repairs-loading">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">A carregar reparações...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="repairs-list">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Reparações</h1>
          <p className="text-muted-foreground mt-1">Gestão de reparações e manutenções</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
            data-testid="export-pdf"
          >
            <FileDown className="w-4 h-4" />
            Exportar PDF
          </button>
          <button
            onClick={() => navigate("/reparacoes/copiar")}
            className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
            data-testid="copiar-artigos"
          >
            <Copy className="w-4 h-4" />
            Copiar Artigos
          </button>
          <button
            onClick={() => navigate("/reparacoes/registo")}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="new-repair"
          >
            <Plus className="w-4 h-4" />
            Nova Reparação
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCardsConfig.map((card, index) => {
          const Icon = card.icon
          const colorClasses = {
            orange: "bg-orange/10 text-orange border-orange/20",
            info: "bg-info/10 text-info border-info/20",
            success: "bg-success/10 text-success border-success/20",
            primary: "bg-primary/10 text-primary border-primary/20",
          }
          return (
            <div key={index} className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-heading font-bold text-foreground">{card.value}</p>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                </div>
                <div className={cn("p-2.5 rounded-lg border", colorClasses[card.color])}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters & Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-border">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Pesquisar por cliente, máquina ou número..."
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="search-input"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  className="px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  value={selectedCentro}
                  onChange={(e) => setSelectedCentro(e.target.value)}
                  data-testid="filter-centro"
                >
                  <option value="all">Todos os Centros</option>
                  {centros.map(c => (
                    <option key={c.id} value={c.nome}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <select
                className="px-3 py-2.5 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                data-testid="filter-status"
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
        </div>

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={filteredReparacoes}
          pagination
          paginationPerPage={perPage}
          paginationRowsPerPageOptions={[10, 15, 20, 30]}
          paginationDefaultPage={currentPage}
          onChangePage={setCurrentPage}
          onChangeRowsPerPage={setPerPage}
          highlightOnHover
          pointerOnHover
          onRowClicked={(row) => navigate(`/reparacoes/view/${row.id}`)}
          responsive
          customStyles={customStyles}
          noDataComponent={
            <div className="py-12 text-center">
              <XCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhuma reparação encontrada</p>
            </div>
          }
        />
      </div>
    </div>
  )
}

export default ReparacoesView
