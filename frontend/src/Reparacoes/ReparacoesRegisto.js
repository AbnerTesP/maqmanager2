"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import ClienteForm from "../components/ClienteForm"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

// --- CONSTANTES E UTILITÁRIOS ---
const API_BASE_URL = "http://localhost:8082"
const formatCurrency = (val) => Number(val).toLocaleString("pt-PT", { style: "currency", currency: "EUR" })

function ReparacoesRegisto() {
    const navigate = useNavigate()

    // --- ESTADOS ---
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

    // --- GESTÃO DE PEÇAS (ATUALIZADA) ---
    const novaPecaInicial = {
        tipopeca: "", marca: "", quantidade: 1, preco_unitario: 0,
        desconto_percentual: 0, tipo_desconto: "percentual", observacao: ""
    }
    const [pecasNecessarias, setPecasNecessarias] = useState([])
    const [novaPeca, setNovaPeca] = useState(novaPecaInicial)

    // Novo estado para controlar qual ID estamos a editar (null = modo adicionar)
    const [editingId, setEditingId] = useState(null)

    // Estado para input de texto (substitui prompt)
    const [showTextoInput, setShowTextoInput] = useState(false)
    const [textoNota, setTextoNota] = useState("")

    const tipoPecaInputRef = useRef(null)

    // UI & Controlo
    const [loading, setLoading] = useState(false)
    const [loadingData, setLoadingData] = useState(true)
    const [showClienteForm, setShowClienteForm] = useState(false)
    const [erro, setErro] = useState("")

    // Pesquisa de Cliente
    const [buscaCliente, setBuscaCliente] = useState("")
    const [clientesFiltrados, setClientesFiltrados] = useState([])
    const [mostrarResultados, setMostrarResultados] = useState(false)
    const [clienteSelecionadoObj, setClienteSelecionadoObj] = useState(null)

    // Financeiro Local
    const [valorMaoObra, setValorMaoObra] = useState(0)
    const [descontoMaoObra, setDescontoMaoObra] = useState(0)

    // --- CARREGAMENTO DE DADOS ---
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
                    centros: centros.data,
                    orcamentos: orcamentos.data,
                    reparacoes: reparacoes.data,
                    pecasExistentes: pecas.data || [],
                    clientes: clientes.data
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

    // --- LÓGICA DE CLIENTE ---
    const handleBuscaCliente = (e) => {
        const termo = e.target.value
        setBuscaCliente(termo)

        if (termo.length >= 2) {
            const filtrados = auxData.clientes.filter(c =>
                c.nome.toLowerCase().includes(termo.toLowerCase()) ||
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

    // --- GESTÃO DE PEÇAS (FUNCIONALIDADE EDITAR ADICIONADA) ---

    const validarPeca = () => {
        if (!novaPeca.tipopeca || !novaPeca.marca) {
            alert("Preencha tipo e marca");
            return false;
        }
        return true;
    }

    const gerirPeca = () => {
        if (!validarPeca()) return;

        // Dados formatados
        const quantidade = Number(novaPeca.quantidade) || 1;
        const preco_unitario = Number(novaPeca.preco_unitario) || 0;
        const desconto_percentual = Number(novaPeca.desconto_percentual) || 0;

        // Verifica se existe na BD geral
        const existeNoSistema = !!auxData.pecasExistentes.find(p =>
            p.tipopeca === novaPeca.tipopeca && p.marca === novaPeca.marca
        );

        const dadosPeca = {
            ...novaPeca,
            quantidade,
            preco_unitario,
            desconto_percentual,
            existeNoSistema
        };

        if (editingId) {
            // MODO EDIÇÃO: Atualiza a peça existente
            setPecasNecessarias(prev => prev.map(p => p.id === editingId ? { ...dadosPeca, id: editingId } : p));
            setEditingId(null); // Sai do modo de edição
        } else {
            // MODO ADIÇÃO: Cria nova peça
            setPecasNecessarias(prev => [...prev, { ...dadosPeca, id: Date.now() }]);
        }

        // Reset do formulário
        setNovaPeca(novaPecaInicial);

        // Focar novamente no input inicial para rapidez
        setTimeout(() => tipoPecaInputRef.current?.focus(), 100);
    };

    // Função chamada ao clicar no lápis da tabela
    const iniciarEdicao = (peca) => {
        if (peca.is_text) return; // Ignora se for texto
        setEditingId(peca.id);
        setNovaPeca({
            tipopeca: peca.tipopeca,
            marca: peca.marca,
            quantidade: peca.quantidade,
            preco_unitario: peca.preco_unitario,
            desconto_percentual: peca.desconto_percentual,
            tipo_desconto: "percentual",
            observacao: peca.observacao || ""
        });
        // Scroll suave ou foco para o formulário
        tipoPecaInputRef.current?.focus();
    }

    const cancelarEdicao = () => {
        setEditingId(null);
        setNovaPeca(novaPecaInicial);
    }

    const adicionarTexto = (e) => {
        if (e) e.preventDefault();
        setShowTextoInput(true)
        // Forçar foco após renderização
        setTimeout(() => {
            const input = document.getElementById('textoNotaInput');
            if (input) input.focus();
        }, 100);
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
        // Se estivermos a editar a peça que foi removida, cancelamos a edição
        if (editingId === id) cancelarEdicao();
    }

    // --- SUBMISSÃO ---
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

    const orcamentoAceito = form.estadoorcamento?.toLowerCase().match(/aceite|aceito|processo|concluído/);
    const pecasSimilares = auxData.pecasExistentes.filter(p => p.tipopeca.toLowerCase().includes(novaPeca.tipopeca.toLowerCase())).slice(0, 5)

    if (loadingData) return <div className="d-flex justify-content-center align-items-center vh-100"><div className="spinner-border text-primary"></div></div>

    return (
        <div className="container-fluid bg-light min-vh-100 pb-5">

            {/* Header Sticky */}
            <div className="bg-white border-bottom py-3 mb-4 shadow-sm sticky-top" style={{ zIndex: 100 }}>
                <div className="container d-flex justify-content-between align-items-center">
                    <div>
                        <h4 className="mb-0 fw-bold"><i className="bi bi-plus-circle-dotted me-2 text-primary"></i>Nova Reparação</h4>
                        <span className="text-muted small">Preencha os dados para dar entrada da máquina</span>
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary" onClick={() => navigate("/reparacoes")}>Cancelar</button>
                        <button className="btn btn-success px-4 fw-bold" onClick={handleSubmit} disabled={loading}>
                            {loading ? "A Processar..." : <><i className="bi bi-check-lg me-2"></i>Registar</>}
                        </button>
                    </div>
                </div>
            </div>

            <div className="container">
                {erro && <div className="alert alert-danger shadow-sm mb-4"><i className="bi bi-exclamation-triangle-fill me-2"></i>{erro}</div>}

                <div className="row g-4">
                    {/* --- COLUNA ESQUERDA (MAIN) --- */}
                    <div className="col-lg-8">

                        {/* DADOS DA MÁQUINA */}
                        <div className="card border-0 shadow-sm rounded-3 mb-4">
                            <div className="card-header bg-white fw-bold py-3"><i className="bi bi-laptop me-2 text-primary"></i>Dados do Equipamento</div>
                            <div className="card-body">
                                <div className="row g-3">
                                    <div className="col-md-8">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Nome da Máquina <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" name="nomemaquina" value={form.nomemaquina} onChange={e => setForm({ ...form, [e.target.name]: e.target.value })} placeholder="Ex: Rebarbadora Dewalt..." autoFocus />
                                    </div>
                                    <div className="col-md-4">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Nº da Rep <span className="text-danger">*</span></label>
                                        <input type="text" className="form-control" name="numreparacao" value={form.numreparacao} onChange={e => setForm({ ...form, [e.target.name]: e.target.value })} placeholder="Ex: 2024-001" />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Descrição da Avaria</label>
                                        <textarea className="form-control bg-light" rows="3" name="descricao" value={form.descricao} onChange={e => setForm({ ...form, [e.target.name]: e.target.value })} placeholder="Descreva o problema relatado..."></textarea>
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label small fw-bold text-muted text-uppercase">Centro de Reparação <span className="text-danger">*</span></label>
                                        <select className="form-select" name="nomecentro" value={form.nomecentro} onChange={e => setForm({ ...form, nomecentro: e.target.value })}>
                                            <option value="">Selecione...</option>
                                            {auxData.centros.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* PEÇAS E SERVIÇOS */}
                        <div className="card border-0 shadow-sm rounded-3">
                            <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                                <span className="fw-bold"><i className="bi bi-tools me-2 text-warning"></i>Peças e Materiais</span>
                                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={adicionarTexto}><i className="bi bi-type"></i> Nota Texto</button>
                            </div>

                            <div className="card-body p-0">
                                {/* INPUT DE TEXTO (Substitui prompt) */}
                                {showTextoInput && (
                                    <div className="p-3 border-bottom bg-light">
                                        <label className="small text-muted mb-1">Texto da Nota</label>
                                        <div className="input-group">
                                            <input id="textoNotaInput" type="text" className="form-control" placeholder="Escreva a nota aqui..." value={textoNota} onChange={e => setTextoNota(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmarTexto(); } }} />
                                            <button className="btn btn-success" onClick={confirmarTexto}><i className="bi bi-check-lg"></i></button>
                                            <button className="btn btn-outline-danger" onClick={() => setShowTextoInput(false)}><i className="bi bi-x-lg"></i></button>
                                        </div>
                                    </div>
                                )}

                                {/* FORMULÁRIO INLINE (ADICIONAR/EDITAR) */}
                                <div className={`p-3 border-bottom ${editingId ? 'bg-warning bg-opacity-10' : 'bg-light'}`}>
                                    {editingId && <div className="text-warning fw-bold small mb-2"><i className="bi bi-pencil-fill me-1"></i>A Editar Peça</div>}

                                    <div className="row g-2 align-items-end">
                                        <div className="col-md-4">
                                            <label className="small text-muted">Peça</label>
                                            <input list="pecas-list" className="form-control form-control-sm" ref={tipoPecaInputRef} name="tipopeca" value={novaPeca.tipopeca} onChange={e => setNovaPeca({ ...novaPeca, tipopeca: e.target.value })} placeholder="Nome da peça..." />
                                            <datalist id="pecas-list">{pecasSimilares.map((p, i) => <option key={i} value={p.tipopeca} />)}</datalist>
                                        </div>
                                        <div className="col-md-3">
                                            <label className="small text-muted">Ref.</label>
                                            <input type="text" className="form-control form-control-sm" name="marca" value={novaPeca.marca} onChange={e => setNovaPeca({ ...novaPeca, marca: e.target.value })} />
                                        </div>
                                        <div className="col-md-1">
                                            <label className="small text-muted">Qtd</label>
                                            <input type="number" className="form-control form-control-sm" value={novaPeca.quantidade} onChange={e => setNovaPeca({ ...novaPeca, quantidade: e.target.value })} min="1" />
                                        </div>
                                        <div className="col-md-2">
                                            <label className="small text-muted">Preço (€)</label>
                                            <input type="number" className="form-control form-control-sm" value={novaPeca.preco_unitario} onChange={e => setNovaPeca({ ...novaPeca, preco_unitario: e.target.value })} step="0.01" />
                                        </div>

                                        <div className="col-md-2 d-flex gap-1">
                                            {/* Botão dinâmico (Adicionar ou Atualizar) */}
                                            {editingId ? (
                                                <>
                                                    <button className="btn btn-sm btn-success w-100" onClick={gerirPeca} title="Guardar Alterações">
                                                        <i className="bi bi-check-lg"></i>
                                                    </button>
                                                    <button className="btn btn-sm btn-outline-danger w-100" onClick={cancelarEdicao} title="Cancelar Edição">
                                                        <i className="bi bi-x-lg"></i>
                                                    </button>
                                                </>
                                            ) : (
                                                <button className="btn btn-sm btn-primary w-100" onClick={gerirPeca} disabled={!novaPeca.tipopeca}>
                                                    <i className="bi bi-plus-lg"></i> Add
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* TABELA DE PEÇAS */}
                                <div className="table-responsive">
                                    <table className="table table-hover mb-0 align-middle" style={{ fontSize: '0.9rem' }}>
                                        <thead className="bg-light text-secondary">
                                            <tr>
                                                <th className="ps-4">Descrição</th>
                                                <th>Ref.</th>
                                                <th className="text-center">Qtd</th>
                                                <th className="text-end">Unit.</th>
                                                <th className="text-end pe-4">Total</th>
                                                <th className="text-end">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pecasNecessarias.length === 0 && <tr><td colSpan="6" className="text-center py-4 text-muted small">Adicione peças acima para ver a lista.</td></tr>}
                                            {pecasNecessarias.map((p, idx) => (
                                                <tr key={p.id || idx} className={`${p.is_text ? "table-light" : ""} ${editingId === p.id ? "table-warning" : ""}`}>
                                                    {p.is_text ? (
                                                        <td colSpan="5" className="ps-4 fst-italic text-muted"><i className="bi bi-justify-left me-2"></i>{p.texto}</td>
                                                    ) : (
                                                        <>
                                                            <td className="ps-4 fw-bold">{p.tipopeca}</td>
                                                            <td>{p.marca}</td>
                                                            <td className="text-center"><span className="badge bg-light text-dark border">{p.quantidade}</span></td>
                                                            <td className="text-end text-muted small">
                                                                {p.desconto_percentual > 0 && <span className="text-warning me-1">-{p.desconto_percentual}%</span>}
                                                                {formatCurrency(p.preco_unitario)}
                                                            </td>
                                                            <td className="text-end fw-bold">
                                                                {formatCurrency((p.preco_unitario * (1 - (p.desconto_percentual / 100))) * p.quantidade)}
                                                            </td>
                                                        </>
                                                    )}
                                                    <td className="text-end pe-4">
                                                        <div className="d-flex justify-content-end gap-2">
                                                            {!p.is_text && (
                                                                <button className="btn btn-link text-primary p-0" onClick={() => iniciarEdicao(p)} title="Editar">
                                                                    <i className="bi bi-pencil-square"></i>
                                                                </button>
                                                            )}
                                                            <button className="btn btn-link text-danger p-0" onClick={() => removerPeca(p.id)} title="Remover">
                                                                <i className="bi bi-trash"></i>
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
                    </div>

                    {/* --- COLUNA DIREITA (SIDEBAR) --- */}
                    <div className="col-lg-4">
                        {/* ... (MANTÉM-SE IGUAL À VERSÃO ANTERIOR) ... */}
                        {/* CLIENTE CARD */}
                        <div className="card border-0 shadow-sm rounded-3 mb-4">
                            <div className="card-body">
                                <h6 className="text-uppercase fw-bold text-muted mb-3" style={{ fontSize: '0.75rem' }}>Cliente <span className="text-danger">*</span></h6>
                                {showClienteForm ? (
                                    <div className="border rounded p-3 bg-light"><ClienteForm onSave={handleClienteSalvo} onCancel={() => setShowClienteForm(false)} /></div>
                                ) : (
                                    <>
                                        <div className="input-group mb-2">
                                            <span className="input-group-text bg-white"><i className="bi bi-search"></i></span>
                                            <input type="text" className="form-control" placeholder="Pesquisar Cliente..." value={buscaCliente} onChange={handleBuscaCliente} onFocus={() => buscaCliente.length >= 2 && setMostrarResultados(true)} />
                                            <button className="btn btn-outline-primary" onClick={() => setShowClienteForm(true)}><i className="bi bi-plus"></i></button>
                                        </div>
                                        {mostrarResultados && (
                                            <div className="list-group shadow-sm position-absolute w-100" style={{ zIndex: 1000, maxHeight: '200px', overflowY: 'auto' }}>
                                                {clientesFiltrados.map(c => (
                                                    <button key={c.id} className="list-group-item list-group-item-action" onClick={() => selecionarCliente(c)}>
                                                        <div className="fw-bold">{c.nome}</div>
                                                        <small className="text-muted">Nº {c.numero_interno} | {c.telefone}</small>
                                                    </button>
                                                ))}
                                                {clientesFiltrados.length === 0 && <div className="list-group-item text-muted text-center small">Sem resultados</div>}
                                            </div>
                                        )}
                                        {clienteSelecionadoObj && (
                                            <div className="alert alert-primary mb-0 d-flex align-items-center">
                                                <i className="bi bi-person-check-fill fs-4 me-3"></i>
                                                <div><div className="fw-bold">{clienteSelecionadoObj.nome}</div><div className="small opacity-75">{clienteSelecionadoObj.email || clienteSelecionadoObj.telefone}</div></div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* WORKFLOW CARD */}
                        <div className="card border-0 shadow-sm rounded-3 mb-4">
                            <div className="card-body">
                                <h6 className="text-uppercase fw-bold text-muted mb-3" style={{ fontSize: '0.75rem' }}>Workflow</h6>
                                <div className="row g-2 mb-3">
                                    <div className="col-6">
                                        <label className="form-label small fw-bold">Orçamento</label>
                                        <select className="form-select form-select-sm" name="estadoorcamento" value={form.estadoorcamento} onChange={e => setForm({ ...form, estadoorcamento: e.target.value })}>
                                            <option value="">Selecione...</option>
                                            {auxData.orcamentos.map(o => <option key={o.id} value={o.estado}>{o.estado}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label small fw-bold">Reparação</label>
                                        <select className="form-select form-select-sm" name="estadoreparacao" value={form.estadoreparacao} onChange={e => setForm({ ...form, estadoreparacao: e.target.value })}>
                                            <option value="">Selecione...</option>
                                            {auxData.reparacoes.map(r => <option key={r.id} value={r.estado}>{r.estado}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <hr className="border-light" />
                                <div className="mb-2">
                                    <label className="small text-muted">Entrada</label>
                                    <input type="date" className="form-control form-control-sm" name="dataentrega" value={form.dataentrega} onChange={e => setForm({ ...form, dataentrega: e.target.value })} />
                                </div>
                            </div>
                        </div>

                        {/* FINANCEIRO CARD */}
                        <div className="card border-0 shadow-sm rounded-3 bg-primary text-white">
                            <div className="card-body">
                                <h6 className="text-uppercase fw-bold mb-3 border-bottom border-white border-opacity-25 pb-2">Financeiro</h6>
                                <div className="row g-2 mb-3">
                                    <div className="col-8">
                                        <label className="small text-white text-opacity-75">Mão de Obra (€)</label>
                                        <input type="number" className="form-control form-control-sm bg-white bg-opacity-25 border-0 text-white" value={valorMaoObra} onChange={e => setValorMaoObra(parseFloat(e.target.value) || 0)} />
                                    </div>
                                    <div className="col-4">
                                        <label className="small text-white text-opacity-75">Desc. (%)</label>
                                        <input type="number" className="form-control form-control-sm bg-white bg-opacity-10 border-0 text-white" value={descontoMaoObra} onChange={e => setDescontoMaoObra(parseFloat(e.target.value) || 0)} max="100" />
                                    </div>
                                </div>
                                <div className="d-flex justify-content-between mb-1"><span className="small text-white text-opacity-75">Total Peças</span><span className="fw-bold">{formatCurrency(financeiros.totalPecas)}</span></div>
                                <div className="d-flex justify-content-between mb-1"><span className="small text-white text-opacity-75">Mão Obra (Líq)</span><span className="fw-bold">{formatCurrency(financeiros.moFinal)}</span></div>
                                <div className="d-flex justify-content-between mb-1"><span className="small text-white text-opacity-75">Total Geral (s/ IVA)</span><span className="fw-bold">{formatCurrency(financeiros.totalGeral)}</span></div>
                                <div className="mt-3 pt-2 border-top border-white border-opacity-25 d-flex justify-content-between align-items-center"><span>Total Final (c/ IVA)</span><span className="fs-3 fw-bold">{formatCurrency(financeiros.totalComIva)}</span></div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

export default ReparacoesRegisto