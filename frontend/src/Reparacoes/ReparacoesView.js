"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import axios from "axios"
import { useNavigate, useParams } from "react-router-dom"
import { cn } from "../lib/utils"
import {
  ArrowLeft,
  Pencil,
  Trash2,
  FileDown,
  Loader2,
  Wrench,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  Package,
  Euro,
  AlertTriangle,
  FileText,
  Printer,
  Eye
} from "lucide-react"

const API_BASE_URL = "http://localhost:8082"

const formatCurrency = (value) => {
  if (!value || isNaN(value)) return "0,00 €"
  return Number(value).toLocaleString("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  })
}

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

const getStatusInfo = (reparacao) => {
  if (!reparacao) return { text: "Desconhecido", class: "bg-muted text-muted-foreground", icon: Clock }

  const estRep = reparacao.estadoreparacao?.toLowerCase() || ""

  if (estRep.includes("sem reparação") || estRep.includes("sem reparacao"))
    return { text: "Sem Reparação", class: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle }

  if (reparacao.datasaida) return { text: "Entregue", class: "bg-success/10 text-success border-success/30", icon: CheckCircle }
  if (reparacao.dataconclusao) return { text: "Pronta", class: "bg-info/10 text-info border-info/30", icon: Package }
  if (reparacao.dataentrega) return { text: "Em Andamento", class: "bg-orange/10 text-orange border-orange/30", icon: Clock }

  return { text: "Pendente", class: "bg-muted text-muted-foreground", icon: Clock }
}

function ReparacoesView() {
  const [reparacao, setReparacao] = useState(null)
  const [pecas, setPecas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [showPdfModal, setShowPdfModal] = useState(false)

  const navigate = useNavigate()
  const { id } = useParams()

  useEffect(() => {
    if (id && !isNaN(id)) {
      fetchDetalhesReparacao(id)
    } else {
      navigate("/reparacoes")
    }
  }, [id, navigate])

  const fetchDetalhesReparacao = async (reparacaoId) => {
    setLoading(true)
    setError("")
    try {
      const [repRes, pecasRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/reparacoes/${reparacaoId}`),
        axios.get(`${API_BASE_URL}/reparacoes/${reparacaoId}/pecas`).catch(() => ({ data: [] })) 
      ])

      if (repRes.data) {
        setReparacao(repRes.data)
        setPecas(Array.isArray(pecasRes.data) ? pecasRes.data : [])
      } else {
        setError("Reparação não encontrada")
      }
    } catch (err) {
      console.error("Erro ao carregar detalhes:", err)
      setError("Erro ao carregar detalhes da reparação")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Tem certeza que deseja excluir a reparação #${reparacao?.numreparacao}?`)) return

    try {
      await axios.delete(`${API_BASE_URL}/reparacoes/${id}`)
      navigate("/reparacoes")
    } catch (err) {
      console.error("Erro ao excluir:", err)
      alert("Erro ao excluir a reparação")
    }
  }, [id, reparacao, navigate])

  const handleGeneratePdf = useCallback(async (pages = 'all', action = 'view') => {
    if (!reparacao) return

    try {
      const response = await axios.get(`${API_BASE_URL}/reparacoes/${id}/pdf?pages=${pages}`, {
        responseType: 'blob'
      })

      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)

      if (action === 'download') {
        const link = document.createElement('a')
        link.href = url
        link.download = `Orcamento_${reparacao.numreparacao}.pdf`
        link.click()
      } else {
        window.open(url, '_blank')
      }

      window.URL.revokeObjectURL(url)
      setShowPdfModal(false)
    } catch (err) {
      console.error("Erro ao gerar PDF:", err)
      alert("Erro ao gerar o orçamento PDF")
    }
  }, [id, reparacao])

  const financeiros = useMemo(() => {
    if (!reparacao) return { totalPecas: 0, descontoTotal: 0, maoObra: 0, totalGeral: 0, totalComIva: 0 }

    let totalPecas = 0
    let descontoTotal = 0
    pecas.forEach(p => {
      if (p.is_text) return
      const pu = Number(p.preco_unitario) || 0
      const qtd = Number(p.quantidade) || 1
      const descPct = Number(p.desconto_percentual) || 0
      const precoComDesc = Math.max(0, pu * (1 - descPct / 100))
      totalPecas += (precoComDesc * qtd)
      descontoTotal += (pu * qtd * (descPct / 100))
    })

    const maoObra = Number(reparacao.mao_obra) || 0
    const totalGeral = totalPecas + maoObra

    return {
      totalPecas,
      descontoTotal,
      maoObra,
      totalGeral,
      totalComIva: totalGeral * 1.23
    }
  }, [reparacao, pecas])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="loading">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">A carregar detalhes...</p>
        </div>
      </div>
    )
  }

  if (error || !reparacao) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]" data-testid="error">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-xl font-heading font-bold text-foreground mb-2">Erro</h2>
        <p className="text-muted-foreground mb-4">{error || "Reparação não encontrada"}</p>
        <button
          onClick={() => navigate("/reparacoes")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          Voltar à Lista
        </button>
      </div>
    )
  }

  const status = getStatusInfo(reparacao)
  const StatusIcon = status.icon

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="repair-view">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/reparacoes")}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-heading font-bold text-foreground">{reparacao.nomemaquina}</h1>
              <span className="font-mono text-muted-foreground">#{reparacao.numreparacao}</span>
              <span className={cn("flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border", status.class)}>
                <StatusIcon className="w-3.5 h-3.5" />
                {status.text}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {reparacao.nomecentro && `${reparacao.nomecentro} • `}
              Entrada: {formatDate(reparacao.dataentrega)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPdfModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-md text-sm font-medium text-foreground hover:bg-muted transition-colors"
            data-testid="generate-pdf"
          >
            <FileDown className="w-4 h-4" />
            Orçamento PDF
          </button>
          <button
            onClick={() => navigate(`/reparacoes/edit/${id}`)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            data-testid="edit-repair"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>
          <button
            onClick={handleDelete}
            className="p-2.5 rounded-md border border-border text-destructive hover:bg-destructive/10 transition-colors"
            title="Excluir"
            data-testid="delete-repair"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {reparacao.descricao && (
            <div className="bg-card border border-border rounded-lg p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <h3 className="font-heading font-semibold text-foreground">Descrição da Avaria</h3>
              </div>
              <p className="text-foreground whitespace-pre-wrap">{reparacao.descricao}</p>
            </div>
          )}

          {/* Parts Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/30">
              <Package className="w-5 h-5 text-orange" />
              <h3 className="font-heading font-semibold text-foreground">Peças e Materiais</h3>
              <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                {pecas.filter(p => !p.is_text).length} itens
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left p-3 font-medium">Descrição</th>
                    <th className="text-left p-3 font-medium">Referência</th>
                    <th className="text-center p-3 font-medium">Qtd</th>
                    <th className="text-right p-3 font-medium">Preço Unit.</th>
                    <th className="text-right p-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pecas.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center py-8 text-muted-foreground">
                        Nenhuma peça registada
                      </td>
                    </tr>
                  )}
                  {pecas.map((peca, idx) => (
                    <tr key={peca.id || idx} className={cn(
                      "border-b border-border",
                      peca.is_text && "bg-muted/30"
                    )}>
                      {peca.is_text ? (
                        <td colSpan="5" className="p-3 italic text-muted-foreground">
                          <FileText className="w-4 h-4 inline mr-2" />
                          {peca.texto}
                        </td>
                      ) : (
                        <>
                          <td className="p-3 font-medium text-foreground">{peca.tipopeca}</td>
                          <td className="p-3 text-muted-foreground">{peca.marca}</td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 bg-muted rounded text-foreground">{peca.quantidade}</span>
                          </td>
                          <td className="p-3 text-right text-muted-foreground">
                            {peca.desconto_percentual > 0 && (
                              <span className="text-warning mr-1">-{peca.desconto_percentual}%</span>
                            )}
                            {formatCurrency(peca.preco_unitario)}
                          </td>
                          <td className="p-3 text-right font-medium text-foreground">
                            {formatCurrency((peca.preco_unitario * (1 - (peca.desconto_percentual / 100))) * peca.quantidade)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Card */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/30">
              <User className="w-5 h-5 text-primary" />
              <h3 className="font-heading font-semibold text-foreground">Cliente</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-heading font-bold">
                  {reparacao.cliente_nome?.charAt(0).toUpperCase() || "?"}
                </div>
                <div>
                  <p className="font-medium text-foreground">{reparacao.cliente_nome}</p>
                  {reparacao.cliente_nif && (
                    <p className="text-xs text-muted-foreground font-mono">NIF: {reparacao.cliente_nif}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-border">
                {reparacao.cliente_telefone && (
                  <a
                    href={`tel:${reparacao.cliente_telefone}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Phone className="w-4 h-4" />
                    {reparacao.cliente_telefone}
                  </a>
                )}
                {reparacao.cliente_email && (
                  <a
                    href={`mailto:${reparacao.cliente_email}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    {reparacao.cliente_email}
                  </a>
                )}
                {reparacao.cliente_morada && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{reparacao.cliente_morada}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Timeline Card */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/30">
              <Calendar className="w-5 h-5 text-info" />
              <h3 className="font-heading font-semibold text-foreground">Datas</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Entrada</span>
                <span className="text-sm font-medium text-foreground">{formatDate(reparacao.dataentrega)}</span>
              </div>
              {reparacao.dataconclusao && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Conclusão</span>
                  <span className="text-sm font-medium text-foreground">{formatDate(reparacao.dataconclusao)}</span>
                </div>
              )}
              {reparacao.datasaida && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Entrega</span>
                  <span className="text-sm font-medium text-success">{formatDate(reparacao.datasaida)}</span>
                </div>
              )}

              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Estado Orçamento</span>
                  <span className="text-xs px-2 py-1 bg-muted rounded text-foreground">
                    {reparacao.estadoorcamento || "Pendente"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Estado Reparação</span>
                  <span className="text-xs px-2 py-1 bg-muted rounded text-foreground">
                    {reparacao.estadoreparacao || "Pendente"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-primary text-primary-foreground rounded-lg overflow-hidden">
            <div className="p-4 border-b border-white/20">
              <div className="flex items-center gap-2">
                <Euro className="w-5 h-5" />
                <h3 className="font-heading font-semibold">Resumo Financeiro</h3>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Total Peças</span>
                <span className="font-medium">{formatCurrency(financeiros.totalPecas)}</span>
              </div>
              {financeiros.descontoTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Desconto Total</span>
                  <span className="font-medium text-white">-{formatCurrency(financeiros.descontoTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Mão de Obra</span>
                <span className="font-medium">{formatCurrency(financeiros.maoObra)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Total s/ IVA</span>
                <span className="font-medium">{formatCurrency(financeiros.totalGeral)}</span>
              </div>
              <div className="pt-3 border-t border-white/20 flex justify-between items-center">
                <span>Total c/ IVA</span>
                <span className="text-2xl font-heading font-bold">{formatCurrency(financeiros.totalComIva)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="pdf-modal">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setShowPdfModal(false)}
          />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-lg shadow-xl p-6 animate-fadeIn">
            <h3 className="text-lg font-heading font-bold text-foreground mb-4 text-center">
              Gerar Orçamento PDF
            </h3>
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground text-center mb-2">
                Escolha as páginas e a ação desejada:
              </p>

              {/* Opção: Completo */}
              <div className="flex flex-col gap-2 p-3 bg-muted/30 border border-border rounded-lg">
                <span className="text-sm font-medium text-center text-foreground">(Orçamento + Aprovação)</span>
                <div className="flex gap-2">
                  <button onClick={() => handleGeneratePdf('all', 'view')} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors">
                    <Eye className="w-4 h-4" /> Visualizar
                  </button>
                  <button onClick={() => handleGeneratePdf('all', 'download')} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-card border border-border text-foreground rounded-md text-xs font-medium hover:bg-muted transition-colors">
                    <FileDown className="w-4 h-4" /> Download
                  </button>
                </div>
              </div>

              {/* Opção: Pág 1 */}
              <div className="flex flex-col gap-2 p-3 bg-muted/30 border border-border rounded-lg">
                <span className="text-sm font-medium text-center text-foreground">Orçamento (Pág. 1)</span>
                <div className="flex gap-2">
                  <button onClick={() => handleGeneratePdf('1', 'view')} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors">
                    <Eye className="w-4 h-4" /> Visualizar
                  </button>
                  <button onClick={() => handleGeneratePdf('1', 'download')} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-card border border-border text-foreground rounded-md text-xs font-medium hover:bg-muted transition-colors">
                    <FileDown className="w-4 h-4" /> Download
                  </button>
                </div>
              </div>

              {/* Opção: Pág 2 */}
              <div className="flex flex-col gap-2 p-3 bg-muted/30 border border-border rounded-lg">
                <span className="text-sm font-medium text-center text-foreground">Folha de Aprovação (Pág. 2)</span>
                <div className="flex gap-2">
                  <button onClick={() => handleGeneratePdf('2', 'view')} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors">
                    <Eye className="w-4 h-4" /> Visualizar
                  </button>
                  <button onClick={() => handleGeneratePdf('2', 'download')} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-card border border-border text-foreground rounded-md text-xs font-medium hover:bg-muted transition-colors">
                    <FileDown className="w-4 h-4" /> Download
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowPdfModal(false)}
                className="px-4 py-2 mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReparacoesView
