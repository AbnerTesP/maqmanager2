"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import axios from "axios"
import { useNavigate, useParams } from "react-router-dom"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

// --- CONSTANTES E UTILITÁRIOS ---
const API_BASE_URL = "http://localhost:8082"
const formatCurrency = (val) => Number(val).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })
const formatDateInput = (dateStr) => dateStr ? dateStr.split("T")[0] : ""

function ReparacoesEdit() {
    // --- ESTADOS ---
    const { id } = useParams()
    const navigate = useNavigate()

    // Dados Principais
    const [form, setForm] = useState({
        dataentrega: "", datasaida: "", dataconclusao: "",
        estadoorcamento: "", estadoreparacao: "",
        localcentro: "", nomecentro: "", nomemaquina: "",
        numreparacao: "", cliente_id: "", descricao: "",
    })
    const [originalForm, setOriginalForm] = useState({})

    // Dados Auxiliares (Listas)
    const [auxData, setAuxData] = useState({
        centros: [], orcamentos: [], reparacoes: [], clientes: [], pecasExistentes: []
    })

    // --- GESTÃO DE PEÇAS (ATUALIZADA) ---
    const novaPecaInicial = {
        tipopeca: "", marca: "", quantidade: 1, preco_unitario: 0,
        desconto_percentual: 0, tipo_desconto: "percentual", observacao: ""
    }
    const [pecasNecessarias, setPecasNecessarias] = useState([])
    const [originalPecas, setOriginalPecas] = useState([])
    const [novaPeca, setNovaPeca] = useState(novaPecaInicial)

    // NOVO: Estado para controlar ID em edição
    const [editingId, setEditingId] = useState(null)
    const tipoPecaInputRef = useRef(null)

    // UI States
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [erro, setErro] = useState("")
    const [validationErrors, setValidationErrors] = useState({})

    // Financeiro Local
    const [valorMaoObra, setValorMaoObra] = useState(0)
    const [desconto, setDesconto] = useState(0)
    const [tipoDesconto, setTipoDesconto] = useState("percentual")

    // --- CARREGAMENTO DE DADOS ---
    useEffect(() => {
        const loadAllData = async () => {
            setLoading(true)
            try {
                const [centrosRes, orcRes, repRes, pecasRes, cliRes] = await Promise.all([
                    axios.get(`${API_BASE_URL}/centros`),
                    axios.get(`${API_BASE_URL}/orcamentos`),
                    axios.get(`${API_BASE_URL}/estadoReparacoes`),
                    axios.get(`${API_BASE_URL}/pecas`).catch(() => ({ data: [] })),
                    axios.get(`${API_BASE_URL}/clientes`)
                ])

                setAuxData({
                    centros: centrosRes.data,
                    orcamentos: orcRes.data,
                    reparacoes: repRes.data,
                    pecasExistentes: pecasRes.data || [],
                    clientes: cliRes.data
                })

                const reparacaoRes = await axios.get(`${API_BASE_URL}/reparacoes/${id}`)
                const data = reparacaoRes.data

                const formattedData = {
                    ...data,
                    dataentrega: formatDateInput(data.dataentrega),
                    datasaida: formatDateInput(data.datasaida),
                    dataconclusao: formatDateInput(data.dataconclusao),
                    cliente_id: String(data.cliente_id || ""),
                }

                setForm(formattedData)
                setOriginalForm(formattedData)
                setValorMaoObra(Number(data.mao_obra) || 0)
                setDesconto(Number(data.desconto) || 0)
                setTipoDesconto(data.tipo_desconto || "percentual")

                try {
                    const pecasRes = await axios.get(`${API_BASE_URL}/reparacoes/${data.id}/pecas`)
                    const pecasFormatadas = pecasRes.data.map(p => ({
                        ...p,
                        quantidade: Number(p.quantidade) || 1,
                        preco_unitario: Number(p.preco_unitario) || 0,
                        desconto_percentual: Number(p.desconto_percentual) || 0,
                        preco_total: Number(p.preco_total) || 0,
                        existeNoSistema: p.existe_no_sistema === 1
                    }))
                    setPecasNecessarias(pecasFormatadas)
                    setOriginalPecas(JSON.parse(JSON.stringify(pecasFormatadas)))
                } catch (e) {
                    console.warn("Sem peças associadas")
                }

            } catch (err) {
                console.error(err)
                setErro("Erro ao carregar dados.")
            } finally {
                setLoading(false)
            }
        }
        loadAllData()
    }, [id])

    // --- CÁLCULOS FINANCEIROS ---
    const financeiros = useMemo(() => {
        let totalPecas = 0
        let totalDescontosPecas = 0

        pecasNecessarias.forEach(p => {
            if (p.is_text) return
            const pu = Number(p.preco_unitario) || 0
            const qtd = Number(p.quantidade) || 1
            const descPct = Number(p.desconto_percentual) || 0
            const precoComDesc = Math.max(0, pu * (1 - descPct / 100))

            totalPecas += (precoComDesc * qtd)
            totalDescontosPecas += ((pu - precoComDesc) * qtd)
        })

        const valorDescMO = tipoDesconto === "percentual"
            ? valorMaoObra * (desconto / 100)
            : Number(desconto) || 0

        const totalGeral = Math.max(0, totalPecas + (valorMaoObra - valorDescMO))
        const iva = totalGeral * 0.23

        return {
            totalPecas,
            totalDescontosPecas,
            valorDescMO,
            subtotalMO: valorMaoObra - valorDescMO,
            totalGeral,
            iva,
            totalComIva: totalGeral + iva
        }
    }, [pecasNecessarias, valorMaoObra, desconto, tipoDesconto])

    // --- FUNÇÕES DE GESTÃO DE PEÇAS (EDITAR/ADICIONAR) ---

    const handleNovaPecaChange = (e) => {
        const { name, value } = e.target
        setNovaPeca(prev => ({ ...prev, [name]: value }))
    }

    // Função Unificada para Adicionar ou Atualizar Peça
    const gerirPeca = () => {
        if (!novaPeca.tipopeca || !novaPeca.marca) return alert("Preencha tipo e marca")

        const pu = parseFloat(String(novaPeca.preco_unitario).replace(',', '.')) || 0
        const descPct = parseFloat(novaPeca.desconto_percentual) || 0
        const qtd = parseFloat(novaPeca.quantidade) || 1

        const precoComDesc = Math.max(0, pu - (pu * (descPct / 100)))
        const total = qtd * precoComDesc

        // Verificar se existe na lista geral (para marcar a flag existeNoSistema)
        const existeNaBD = !!auxData.pecasExistentes.find(p =>
            p.tipopeca === novaPeca.tipopeca && p.marca === novaPeca.marca
        );

        const dadosPeca = {
            ...novaPeca,
            preco_unitario: pu,
            desconto_percentual: descPct,
            preco_total: total,
            preco_com_desconto: precoComDesc,
            existeNoSistema: existeNaBD
        }

        if (editingId) {
            // ATUALIZAR peça existente
            setPecasNecessarias(prev => prev.map(p => p.id === editingId ? { ...dadosPeca, id: editingId } : p))
            setEditingId(null)
        } else {
            // ADICIONAR nova peça
            setPecasNecessarias(prev => [...prev, { ...dadosPeca, id: Date.now(), isNew: true }])
        }

        // Reset do formulário
        setNovaPeca(novaPecaInicial)
        setTimeout(() => tipoPecaInputRef.current?.focus(), 100)
    }

    // Inicia o modo de edição
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

    // Cancela o modo de edição
    const cancelarEdicao = () => {
        setEditingId(null)
        setNovaPeca(novaPecaInicial)
    }

    const removerPeca = (id) => {
        setPecasNecessarias(prev => prev.filter(p => p.id !== id))
        if (editingId === id) cancelarEdicao()
    }

    const adicionarLinhaTexto = () => {
        const texto = prompt("Digite o texto da nota:")
        if (!texto) return
        setPecasNecessarias(prev => [...prev, {
            id: Date.now(), is_text: 1, texto, marca: "texto", quantidade: 0, preco_total: 0
        }])
    }

    // --- HANDLERS GERAIS ---
    const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            const payload = {
                ...form,
                valor_mao_obra: valorMaoObra,
                mao_obra: valorMaoObra,
                desconto,
                tipo_desconto: tipoDesconto,
                total_geral: financeiros.totalGeral
            }
            await axios.put(`${API_BASE_URL}/reparacoes/${id}`, payload)

            const pecasPayload = pecasNecessarias.map((p, idx) => ({
                ...p,
                tipopeca: p.is_text ? null : p.tipopeca,
                texto: p.is_text ? (p.texto || p.tipopeca) : null,
                ordem: idx + 1,
                existe_no_sistema: p.existeNoSistema ? 1 : 0
            }))

            await axios.put(`${API_BASE_URL}/reparacoes/${id}/pecas`, { pecasNecessarias: pecasPayload })
            alert("Guardado com sucesso!")
            navigate("/reparacoes")
        } catch (err) {
            setErro("Erro ao salvar alterações")
        } finally {
            setSaving(false)
        }
    }

    const orcamentoAceito = form.estadoorcamento?.toLowerCase().match(/aceite|aceito|processo/);
    const pecasSimilares = auxData.pecasExistentes.filter(p => p.tipopeca.toLowerCase().includes(novaPeca.tipopeca.toLowerCase())).slice(0, 5)

    if (loading) return <div className="d-flex justify-content-center align-items-center vh-100"><div className="spinner-border text-primary"></div></div>

    return (
        <div className="container-fluid bg-light min-vh-100 pb-5">
            <div className="bg-white border-bottom py-3 mb-4 shadow-sm sticky-top" style={{ zIndex: 100 }}>
                <div className="container d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-3">
                        <button onClick={() => navigate("/reparacoes")} className="btn btn-light border rounded-circle"><i className="bi bi-arrow-left"></i></button>
                        <div>
                            <h4 className="mb-0 fw-bold">Editar Reparação #{form.numreparacao || id}</h4>
                            <span className="text-muted small">{form.nomemaquina}</span>
                        </div>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary" onClick={() => navigate("/reparacoes")}>Cancelar</button>
                        <button className="btn btn-success px-4 fw-bold" onClick={handleSubmit} disabled={saving}>
                            {saving ? "A guardar..." : <><i className="bi bi-check-lg me-2"></i>Guardar</>}
                        </button>
                    </div>
                </div>
            </div>

            <div className="container">
                {erro && <div className="alert alert-danger">{erro}</div>}

                <div className="row g-4">
                    <div className="col-lg-8">
                        {/* DADOS DA MÁQUINA (Reduzido para brevidade, manter igual ao anterior) */}
                        <div className="card border-0 shadow-sm rounded-3 mb-4">
                            <div className="card-header bg-white fw-bold py-3"><i className="bi bi-laptop me-2 text-primary"></i>Detalhes do Equipamento</div>
                            <div className="card-body">
                                <div className="row g-3">
                                    <div className="col-md-8">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Nome da Máquina</label>
                                        <input type="text" className="form-control" name="nomemaquina" value={form.nomemaquina} onChange={handleChange} />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Nº Série</label>
                                        <input type="text" className="form-control" name="numreparacao" value={form.numreparacao} onChange={handleChange} />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Descrição</label>
                                        <textarea className="form-control bg-light" rows="3" name="descricao" value={form.descricao} onChange={handleChange}></textarea>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Centro</label>
                                        <select className="form-select" name="nomecentro" value={form.nomecentro} onChange={(e) => {
                                            const c = auxData.centros.find(c => c.nome === e.target.value)
                                            setForm(prev => ({ ...prev, nomecentro: e.target.value, localcentro: c?.local || "" }))
                                        }}>
                                            <option value="">Selecione...</option>
                                            {auxData.centros.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* PEÇAS E SERVIÇOS */}
                        <div className={`card border-0 shadow-sm rounded-3 ${!orcamentoAceito ? 'opacity-75' : ''}`}>
                            <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                                <span className="fw-bold"><i className="bi bi-tools me-2 text-warning"></i>Peças e Materiais</span>
                                <button className="btn btn-sm btn-outline-secondary" onClick={adicionarLinhaTexto}><i className="bi bi-type"></i> Texto</button>
                            </div>

                            <div className="card-body p-0">
                                {orcamentoAceito ? (
                                    <div className={`p-3 border-bottom ${editingId ? 'bg-warning bg-opacity-10' : 'bg-light'}`}>
                                        {/* INDICADOR DE EDIÇÃO */}
                                        {editingId && <div className="text-warning fw-bold small mb-2"><i className="bi bi-pencil-fill me-1"></i>A Editar Peça</div>}

                                        <div className="row g-2 align-items-end">
                                            <div className="col-md-4">
                                                <label className="small text-muted">Peça</label>
                                                <input list="pecas-list" className="form-control form-control-sm" ref={tipoPecaInputRef} name="tipopeca" value={novaPeca.tipopeca} onChange={handleNovaPecaChange} placeholder="Nome da peça" />
                                                <datalist id="pecas-list">{pecasSimilares.map((p, i) => <option key={i} value={p.tipopeca} />)}</datalist>
                                            </div>
                                            <div className="col-md-2">
                                                <label className="small text-muted">Marca</label>
                                                <input type="text" className="form-control form-control-sm" name="marca" value={novaPeca.marca} onChange={handleNovaPecaChange} />
                                            </div>
                                            <div className="col-md-1">
                                                <label className="small text-muted">Qtd</label>
                                                <input type="number" className="form-control form-control-sm" name="quantidade" value={novaPeca.quantidade} onChange={handleNovaPecaChange} min="1" />
                                            </div>
                                            <div className="col-md-2">
                                                <label className="small text-muted">Preço (€)</label>
                                                <input type="number" className="form-control form-control-sm" name="preco_unitario" value={novaPeca.preco_unitario} onChange={handleNovaPecaChange} step="0.01" />
                                            </div>
                                            <div className="col-md-1">
                                                <label className="small text-muted">Desc(%)</label>
                                                <input type="number" className="form-control form-control-sm" name="desconto_percentual" value={novaPeca.desconto_percentual} onChange={handleNovaPecaChange} min="0" max="100" />
                                            </div>
                                            <div className="col-md-2 d-flex gap-1">
                                                {/* BOTÕES DINÂMICOS (ADICIONAR OU ATUALIZAR) */}
                                                {editingId ? (
                                                    <>
                                                        <button className="btn btn-sm btn-success w-100" onClick={gerirPeca} title="Atualizar"><i className="bi bi-check-lg"></i></button>
                                                        <button className="btn btn-sm btn-outline-danger w-100" onClick={cancelarEdicao} title="Cancelar"><i className="bi bi-x-lg"></i></button>
                                                    </>
                                                ) : (
                                                    <button className="btn btn-sm btn-primary w-100" onClick={gerirPeca} disabled={!novaPeca.tipopeca}><i className="bi bi-plus-lg"></i> Add</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 text-center text-muted fst-italic bg-light">O orçamento precisa ser aceite para adicionar peças.</div>
                                )}

                                <div className="table-responsive">
                                    <table className="table table-hover mb-0 align-middle" style={{ fontSize: '0.9rem' }}>
                                        <thead className="bg-light text-secondary">
                                            <tr>
                                                <th className="ps-4">Descrição</th>
                                                <th>Marca</th>
                                                <th className="text-center">Qtd</th>
                                                <th className="text-end">Unit.</th>
                                                <th className="text-end">Total</th>
                                                <th className="text-end pe-4">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pecasNecessarias.length === 0 && <tr><td colSpan="6" className="text-center py-4 text-muted">Sem peças adicionadas.</td></tr>}
                                            {pecasNecessarias.map((peca) => (
                                                <tr key={peca.id} className={`${peca.is_text ? "table-light" : ""} ${editingId === peca.id ? "table-warning" : ""}`}>
                                                    {peca.is_text ? (
                                                        <td colSpan="5" className="ps-4 fst-italic text-muted"><i className="bi bi-justify-left me-2"></i>{peca.texto || peca.tipopeca}</td>
                                                    ) : (
                                                        <>
                                                            <td className="ps-4 fw-bold">{peca.tipopeca}</td>
                                                            <td>{peca.marca}</td>
                                                            <td className="text-center"><span className="badge bg-light text-dark border">{peca.quantidade}</span></td>
                                                            <td className="text-end text-muted small">
                                                                {peca.desconto_percentual > 0 && <span className="text-warning me-1">-{peca.desconto_percentual}%</span>}
                                                                {formatCurrency(peca.preco_unitario)}
                                                            </td>
                                                            <td className="text-end fw-bold text-dark">{formatCurrency(peca.preco_total)}</td>
                                                        </>
                                                    )}
                                                    <td className="text-end pe-4">
                                                        <div className="d-flex justify-content-end gap-2">
                                                            {!peca.is_text && (
                                                                <button className="btn btn-link text-primary p-0" onClick={() => iniciarEdicao(peca)} title="Editar"><i className="bi bi-pencil-square"></i></button>
                                                            )}
                                                            <button className="btn btn-link text-danger p-0" onClick={() => removerPeca(peca.id)} title="Remover"><i className="bi bi-trash"></i></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- COLUNA DIREITA (SIDEBAR) --- */}
                    <div className="col-lg-4">
                        {/* CLIENTE */}
                        <div className="card border-0 shadow-sm rounded-3 mb-4">
                            <div className="card-body">
                                <h6 className="text-uppercase fw-bold text-muted mb-3" style={{ fontSize: '0.75rem' }}>Cliente</h6>
                                <select className="form-select" name="cliente_id" value={form.cliente_id} onChange={handleChange}>
                                    {auxData.clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* WORKFLOW */}
                        <div className="card border-0 shadow-sm rounded-3 mb-4">
                            <div className="card-body">
                                <h6 className="text-uppercase fw-bold text-muted mb-3" style={{ fontSize: '0.75rem' }}>Workflow</h6>
                                <div className="row g-2 mb-3">
                                    <div className="col-6">
                                        <label className="form-label fw-bold small">Orçamento</label>
                                        <select className="form-select form-select-sm" value={auxData.orcamentos.find(o => o.estado === form.estadoorcamento)?.id || ""} onChange={(e) => {
                                            const novo = auxData.orcamentos.find(o => String(o.id) === e.target.value)?.estado
                                            setForm(p => ({ ...p, estadoorcamento: novo }))
                                        }}>
                                            <option value="">Selecione...</option>
                                            {auxData.orcamentos.map(o => <option key={o.id} value={o.id}>{o.estado}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label fw-bold small">Reparação</label>
                                        <select className="form-select form-select-sm" value={form.estadoreparacao} onChange={e => setForm({ ...form, estadoreparacao: e.target.value })}>
                                            {auxData.reparacoes.map(r => <option key={r.id} value={r.estado}>{r.estado}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="mb-2">
                                    <label className="small text-muted">Data Entrega</label>
                                    <input type="date" className="form-control form-control-sm" name="dataentrega" value={form.dataentrega} onChange={handleChange} />
                                </div>
                                <div className="mb-2">
                                    <label className="small text-muted">Data Conclusão</label>
                                    <input type="date" className="form-control form-control-sm" name="dataconclusao" value={form.dataconclusao} onChange={handleChange} />
                                </div>
                                <div className="mb-2">
                                    
                                    <label className="small text-muted">Data Saída</label>
                                    <input type="date" className="form-control form-control-sm" name="datasaida" value={form.datasaida} onChange={handleChange} />
                                </div>
                            </div>
                        </div>
                        {/* FINANCEIRO */}
                        <div className="card border-0 shadow-sm rounded-3 bg-primary text-white">
                            <div className="card-body">
                                <h6 className="text-uppercase fw-bold mb-4 border-bottom border-white border-opacity-25 pb-2">Totais</h6>
                                <div className="mb-3">
                                    <label className="small text-white text-opacity-75">Mão de Obra (€)</label>
                                    <input type="number" className="form-control form-control-sm bg-white bg-opacity-25 border-0 text-white" value={valorMaoObra} onChange={e => setValorMaoObra(parseFloat(e.target.value) || 0)} />
                                </div>
                                <div className="row g-2 mb-3">
                                    <div className="col-8">
                                        <label className="small text-white text-opacity-75">Desconto MO</label>
                                        <input type="number" className="form-control form-control-sm bg-white bg-opacity-10 border-0 text-white" value={desconto} onChange={e => setDesconto(parseFloat(e.target.value) || 0)} />
                                    </div>
                                    <div className="col-4">
                                        <label className="small text-white text-opacity-75">Tipo</label>
                                        <select className="form-select form-select-sm bg-white bg-opacity-10 border-0 text-white" value={tipoDesconto} onChange={e => setTipoDesconto(e.target.value)}>
                                            <option value="percentual" className="text-dark">%</option>
                                            <option value="valor" className="text-dark">€</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-4 pt-3 border-top border-white border-opacity-25 d-flex justify-content-between align-items-center">
                                    <span>Total Final (c/ IVA)</span>
                                    <span className="fs-2 fw-bold">{formatCurrency(financeiros.totalComIva)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ReparacoesEdit