"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import axios from "axios"
import { useNavigate, useParams } from "react-router-dom"
import { cn } from "../lib/utils"
import {
  ArrowLeft,
  Copy,
  Search,
  Check,
  Trash2,
  Pencil,
  Plus,
  Loader2,
  AlertTriangle,
  Package,
  ChevronRight,
  X,
  FileText,
  CheckCircle,
  Euro,
} from "lucide-react"

const API_BASE_URL = "http://localhost:8082"

const formatCurrency = (val) =>
  Number(val || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })

const formatDate = (dateString) => {
  if (!dateString) return "—"
  try {
    return new Date(dateString).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  } catch {
    return "—"
  }
}

// ---------- Pequeno componente de linha de peça editável ----------
function PecaRow({ peca, idx, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false)

  if (peca.is_text) {
    return (
      <tr className="border-b border-border last:border-0">
        <td colSpan={6} className="px-4 py-3">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm text-muted-foreground italic focus:outline-none focus:ring-1 focus:ring-primary/30 rounded px-1"
              value={peca.texto || ""}
              onChange={e => onUpdate(idx, "texto", e.target.value)}
            />
            <button
              onClick={() => onRemove(idx)}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
              title="Remover"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        {editing ? (
          <input
            autoFocus
            className="w-full bg-background border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={peca.tipopeca || ""}
            onChange={e => onUpdate(idx, "tipopeca", e.target.value)}
            onBlur={() => setEditing(false)}
          />
        ) : (
          <button
            className="text-sm text-foreground font-medium text-left w-full hover:text-primary transition-colors"
            onClick={() => setEditing(true)}
          >
            {peca.tipopeca || <span className="text-muted-foreground italic">Tipo</span>}
          </button>
        )}
      </td>
      <td className="px-4 py-3">
        <input
          className="w-full bg-transparent border-b border-transparent hover:border-border focus:border-primary text-sm text-foreground focus:outline-none transition-colors"
          value={peca.marca || ""}
          onChange={e => onUpdate(idx, "marca", e.target.value)}
          placeholder="Marca"
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          min={1}
          className="w-16 bg-transparent border-b border-transparent hover:border-border focus:border-primary text-sm text-center text-foreground focus:outline-none transition-colors"
          value={peca.quantidade}
          onChange={e => onUpdate(idx, "quantidade", Number(e.target.value) || 1)}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          step="0.01"
          min={0}
          className="w-24 bg-transparent border-b border-transparent hover:border-border focus:border-primary text-sm text-right text-foreground focus:outline-none transition-colors"
          value={peca.preco_unitario}
          onChange={e => onUpdate(idx, "preco_unitario", Number(e.target.value) || 0)}
        />
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          step="0.01"
          min={0}
          max={100}
          className="w-16 bg-transparent border-b border-transparent hover:border-border focus:border-primary text-sm text-right text-foreground focus:outline-none transition-colors"
          value={peca.desconto_percentual || 0}
          onChange={e => onUpdate(idx, "desconto_percentual", Number(e.target.value) || 0)}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <span className="text-sm font-medium text-foreground font-mono">
            {formatCurrency(
              (Number(peca.preco_unitario) || 0) *
              (Number(peca.quantidade) || 1) *
              (1 - (Number(peca.desconto_percentual) || 0) / 100)
            )}
          </span>
          <button
            onClick={() => onRemove(idx)}
            className="ml-2 p-1 text-muted-foreground hover:text-destructive transition-colors"
            title="Remover artigo"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ---------- Componente de pesquisa de reparações ----------
function ReparacaoSearch({ label, value, onSelect, excludeId, placeholder = "Pesquisar por nº ou máquina..." }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [allReps, setAllReps] = useState([])
  const inputRef = useRef(null)

  useEffect(() => {
    axios.get(`${API_BASE_URL}/reparacoes`)
      .then(r => setAllReps(r.data || []))
      .catch(() => {})
  }, [])

  const pesquisar = useCallback((q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    const termo = q.toLowerCase()
    const filtrados = allReps
      .filter(r => r.id !== excludeId)
      .filter(r =>
        String(r.numreparacao || "").toLowerCase().includes(termo) ||
        (r.nomemaquina || "").toLowerCase().includes(termo) ||
        (r.cliente_nome || "").toLowerCase().includes(termo)
      )
      .slice(0, 8)
    setResults(filtrados)
    setOpen(filtrados.length > 0)
  }, [allReps, excludeId])

  const handleSelect = (rep) => {
    onSelect(rep)
    setQuery(`#${rep.numreparacao} — ${rep.nomemaquina}`)
    setOpen(false)
  }

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {value ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-success/10 border border-success/30 rounded-md">
          <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              #{value.numreparacao} — {value.nomemaquina}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {value.cliente_nome || "Sem cliente"} · Entrada: {formatDate(value.dataentrega)}
            </p>
          </div>
          <button
            onClick={() => onSelect(null)}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Alterar seleção"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            value={query}
            onChange={e => { setQuery(e.target.value); pesquisar(e.target.value) }}
            onFocus={() => query && pesquisar(query)}
          />
          {open && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
              {results.map(rep => (
                <button
                  key={rep.id}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors border-b border-border last:border-0"
                  onClick={() => handleSelect(rep)}
                >
                  <Package className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      <span className="font-mono text-primary">#{rep.numreparacao}</span>
                      {" "}— {rep.nomemaquina}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {rep.cliente_nome || "Sem cliente"} · {formatDate(rep.dataentrega)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ===================== COMPONENTE PRINCIPAL =====================
function CopiarArtigos() {
  const { id: origemIdParam } = useParams()
  const navigate = useNavigate()

  const [origemRep, setOrigemRep] = useState(null)
  const [destinoRep, setDestinoRep] = useState(null)
  const [artigos, setArtigos] = useState([])       // peças editáveis para copiar
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState("")
  const [sucesso, setSucesso] = useState("")
  const [step, setStep] = useState(1)               // 1: origem, 2: editar, 3: destino

  // Carrega automaticamente a origem se vier da view de reparação
  useEffect(() => {
    if (origemIdParam && !isNaN(origemIdParam)) {
      setLoading(true)
      Promise.all([
        axios.get(`${API_BASE_URL}/reparacoes/${origemIdParam}`),
        axios.get(`${API_BASE_URL}/reparacoes/${origemIdParam}/pecas`).catch(() => ({ data: [] }))
      ]).then(([repRes, pecasRes]) => {
        setOrigemRep(repRes.data)
        carregarPecasOrigem(pecasRes.data)
        setStep(2)
      }).catch(() => setErro("Erro ao carregar reparação de origem."))
        .finally(() => setLoading(false))
    }
  }, [origemIdParam])

  const carregarPecasOrigem = (pecasData) => {
    const formatadas = (pecasData || []).map(p => ({
      ...p,
      id: Date.now() + Math.random(), // novo id local para evitar conflitos
      quantidade: Number(p.quantidade) || 1,
      preco_unitario: Number(p.preco_unitario) || 0,
      desconto_percentual: Number(p.desconto_percentual) || 0,
    }))
    setArtigos(formatadas)
  }

  const handleSelecionarOrigem = async (rep) => {
    if (!rep) { setOrigemRep(null); setArtigos([]); setStep(1); return }
    setLoading(true)
    try {
      const [repRes, pecasRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/reparacoes/${rep.id}`),
        axios.get(`${API_BASE_URL}/reparacoes/${rep.id}/pecas`).catch(() => ({ data: [] }))
      ])
      setOrigemRep(repRes.data)
      carregarPecasOrigem(pecasRes.data)
      setStep(2)
    } catch {
      setErro("Erro ao carregar peças da reparação de origem.")
    } finally {
      setLoading(false)
    }
  }

  const updateArtigo = (idx, campo, valor) => {
    setArtigos(prev => prev.map((a, i) => i === idx ? { ...a, [campo]: valor } : a))
  }

  const removeArtigo = (idx) => {
    setArtigos(prev => prev.filter((_, i) => i !== idx))
  }

  const adicionarLinhaPeca = () => {
    setArtigos(prev => [...prev, {
      id: Date.now(),
      tipopeca: "", marca: "", quantidade: 1,
      preco_unitario: 0, desconto_percentual: 0,
      observacao: "", is_text: false
    }])
  }

  const adicionarLinhaTexto = () => {
    setArtigos(prev => [...prev, {
      id: Date.now(),
      is_text: true, texto: "Nota:", quantidade: 0, preco_unitario: 0
    }])
  }

  const totais = artigos.reduce((acc, p) => {
    if (p.is_text) return acc
    const subtotal = (Number(p.preco_unitario) || 0) * (Number(p.quantidade) || 1) * (1 - (Number(p.desconto_percentual) || 0) / 100)
    return { ...acc, total: acc.total + subtotal }
  }, { total: 0 })

  const executarCopia = async () => {
    if (!destinoRep) { setErro("Selecione uma reparação de destino."); return }
    if (artigos.length === 0) { setErro("Não há artigos para copiar."); return }

    setSaving(true)
    setErro("")
    setSucesso("")

    try {
      // Buscar peças actuais do destino
      const pecasAtualRes = await axios.get(`${API_BASE_URL}/reparacoes/${destinoRep.id}/pecas`).catch(() => ({ data: [] }))
      const pecasActuais = pecasAtualRes.data || []

      // Construir payload: peças actuais + novas
      const novasPecas = [
        ...pecasActuais,
        ...artigos.map((p, idx) => ({
          tipopeca: p.is_text ? null : (p.tipopeca || ""),
          marca: p.is_text ? "Texto" : (p.marca || ""),
          quantidade: p.is_text ? 0 : (Number(p.quantidade) || 1),
          preco_unitario: p.is_text ? 0 : (Number(p.preco_unitario) || 0),
          desconto_percentual: p.is_text ? 0 : (Number(p.desconto_percentual) || 0),
          tipo_desconto: "percentual",
          observacao: p.observacao || null,
          existe_no_sistema: p.existe_no_sistema || 0,
          is_text: p.is_text ? 1 : 0,
          texto: p.is_text ? p.texto : null,
          ordem: pecasActuais.length + idx + 1
        }))
      ]

      await axios.put(`${API_BASE_URL}/reparacoes/${destinoRep.id}/pecas`, {
        pecasNecessarias: novasPecas
      })

      setSucesso(`${artigos.length} artigo(s) copiado(s) com sucesso para a reparação #${destinoRep.numreparacao}!`)
      setStep(1)
      setOrigemRep(null)
      setDestinoRep(null)
      setArtigos([])
    } catch (e) {
      console.error(e)
      setErro("Erro ao copiar artigos. Verifique a ligação e tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">A carregar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="copiar-artigos">
      {/* Header */}
      <div className="flex items-center gap-4 pb-4 border-b border-border">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Copy className="w-6 h-6 text-primary" />
            Copiar Artigos entre Reparações
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Selecione a origem, edite os artigos e copie para o destino
          </p>
        </div>
      </div>

      {/* Alertas */}
      {erro && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {erro}
          <button className="ml-auto" onClick={() => setErro("")}><X className="w-4 h-4" /></button>
        </div>
      )}
      {sucesso && (
        <div className="flex items-center gap-2 p-4 bg-success/10 border border-success/30 rounded-md text-success text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {sucesso}
          <button className="ml-auto" onClick={() => setSucesso("")}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stepper visual */}
      <div className="flex items-center gap-2">
        {["Origem", "Editar Artigos", "Destino"].map((label, i) => {
          const n = i + 1
          const done = step > n
          const active = step === n
          return (
            <div key={n} className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                done ? "bg-success/10 text-success border border-success/30" :
                  active ? "bg-primary text-primary-foreground" :
                    "bg-muted text-muted-foreground"
              )}>
                <span className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs",
                  done ? "bg-success/20" : active ? "bg-white/20" : "bg-border"
                )}>
                  {done ? <Check className="w-3 h-3" /> : n}
                </span>
                {label}
              </div>
              {i < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* === PAINEL ESQUERDO: Origem + Destino === */}
        <div className="space-y-5">
          {/* Reparação de Origem */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/30">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">1</div>
              <h2 className="font-heading font-semibold text-foreground text-sm">Reparação de Origem</h2>
            </div>
            <div className="p-4">
              <ReparacaoSearch
                label="Selecionar origem"
                value={origemRep}
                onSelect={handleSelecionarOrigem}
                excludeId={destinoRep?.id}
                placeholder="Nº reparação ou máquina..."
              />
              {origemRep && (
                <div className="mt-3 pt-3 border-t border-border space-y-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{artigos.length}</span> artigo(s) carregado(s)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total origem: <span className="font-mono font-medium text-foreground">{formatCurrency(totais.total)}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Reparação de Destino */}
          {artigos.length > 0 && (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/30">
                <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center text-xs font-bold text-success-foreground">3</div>
                <h2 className="font-heading font-semibold text-foreground text-sm">Reparação de Destino</h2>
              </div>
              <div className="p-4">
                <ReparacaoSearch
                  label="Selecionar destino"
                  value={destinoRep}
                  onSelect={setDestinoRep}
                  excludeId={origemRep?.id}
                  placeholder="Nº reparação ou máquina..."
                />

                {destinoRep && (
                  <button
                    onClick={executarCopia}
                    disabled={saving}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {saving
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> A copiar...</>
                      : <><Copy className="w-4 h-4" /> Copiar {artigos.length} artigo(s)</>
                    }
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* === PAINEL DIREITO: Artigos editáveis === */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange flex items-center justify-center text-xs font-bold text-white">2</div>
                <h2 className="font-heading font-semibold text-foreground text-sm">Artigos a Copiar</h2>
                {artigos.length > 0 && (
                  <span className="px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground">
                    {artigos.length}
                  </span>
                )}
              </div>
              {origemRep && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={adicionarLinhaTexto}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Nota
                  </button>
                  <button
                    onClick={adicionarLinhaPeca}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Artigo
                  </button>
                </div>
              )}
            </div>

            {artigos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Copy className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  {origemRep ? "Nenhum artigo encontrado nesta reparação" : "Selecione uma reparação de origem"}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {origemRep ? "Adicione artigos manualmente com os botões acima" : "Para carregar os artigos e editá-los"}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo / Descrição</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Marca</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qtd</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">P. Unit.</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Desc %</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {artigos.map((peca, idx) => (
                        <PecaRow
                          key={peca.id}
                          peca={peca}
                          idx={idx}
                          onUpdate={updateArtigo}
                          onRemove={removeArtigo}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totais */}
                <div className="p-4 border-t border-border bg-muted/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Euro className="w-4 h-4" />
                      <span>Total dos artigos a copiar</span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-heading font-bold text-foreground">
                        {formatCurrency(totais.total)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        c/ IVA: {formatCurrency(totais.total * 1.23)}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CopiarArtigos
