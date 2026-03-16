"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import ClienteForm from "../components/ClienteForm"
import { cn } from "../lib/utils"
import {
  ArrowLeft,
  Save,
  Loader2,
  Wrench,
  User,
  Search,
  Plus,
  Package,
  FileText,
  Trash2,
  Pencil,
  X,
  Check,
  Calendar,
  Euro,
  AlertTriangle,
  CheckCircle
} from "lucide-react"

const API_BASE_URL = "http://localhost:8082"
const formatCurrency = (val) => Number(val).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })

function ReparacoesRegisto() {
  const navigate = useNavigate()

  // Estados
  const [form, setForm] = useState({
    dataentrega: new Date().toISOString().split('T')[0],
    datasaida: "", dataconclusao: "",
    estadoorcamento: "", estadoreparacao: "",
    localcentro: "", nomecentro: "", nomemaquina: "",
    numreparacao: "", cliente_id: "", descricao: "",
  })

  const [auxData, setAuxData] = useState({
    centros: [], orcamentos: [], reparacoes: [], clientes: [], pecasExistentes: []
  })

  const novaPecaInicial = {
    tipopeca: "", marca: "", quantidade: 1, preco_unitario: 0,
    desconto_percentual: 0, tipo_desconto: "percentual", observacao: ""
  }
  const [pecasNecessarias, setPecasNecessarias] = useState([])
  const [novaPeca, setNovaPeca] = useState(novaPecaInicial)
  const [editingId, setEditingId] = useState(null)
  const [showTextoInput, setShowTextoInput] = useState(false)
  const [textoNota, setTextoNota] = useState("")
  const tipoPecaInputRef = useRef(null)

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [showClienteForm, setShowClienteForm] = useState(false)
  const [erro, setErro] = useState("")

  const [buscaCliente, setBuscaCliente] = useState("")
  const [clientesFiltrados, setClientesFiltrados] = useState([])
  const [mostrarResultados, setMostrarResultados] = useState(false)
  const [clienteSelecionadoObj, setClienteSelecionadoObj] = useState(null)

  const [valorMaoObra, setValorMaoObra] = useState(0)
  const [descontoMaoObra, setDescontoMaoObra] = useState(0)

  useEffect(() => {
    const carregarDados = async () => {
      setLoadingData(true)
      try {
        const [centros, orcamentos, reparacoes, pecas, clientes] = await Promise.all([
          axios.get(`${API_BASE_URL}/centros`),
          axios.get(`${API_BASE_URL}/orcamentos`),
          axios.get(`${API_BASE_URL}/estadoReparacoes`),
          axios.get(`${API_BASE_URL}/pecas`).catch(() => ({ data: [] })),
          axios.get(`${API_BASE_URL}/clientes`)
        ])

        setAuxData({
          centros: centros.data || [],
          orcamentos: orcamentos.data || [],
          reparacoes: reparacoes.data || [],
          pecasExistentes: pecas.data || [],
          clientes: clientes.data || []
        })
      } catch (err) {
        console.error(err)
        setErro("Erro ao carregar dados iniciais.")
      } finally {
        setLoadingData(false)
      }
    }
    carregarDados()
  }, [])

  const handleBuscaCliente = (e) => {
    const termo = e.target.value
    setBuscaCliente(termo)

    if (termo.length >= 2) {
      const filtrados = auxData.clientes.filter(c =>
        c.nome?.toLowerCase().includes(termo.toLowerCase()) ||
        String(c.numero_interno).includes(termo)
      )
      setClientesFiltrados(filtrados)
      setMostrarResultados(true)
    } else {
      setMostrarResultados(false)
    }
  }

  const selecionarCliente = (cliente) => {
    setClienteSelecionadoObj(cliente)
    setForm(prev => ({ ...prev, cliente_id: String(cliente.id) }))
    setBuscaCliente(`${cliente.nome} (Nº ${cliente.numero_interno || 'N/A'})`)
    setMostrarResultados(false)
  }

  const handleClienteSalvo = async (novoId) => {
    setShowClienteForm(false)
    try {
      const res = await axios.get(`${API_BASE_URL}/clientes`)
      setAuxData(prev => ({ ...prev, clientes: res.data }))
      const novoCliente = res.data.find(c => String(c.id) === String(novoId)) || res.data[res.data.length - 1]
      if (novoCliente) selecionarCliente(novoCliente)
    } catch (error) {
      console.error("Erro ao atualizar clientes", error)
    }
  }

  const financeiros = useMemo(() => {
    let totalPecas = 0

    pecasNecessarias.forEach(p => {
      if (p.is_text) return
      const pu = Number(p.preco_unitario) || 0
      const qtd = Number(p.quantidade) || 1
      const descPct = Number(p.desconto_percentual) || 0
      const precoComDesc = Math.max(0, pu * (1 - descPct / 100))
      totalPecas += (precoComDesc * qtd)
    })

    const descMOValor = valorMaoObra * (descontoMaoObra / 100)
    const moFinal = Math.max(0, valorMaoObra - descMOValor)
    const totalGeral = totalPecas + moFinal

    return {
      totalPecas,
      moFinal,
      totalGeral,
      totalComIva: totalGeral * 1.23
    }
  }, [pecasNecessarias, valorMaoObra, descontoMaoObra])

  const validarPeca = () => {
    if (!novaPeca.tipopeca || !novaPeca.marca) {
      alert("Preencha tipo e marca")
      return false
    }
    return true
  }

  const gerirPeca = () => {
    if (!validarPeca()) return

    const quantidade = Number(novaPeca.quantidade) || 1
    const preco_unitario = Number(novaPeca.preco_unitario) || 0
    const desconto_percentual = Number(novaPeca.desconto_percentual) || 0

    const existeNoSistema = !!auxData.pecasExistentes.find(p =>
      p.tipopeca === novaPeca.tipopeca && p.marca === novaPeca.marca
    )

    const dadosPeca = {
      ...novaPeca,
      quantidade,
      preco_unitario,
      desconto_percentual,
      existeNoSistema
    }

    if (editingId) {
      setPecasNecessarias(prev => prev.map(p => p.id === editingId ? { ...dadosPeca, id: editingId } : p))
      setEditingId(null)
    } else {
      setPecasNecessarias(prev => [...prev, { ...dadosPeca, id: Date.now() }])
    }

    setNovaPeca(novaPecaInicial)
    setTimeout(() => tipoPecaInputRef.current?.focus(), 100)
  }

  const iniciarEdicao = (peca) => {
    if (peca.is_text) return
    setEditingId(peca.id)
    setNovaPeca({
      tipopeca: peca.tipopeca,
      marca: peca.marca,
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

  const adicionarTexto = (e) => {
    if (e) e.preventDefault()
    setShowTextoInput(true)
    setTimeout(() => {
      const input = document.getElementById('textoNotaInput')
      if (input) input.focus()
    }, 100)
  }

  const confirmarTexto = () => {
    if (textoNota.trim()) {
      setPecasNecessarias(prev => [...prev, { id: Date.now(), is_text: true, texto: textoNota, quantidade: 0, preco_unitario: 0 }])
      setTextoNota("")
      setShowTextoInput(false)
    }
  }

  const removerPeca = (id) => {
    setPecasNecessarias(prev => prev.filter(p => p.id !== id))
    if (editingId === id) cancelarEdicao()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.numreparacao || !form.nomemaquina || !form.cliente_id) return setErro("Preencha os campos obrigatórios (*)")

    setLoading(true)
    try {
      const pecasPayload = pecasNecessarias.map((p, idx) => ({
        tipopeca: p.is_text ? null : p.tipopeca,
        marca: p.is_text ? "Nota" : p.marca,
        quantidade: p.quantidade,
        preco_unitario: p.preco_unitario,
        desconto_percentual: p.desconto_percentual,
        tipo_desconto: "percentual",
        observacao: p.observacao,
        existe_no_sistema: p.existeNoSistema ? 1 : 0,
        is_text: p.is_text ? 1 : 0,
        texto: p.is_text ? p.texto : null,
        ordem: idx + 1
      }))

      const dados = {
        ...form,
        mao_obra: valorMaoObra,
        desconto: descontoMaoObra,
        tipo_desconto: "percentual",
        total_geral: financeiros.totalGeral,
        pecasNecessarias: pecasPayload
      }

      await axios.post(`${API_BASE_URL}/reparacoes`, dados)
      navigate("/reparacoes")
    } catch (err) {
      console.error(err)
      setErro("Erro ao registar. Verifique se o Nº de Reparação é único.")
    } finally {
      setLoading(false)
    }
  }

  const pecasSimilares = auxData.pecasExistentes.filter(p => 
    p.tipopeca?.toLowerCase().includes(novaPeca.tipopeca.toLowerCase())
  ).slice(0, 5)

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="loading">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">A carregar...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="new-repair-form">
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
            <h1 className="text-2xl font-heading font-bold text-foreground">Nova Reparação</h1>
            <p className="text-muted-foreground text-sm">Registe uma nova entrada de equipamento</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate("/reparacoes")}
            className="px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            data-testid="submit-repair"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? "A processar..." : "Registar"}
          </button>
        </div>
      </div>

      {erro && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/30 rounded-md text-destructive">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {erro}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Equipment Card */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/30">
              <Wrench className="w-5 h-5 text-primary" />
              <h2 className="font-heading font-semibold text-foreground">Dados do Equipamento</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nome da Máquina <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    name="nomemaquina"
                    value={form.nomemaquina}
                    onChange={e => setForm({ ...form, nomemaquina: e.target.value })}
                    placeholder="Ex: Betoneira Industrial BT-500"
                    autoFocus
                    data-testid="input-nomemaquina"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nº Reparação <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-md text-foreground font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    name="numreparacao"
                    value={form.numreparacao}
                    onChange={e => setForm({ ...form, numreparacao: e.target.value })}
                    placeholder="REP0001"
                    data-testid="input-numreparacao"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Descrição da Avaria</label>
                <textarea
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  rows="3"
                  name="descricao"
                  value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Descreva o problema relatado pelo cliente..."
                  data-testid="input-descricao"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Centro de Reparação</label>
                  <select
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    value={form.nomecentro}
                    onChange={e => setForm({ ...form, nomecentro: e.target.value })}
                    data-testid="select-centro"
                  >
                    <option value="">Selecione...</option>
                    {auxData.centros.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Parts Card */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-orange" />
                <h2 className="font-heading font-semibold text-foreground">Peças e Materiais</h2>
              </div>
              <button
                type="button"
                onClick={adicionarTexto}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Nota Texto
              </button>
            </div>

            {/* Text Input */}
            {showTextoInput && (
              <div className="p-4 border-b border-border bg-muted/50">
                <label className="block text-xs text-muted-foreground mb-2">Texto da Nota</label>
                <div className="flex gap-2">
                  <input
                    id="textoNotaInput"
                    type="text"
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Escreva a nota aqui..."
                    value={textoNota}
                    onChange={e => setTextoNota(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmarTexto() }}}
                  />
                  <button onClick={confirmarTexto} className="p-2 bg-success text-success-foreground rounded-md hover:bg-success/90">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setShowTextoInput(false)} className="p-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Part Form */}
            <div className={cn("p-4 border-b border-border", editingId ? "bg-warning/10" : "bg-muted/30")}>
              {editingId && (
                <div className="flex items-center gap-1 text-warning text-xs font-medium mb-3">
                  <Pencil className="w-3.5 h-3.5" />
                  A Editar Peça
                </div>
              )}
              <div className="grid grid-cols-12 gap-3">
            <div className="col-span-3">
                  <label className="block text-xs text-muted-foreground mb-1">Peça</label>
                  <input
                    list="pecas-list"
                    ref={tipoPecaInputRef}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={novaPeca.tipopeca}
                    onChange={e => setNovaPeca({ ...novaPeca, tipopeca: e.target.value })}
                    placeholder="Nome da peça..."
                  />
                  <datalist id="pecas-list">{pecasSimilares.map((p, i) => <option key={i} value={p.tipopeca} />)}</datalist>
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
                min="0"
                max="100"
              />
            </div>
                <div className="col-span-2 flex items-end gap-1">
                  {editingId ? (
                    <>
                      <button onClick={gerirPeca} className="flex-1 p-2 bg-success text-white rounded-md hover:bg-success/90">
                        <Check className="w-4 h-4 mx-auto" />
                      </button>
                      <button onClick={cancelarEdicao} className="flex-1 p-2 bg-muted text-muted-foreground rounded-md hover:bg-destructive/10 hover:text-destructive">
                        <X className="w-4 h-4 mx-auto" />
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={gerirPeca} 
                      disabled={!novaPeca.tipopeca}
                      className="flex-1 flex items-center justify-center gap-1 p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Parts Table */}
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
                  {pecasNecessarias.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-muted-foreground">
                        Adicione peças acima para ver a lista.
                      </td>
                    </tr>
                  )}
                  {pecasNecessarias.map((p, idx) => (
                    <tr key={p.id || idx} className={cn(
                      "border-b border-border",
                      p.is_text && "bg-muted/30",
                      editingId === p.id && "bg-warning/10"
                    )}>
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
                            {p.desconto_percentual > 0 && <span className="text-warning mr-1">-{p.desconto_percentual}%</span>}
                            {formatCurrency(p.preco_unitario)}
                          </td>
                          <td className="p-3 text-right font-medium text-foreground">
                            {formatCurrency((p.preco_unitario * (1 - (p.desconto_percentual / 100))) * p.quantidade)}
                          </td>
                        </>
                      )}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!p.is_text && (
                            <button onClick={() => iniciarEdicao(p)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => removerPeca(p.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
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
              <h3 className="font-heading font-semibold text-foreground">Cliente <span className="text-destructive">*</span></h3>
            </div>
            <div className="p-4">
              {showClienteForm ? (
                <div className="border border-border rounded-lg p-3 bg-muted/30">
                  <ClienteForm onSave={handleClienteSalvo} onCancel={() => setShowClienteForm(false)} />
                </div>
              ) : (
                <>
                  <div className="flex gap-2 mb-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="Pesquisar cliente..."
                        value={buscaCliente}
                        onChange={handleBuscaCliente}
                        onFocus={() => buscaCliente.length >= 2 && setMostrarResultados(true)}
                        data-testid="search-client"
                      />
                    </div>
                    <button
                      onClick={() => setShowClienteForm(true)}
                      className="p-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {mostrarResultados && (
                    <div className="border border-border rounded-md overflow-hidden bg-card shadow-lg max-h-48 overflow-y-auto mb-3">
                      {clientesFiltrados.map(c => (
                        <button
                          key={c.id}
                          className="w-full p-3 text-left hover:bg-muted border-b border-border last:border-0 transition-colors"
                          onClick={() => selecionarCliente(c)}
                        >
                          <div className="font-medium text-foreground">{c.nome}</div>
                          <div className="text-xs text-muted-foreground">Nº {c.numero_interno} | {c.telefone}</div>
                        </button>
                      ))}
                      {clientesFiltrados.length === 0 && (
                        <div className="p-3 text-center text-sm text-muted-foreground">Sem resultados</div>
                      )}
                    </div>
                  )}

                  {clienteSelecionadoObj && (
                    <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/30 rounded-md">
                      <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                      <div>
                        <div className="font-medium text-foreground">{clienteSelecionadoObj.nome}</div>
                        <div className="text-xs text-muted-foreground">{clienteSelecionadoObj.email || clienteSelecionadoObj.telefone}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Workflow Card */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-border bg-muted/30">
              <Calendar className="w-5 h-5 text-info" />
              <h3 className="font-heading font-semibold text-foreground">Workflow</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Orçamento</label>
                  <select
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.estadoorcamento}
                    onChange={e => setForm({ ...form, estadoorcamento: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {auxData.orcamentos.map(o => <option key={o.id} value={o.estado}>{o.estado}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Reparação</label>
                  <select
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={form.estadoreparacao}
                    onChange={e => setForm({ ...form, estadoreparacao: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {auxData.reparacoes.map(r => <option key={r.id} value={r.estado}>{r.estado}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Data de Entrada</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  value={form.dataentrega}
                  onChange={e => setForm({ ...form, dataentrega: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Financial Card */}
          <div className="bg-primary text-primary-foreground rounded-lg overflow-hidden">
            <div className="p-4 border-b border-white/20">
              <div className="flex items-center gap-2">
                <Euro className="w-5 h-5" />
                <h3 className="font-heading font-semibold">Financeiro</h3>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-white/70 mb-1">Mão de Obra (€)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-md text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                    value={valorMaoObra}
                    onChange={e => setValorMaoObra(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/70 mb-1">Desc. (%)</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                    value={descontoMaoObra}
                    onChange={e => setDescontoMaoObra(parseFloat(e.target.value) || 0)}
                    max="100"
                  />
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/70">Total Peças</span>
                  <span className="font-medium">{formatCurrency(financeiros.totalPecas)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Mão Obra (Líq)</span>
                  <span className="font-medium">{formatCurrency(financeiros.moFinal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Total s/ IVA</span>
                  <span className="font-medium">{formatCurrency(financeiros.totalGeral)}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-white/20 flex justify-between items-center">
                <span>Total c/ IVA</span>
                <span className="text-2xl font-heading font-bold">{formatCurrency(financeiros.totalComIva)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReparacoesRegisto
