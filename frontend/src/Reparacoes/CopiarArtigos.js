"use client"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
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
  Wrench,
} from "lucide-react"

const API_BASE_URL = "http://localhost:8082"

const formatCurrency = (val) =>
  Number(val || 0).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })

const formatDate = (dateString) => {
  if (!dateString) return "—"
  try {
    return new Date(dateString).toLocaleDateString("pt-PT", {
      day: "2-digit", month: "2-digit", year: "numeric",
    })
  } catch { return "—" }
}

// ─────────────────────────────────────────────
// Pesquisa de reparação (origem ou destino)
// Usa position:fixed para o dropdown para evitar
// ser cortado por qualquer overflow:hidden pai.
// ─────────────────────────────────────────────
function ReparacaoSearch({ label, value, onSelect, excludeId }) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [allReps, setAllReps] = useState([])
  const [dropdownStyle, setDropdownStyle] = useState({})
  const inputRef = useRef(null)
  const wrapperRef = useRef(null)

  useEffect(() => {
    axios.get(`${API_BASE_URL}/reparacoes`)
      .then(r => setAllReps(Array.isArray(r.data) ? r.data : []))
      .catch(() => { })
  }, [])

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Recalcular posição do dropdown quando abre (fixed, relativo ao input)
  const calcularPosicao = useCallback(() => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    })
  }, [])

  const pesquisar = useCallback((q) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    const t = q.toLowerCase()
    const filtrados = allReps
      .filter(r => String(r.id) !== String(excludeId))
      .filter(r =>
        String(r.numreparacao || "").toLowerCase().includes(t) ||
        (r.nomemaquina || "").toLowerCase().includes(t) ||
        (r.cliente_nome || "").toLowerCase().includes(t)
      )
      .slice(0, 8)
    setResults(filtrados)
    if (filtrados.length > 0) {
      calcularPosicao()
      setOpen(true)
    } else {
      setOpen(false)
    }
  }, [allReps, excludeId, calcularPosicao])

  const handleSelect = (rep) => {
    onSelect(rep)
    setQuery(`#${rep.numreparacao} — ${rep.nomemaquina}`)
    setOpen(false)
  }

  const handleClear = () => {
    onSelect(null)
    setQuery("")
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={wrapperRef}>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {value ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-success/10 border border-success/30 rounded-md">
          <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              <span className="font-mono text-primary">#{value.numreparacao}</span> — {value.nomemaquina}
            </p>
            <p className="text-xs text-muted-foreground">
              {value.cliente_nome || "Sem cliente"} · Entrada: {formatDate(value.dataentrega)}
            </p>
          </div>
          <button
            onClick={handleClear}
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
            placeholder="Pesquisar por nº, máquina ou cliente..."
            className="w-full pl-9 pr-4 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            value={query}
            onChange={e => { setQuery(e.target.value); pesquisar(e.target.value) }}
            onFocus={() => { if (query) pesquisar(query) }}
          />
          {open && results.length > 0 && (
            // Renderizado fora do fluxo normal (fixed) para não ser cortado por overflow:hidden
            <div
              style={dropdownStyle}
              className="bg-popover border border-border rounded-md shadow-xl overflow-hidden max-h-72 overflow-y-auto"
            >
              {results.map(rep => (
                <button
                  key={rep.id}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted transition-colors border-b border-border last:border-0"
                  onMouseDown={e => e.preventDefault()} // evita blur antes do click
                  onClick={() => handleSelect(rep)}
                >
                  <Wrench className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      <span className="font-mono text-primary">#{rep.numreparacao}</span> — {rep.nomemaquina}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {rep.cliente_nome || "Sem cliente"} · {formatDate(rep.dataentrega)}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────
function CopiarArtigos() {
  const { id: origemIdParam } = useParams()
  const navigate = useNavigate()

  const [origemRep, setOrigemRep] = useState(null)
  const [destinoRep, setDestinoRep] = useState(null)
  const [pecas, setPecas] = useState([])
  const [pecasExistentes, setPecasExistentes] = useState([])

  const novaPecaInicial = {
    tipopeca: "", marca: "", quantidade: 1,
    preco_unitario: 0, desconto_percentual: 0,
    tipo_desconto: "percentual", observacao: ""
  }
  const [novaPeca, setNovaPeca] = useState(novaPecaInicial)
  const [editingId, setEditingId] = useState(null)
  const [showTextoInput, setShowTextoInput] = useState(false)
  const [textoNota, setTextoNota] = useState("")
  const tipoPecaInputRef = useRef(null)

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState("")
  const [sucesso, setSucesso] = useState("")
  const [ultimoDestinoId, setUltimoDestinoId] = useState(null)

  useEffect(() => {
    axios.get(`${API_BASE_URL}/pecas`)
      .then(r => setPecasExistentes(Array.isArray(r.data) ? r.data : []))
      .catch(() => { })
  }, [])

  useEffect(() => {
    if (origemIdParam && !isNaN(origemIdParam)) {
      setLoading(true)
      Promise.all([
        axios.get(`${API_BASE_URL}/reparacoes/${origemIdParam}`),
        axios.get(`${API_BASE_URL}/reparacoes/${origemIdParam}/pecas`).catch(() => ({ data: [] }))
      ])
        .then(([repRes, pecasRes]) => {
          setOrigemRep(repRes.data)
          carregarPecas(pecasRes.data)
        })
        .catch(() => setErro("Erro ao carregar reparação de origem."))
        .finally(() => setLoading(false))
    }
  }, [origemIdParam])

  const carregarPecas = (data) => {
    const formatadas = (data || []).map(p => ({
      ...p,
      _id: `${Date.now()}-${Math.random()}`,
      quantidade: Number(p.quantidade) || 1,
      preco_unitario: Number(p.preco_unitario) || 0,
      desconto_percentual: Number(p.desconto_percentual) || 0,
      existeNoSistema: p.existe_no_sistema === 1,
    }))
    setPecas(formatadas)
  }

  const handleSelecionarOrigem = async (rep) => {
    if (!rep) { setOrigemRep(null); setPecas([]); return }
    setLoading(true)
    setErro("")
    try {
      const [repRes, pecasRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/reparacoes/${rep.id}`),
        axios.get(`${API_BASE_URL}/reparacoes/${rep.id}/pecas`).catch(() => ({ data: [] }))
      ])
      setOrigemRep(repRes.data)
      carregarPecas(pecasRes.data)
    } catch {
      setErro("Erro ao carregar peças da reparação de origem.")
    } finally {
      setLoading(false)
    }
  }

  const validarPeca = () => {
    if (!novaPeca.tipopeca || !novaPeca.marca) {
      alert("Preencha o tipo e a referência da peça.")
      return false
    }
    return true
  }

  const gerirPeca = () => {
    if (!validarPeca()) return
    const existeNoSistema = !!pecasExistentes.find(
      p => p.tipopeca === novaPeca.tipopeca && p.marca === novaPeca.marca
    )
    const dados = {
      ...novaPeca,
      quantidade: Number(novaPeca.quantidade) || 1,
      preco_unitario: Number(novaPeca.preco_unitario) || 0,
      desconto_percentual: Number(novaPeca.desconto_percentual) || 0,
      existeNoSistema,
    }
    if (editingId) {
      setPecas(prev => prev.map(p => p._id === editingId ? { ...dados, _id: editingId } : p))
      setEditingId(null)
    } else {
      setPecas(prev => [...prev, { ...dados, _id: `${Date.now()}-${Math.random()}` }])
    }
    setNovaPeca(novaPecaInicial)
    setTimeout(() => tipoPecaInputRef.current?.focus(), 100)
  }

  const iniciarEdicao = (peca) => {
    if (peca.is_text) return
    setEditingId(peca._id)
    setNovaPeca({
      tipopeca: peca.tipopeca || "",
      marca: peca.marca || "",
      quantidade: peca.quantidade,
      preco_unitario: peca.preco_unitario,
      desconto_percentual: peca.desconto_percentual,
      tipo_desconto: "percentual",
      observacao: peca.observacao || ""
    })
    tipoPecaInputRef.current?.focus()
  }

  const cancelarEdicao = () => {
    setEditingId(null)
    setNovaPeca(novaPecaInicial)
  }

  const removerPeca = (_id) => {
    setPecas(prev => prev.filter(p => p._id !== _id))
    if (editingId === _id) cancelarEdicao()
  }

  const adicionarTexto = (e) => {
    if (e) e.preventDefault()
    setShowTextoInput(true)
    setTimeout(() => document.getElementById("textoNotaInputCopiar")?.focus(), 100)
  }

  const confirmarTexto = () => {
    if (textoNota.trim()) {
      setPecas(prev => [...prev, {
        _id: `${Date.now()}-${Math.random()}`,
        is_text: true, texto: textoNota,
        quantidade: 0, preco_unitario: 0
      }])
      setTextoNota("")
      setShowTextoInput(false)
    }
  }

  const financeiros = useMemo(() => {
    let total = 0
    pecas.forEach(p => {
      if (p.is_text) return
      const pu = Number(p.preco_unitario) || 0
      const qtd = Number(p.quantidade) || 1
      const desc = Number(p.desconto_percentual) || 0
      total += pu * qtd * (1 - desc / 100)
    })
    return { total, totalIva: total * 1.23 }
  }, [pecas])

  const pecasSimilares = pecasExistentes
    .filter(p => novaPeca.tipopeca && p.tipopeca?.toLowerCase().includes(novaPeca.tipopeca.toLowerCase()))
    .slice(0, 5)

  const executarCopia = async () => {
    if (!destinoRep) { setErro("Selecione uma reparação de destino."); return }
    if (pecas.length === 0) { setErro("Não há artigos para copiar."); return }
    setSaving(true)
    setErro("")
    setSucesso("")
    try {
      const { data: pecasActuais } = await axios
        .get(`${API_BASE_URL}/reparacoes/${destinoRep.id}/pecas`)
        .catch(() => ({ data: [] }))

      const novasPecas = [
        ...pecasActuais,
        ...pecas.map((p, idx) => ({
          tipopeca: p.is_text ? null : (p.tipopeca || ""),
          marca: p.is_text ? "Texto" : (p.marca || ""),
          quantidade: p.is_text ? 0 : (Number(p.quantidade) || 1),
          preco_unitario: p.is_text ? 0 : (Number(p.preco_unitario) || 0),
          desconto_percentual: p.is_text ? 0 : (Number(p.desconto_percentual) || 0),
          tipo_desconto: "percentual",
          observacao: p.observacao || null,
          existe_no_sistema: p.existeNoSistema ? 1 : 0,
          is_text: p.is_text ? 1 : 0,
          texto: p.is_text ? p.texto : null,
          ordem: (pecasActuais.length) + idx + 1
        }))
      ]

      await axios.put(`${API_BASE_URL}/reparacoes/${destinoRep.id}/pecas`, {
        pecasNecessarias: novasPecas
      })

      setUltimoDestinoId(destinoRep.id)
      setSucesso(`${pecas.length} artigo(s) copiado(s) com sucesso para a reparação #${destinoRep.numreparacao}!`)
      setPecas([])
      setOrigemRep(null)
      setDestinoRep(null)
      setNovaPeca(novaPecaInicial)
    } catch (e) {
      console.error(e)
      setErro("Erro ao copiar artigos. Verifique a ligação e tente novamente.")
    } finally {
      setSaving(false)
    }
  }

  // ─── RENDER ───
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">A carregar reparação...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="copiar-artigos">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-4">
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
              Selecione a origem, edite os artigos e copie-os para o destino
            </p>
          </div>
        </div>
        {destinoRep && pecas.length > 0 && (
          <button
            onClick={executarCopia}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            data-testid="btn-copiar-header"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> A copiar...</>
              : <><Copy className="w-4 h-4" /> Copiar {pecas.length} artigo(s) → #{destinoRep.numreparacao}</>
            }
          </button>
        )}
      </div>

      {/* Alertas */}
      {erro && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{erro}</span>
          <button onClick={() => setErro("")}><X className="w-4 h-4" /></button>
        </div>
      )}
      {sucesso && (
        <div className="flex items-center gap-2 p-4 bg-success/10 border border-success/30 rounded-md text-success text-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{sucesso}</span>
          {ultimoDestinoId && (
            <button
              onClick={() => navigate(`/reparacoes/view/${ultimoDestinoId}`)}
              className="text-xs underline underline-offset-2 hover:opacity-80 whitespace-nowrap"
            >
              Ver reparação destino →
            </button>
          )}
          <button onClick={() => setSucesso("")}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── SIDEBAR ── */}
        <div className="space-y-5">

          {/* Origem */}
          <div className="bg-card border border-border rounded-lg">
            <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/30 rounded-t-lg">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground flex-shrink-0">1</div>
              <h2 className="font-heading font-semibold text-foreground text-sm">Reparação de Origem</h2>
            </div>
            <div className="p-4 space-y-3">
              <ReparacaoSearch
                label="Selecionar origem"
                value={origemRep}
                onSelect={handleSelecionarOrigem}
                excludeId={destinoRep?.id}
              />
              {origemRep && pecas.length > 0 && (
                <div className="pt-2 border-t border-border space-y-1 text-xs text-muted-foreground">
                  <p>
                    <span className="font-medium text-foreground">{pecas.filter(p => !p.is_text).length}</span> peça(s) ·{" "}
                    <span className="font-medium text-foreground">{pecas.filter(p => p.is_text).length}</span> nota(s)
                  </p>
                  <p>
                    Total: <span className="font-mono font-medium text-foreground">{formatCurrency(financeiros.total)}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Destino */}
          <div className="bg-card border border-border rounded-lg">
            <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/30 rounded-t-lg">
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                destinoRep ? "bg-success text-white" : "bg-muted text-muted-foreground"
              )}>3</div>
              <h2 className="font-heading font-semibold text-foreground text-sm">Reparação de Destino</h2>
            </div>
            <div className="p-4">
              {!origemRep && pecas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Selecione primeiro a reparação de origem.</p>
              ) : (
                <ReparacaoSearch
                  label="Selecionar destino"
                  value={destinoRep}
                  onSelect={setDestinoRep}
                  excludeId={origemRep?.id}
                />
              )}
            </div>
          </div>

          {/* Resumo financeiro */}
          {pecas.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <h3 className="font-heading font-semibold text-foreground text-sm flex items-center gap-2">
                <Euro className="w-4 h-4 text-muted-foreground" />
                Resumo dos artigos
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total s/ IVA</span>
                  <span className="font-mono font-medium text-foreground">{formatCurrency(financeiros.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA 23%</span>
                  <span className="font-mono text-muted-foreground">{formatCurrency(financeiros.totalIva - financeiros.total)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="font-medium text-foreground">Total c/ IVA</span>
                  <span className="font-mono font-bold text-foreground">{formatCurrency(financeiros.totalIva)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── MAIN: Artigos ── */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange flex items-center justify-center text-xs font-bold text-white flex-shrink-0">2</div>
                <Package className="w-5 h-5 text-orange" />
                <h2 className="font-heading font-semibold text-foreground">Peças e Materiais</h2>
                {pecas.length > 0 && (
                  <span className="px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground">{pecas.length}</span>
                )}
              </div>
              {origemRep && (
                <button
                  type="button"
                  onClick={adicionarTexto}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Nota Texto
                </button>
              )}
            </div>

            {!origemRep ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Copy className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Selecione uma reparação de origem</p>
                <p className="text-xs text-muted-foreground/60 mt-1">As peças serão carregadas automaticamente para edição</p>
              </div>
            ) : (
              <>
                {/* Input nota */}
                {showTextoInput && (
                  <div className="p-4 border-b border-border bg-muted/50">
                    <label className="block text-xs text-muted-foreground mb-2">Texto da Nota</label>
                    <div className="flex gap-2">
                      <input
                        id="textoNotaInputCopiar"
                        type="text"
                        className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Escreva a nota aqui..."
                        value={textoNota}
                        onChange={e => setTextoNota(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); confirmarTexto() } }}
                      />
                      <button onClick={confirmarTexto} className="p-2 bg-success text-white rounded-md hover:bg-success/90">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setShowTextoInput(false)} className="p-2 bg-muted text-muted-foreground rounded-md hover:bg-destructive/10 hover:text-destructive">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Formulário de peça */}
                <div className={cn("p-4 border-b border-border", editingId ? "bg-warning/10" : "bg-muted/30")}>
                  {editingId && (
                    <div className="flex items-center gap-1 text-warning text-xs font-medium mb-3">
                      <Pencil className="w-3.5 h-3.5" />
                      A editar peça — clique ✓ para confirmar ou ✕ para cancelar
                    </div>
                  )}
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-3">
                      <label className="block text-xs text-muted-foreground mb-1">Peça</label>
                      <input
                        list="pecas-list-copiar"
                        ref={tipoPecaInputRef}
                        className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={novaPeca.tipopeca}
                        onChange={e => setNovaPeca({ ...novaPeca, tipopeca: e.target.value })}
                        placeholder="Nome da peça..."
                      />
                      <datalist id="pecas-list-copiar">
                        {pecasSimilares.map((p, i) => <option key={i} value={p.tipopeca} />)}
                      </datalist>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs text-muted-foreground mb-1">Referência</label>
                      <input
                        type="text"
                        className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={novaPeca.marca}
                        onChange={e => setNovaPeca({ ...novaPeca, marca: e.target.value })}
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs text-muted-foreground mb-1">Qtd</label>
                      <input
                        type="number"
                        className="w-full px-2 py-2 bg-background border border-border rounded-md text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={novaPeca.quantidade}
                        onChange={e => setNovaPeca({ ...novaPeca, quantidade: e.target.value })}
                        min="1"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-muted-foreground mb-1">Preço (€)</label>
                      <input
                        type="number"
                        className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={novaPeca.preco_unitario}
                        onChange={e => setNovaPeca({ ...novaPeca, preco_unitario: e.target.value })}
                        step="0.01"
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-xs text-muted-foreground mb-1">Desc.(%)</label>
                      <input
                        type="number"
                        className="w-full px-2 py-2 bg-background border border-border rounded-md text-sm text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={novaPeca.desconto_percentual}
                        onChange={e => setNovaPeca({ ...novaPeca, desconto_percentual: e.target.value })}
                        min="0" max="100"
                      />
                    </div>
                    <div className="col-span-2 flex items-end gap-1">
                      {editingId ? (
                        <>
                          <button onClick={gerirPeca} className="flex-1 p-2 bg-success text-white rounded-md hover:bg-success/90" title="Confirmar">
                            <Check className="w-4 h-4 mx-auto" />
                          </button>
                          <button onClick={cancelarEdicao} className="flex-1 p-2 bg-muted text-muted-foreground rounded-md hover:bg-destructive/10 hover:text-destructive" title="Cancelar">
                            <X className="w-4 h-4 mx-auto" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={gerirPeca}
                          disabled={!novaPeca.tipopeca}
                          className="flex-1 flex items-center justify-center gap-1 p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
                          title="Adicionar peça"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tabela */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="text-left p-3 font-medium">Descrição</th>
                        <th className="text-left p-3 font-medium">Ref.</th>
                        <th className="text-center p-3 font-medium">Qtd</th>
                        <th className="text-right p-3 font-medium">Unit.</th>
                        <th className="text-right p-3 font-medium">Total</th>
                        <th className="text-right p-3 font-medium w-20">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pecas.length === 0 && (
                        <tr>
                          <td colSpan="6" className="text-center py-8 text-muted-foreground">
                            Esta reparação não tem peças. Adicione acima.
                          </td>
                        </tr>
                      )}
                      {pecas.map((p) => (
                        <tr
                          key={p._id}
                          className={cn(
                            "border-b border-border",
                            p.is_text && "bg-muted/30",
                            editingId === p._id && "bg-warning/10"
                          )}
                        >
                          {p.is_text ? (
                            <td colSpan="5" className="p-3 italic text-muted-foreground">
                              <FileText className="w-4 h-4 inline mr-2" />
                              {p.texto}
                            </td>
                          ) : (
                            <>
                              <td className="p-3 font-medium text-foreground">{p.tipopeca}</td>
                              <td className="p-3 text-muted-foreground">{p.marca}</td>
                              <td className="p-3 text-center">
                                <span className="px-2 py-0.5 bg-muted rounded text-foreground">{p.quantidade}</span>
                              </td>
                              <td className="p-3 text-right text-muted-foreground">
                                {p.desconto_percentual > 0 && (
                                  <span className="text-warning mr-1">-{p.desconto_percentual}%</span>
                                )}
                                {formatCurrency(p.preco_unitario)}
                              </td>
                              <td className="p-3 text-right font-medium text-foreground">
                                {formatCurrency(p.preco_unitario * (1 - (p.desconto_percentual / 100)) * p.quantidade)}
                              </td>
                            </>
                          )}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {!p.is_text && (
                                <button onClick={() => iniciarEdicao(p)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title="Editar">
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                              <button onClick={() => removerPeca(p._id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Remover">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {pecas.length > 0 && (
                  <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {pecas.filter(p => !p.is_text).length} peça(s) · {pecas.filter(p => p.is_text).length} nota(s)
                    </span>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Total s/ IVA</p>
                      <p className="text-lg font-heading font-bold text-foreground">
                        {formatCurrency(financeiros.total)}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Barra de ação inferior */}
          {pecas.length > 0 && (
            <div className={cn(
              "bg-card border rounded-lg p-4 flex items-center justify-between gap-4",
              destinoRep ? "border-primary/30 bg-primary/5" : "border-border"
            )}>
              <div className="text-sm">
                {destinoRep ? (
                  <>
                    <p className="font-medium text-foreground">
                      Pronto para copiar para <span className="font-mono text-primary">#{destinoRep.numreparacao}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pecas.length} artigo(s) · {formatCurrency(financeiros.total)} s/ IVA
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Selecione a reparação de destino para continuar</p>
                )}
              </div>
              <button
                onClick={executarCopia}
                disabled={!destinoRep || saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                data-testid="btn-copiar-footer"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> A copiar...</>
                  : <><Copy className="w-4 h-4" /> Copiar {pecas.length} artigo(s)</>
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CopiarArtigos
