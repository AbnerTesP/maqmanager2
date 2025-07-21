"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import axios from "axios"
import { useNavigate } from "react-router-dom"
import ClienteForm from "../components/ClienteForm"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

function ReparacoesRegisto() {
    const [form, setForm] = useState({
        dataentrega: "",
        datasaida: "",
        dataconclusao: "",
        estadoorcamento: "",
        estadoreparacao: "",
        localcentro: "",
        nomecentro: "",
        nomemaquina: "",
        numreparacao: "",
        cliente_id: "",
        descricao: "",
    })
    const [centros, setCentros] = useState([])
    const [orcamentos, setOrcamentos] = useState([])
    const [reparacoes, setReparacoes] = useState([])
    const [clientes, setClientes] = useState([])
    const [erro, setErro] = useState("")
    const [loading, setLoading] = useState(false)
    const [loadingData, setLoadingData] = useState(true)
    const [showClienteForm, setShowClienteForm] = useState(false)
    const [clienteSelecionado, setClienteSelecionado] = useState("")
    const [pecasNecessarias, setPecasNecessarias] = useState([])
    const [novaPeca, setNovaPeca] = useState({
        tipopeca: "",
        marca: "",
        quantidade: 1,
        preco_unitario: 0,
        observacao: "",
    })
    const [pecasExistentes, setPecasExistentes] = useState([])
    const [mostrarPecas, setMostrarPecas] = useState(false)
    const [valorMaoObra, setValorMaoObra] = useState(0)

    // NOVOS ESTADOS APENAS PARA A PESQUISA DE CLIENTES
    const [buscaCliente, setBuscaCliente] = useState("")
    const [mostrarResultados, setMostrarResultados] = useState(false)
    const [clientesFiltrados, setClientesFiltrados] = useState([])

    const navigate = useNavigate()

    // Carregar dados iniciais
    const carregarDados = useCallback(() => {
        setLoadingData(true)
        Promise.allSettled([
            axios.get("http://localhost:8082/centros"),
            axios.get("http://localhost:8082/orcamentos"),
            axios.get("http://localhost:8082/estadoReparacoes"),
            axios.get("http://localhost:8082/pecas"),
            axios.get("http://localhost:8082/clientes"),
        ])
            .then(([centrosResult, orcamentosResult, reparacoesResult, pecasResult, clientesResult]) => {
                setCentros(centrosResult.status === "fulfilled" ? centrosResult.value.data : [])
                setOrcamentos(orcamentosResult.status === "fulfilled" ? orcamentosResult.value.data : [])
                setReparacoes(reparacoesResult.status === "fulfilled" ? reparacoesResult.value.data : [])
                setPecasExistentes(pecasResult.status === "fulfilled" ? pecasResult.value.data : [])
                setClientes(clientesResult.status === "fulfilled" ? clientesResult.value.data : [])
            })
            .finally(() => setLoadingData(false))
    }, [])

    useEffect(() => {
        carregarDados()
    }, [carregarDados])

    useEffect(() => {
        const orcamentoAceito =
            form.estadoorcamento &&
            (form.estadoorcamento.toLowerCase().includes("em processo") ||
                form.estadoorcamento.toLowerCase().includes("aceite"))
        setMostrarPecas(orcamentoAceito)
        if (!orcamentoAceito) setPecasNecessarias([])
    }, [form.estadoorcamento])

    const handleChange = useCallback((e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    }, [])

    // NOVA FUNÇÃO PARA BUSCA DE CLIENTES
    const handleBuscaClienteChange = useCallback(
        (e) => {
            const valor = e.target.value
            setBuscaCliente(valor)

            if (valor.length >= 2) {
                const filtrados = clientes.filter(
                    (cliente) =>
                        cliente.nome.toLowerCase().includes(valor.toLowerCase()) ||
                        (cliente.numero_interno && cliente.numero_interno.toString().includes(valor)),
                )
                setClientesFiltrados(filtrados)
                setMostrarResultados(true)
            } else {
                setMostrarResultados(false)
                setClientesFiltrados([])
            }
        },
        [clientes],
    )

    // NOVA FUNÇÃO PARA SELECIONAR CLIENTE DA BUSCA
    const selecionarClienteDaBusca = useCallback((cliente) => {
        setClienteSelecionado(cliente.id)
        setBuscaCliente(`${cliente.nome} ${cliente.numero_interno ? `(${cliente.numero_interno})` : ""}`)
        setMostrarResultados(false)
        setForm((prev) => ({
            ...prev,
            cliente_id: cliente.id,
        }))
    }, [])

    const handleClienteChange = useCallback(
        (e) => {
            const clienteId = e.target.value
            setClienteSelecionado(clienteId)
            setForm((prev) => ({
                ...prev,
                cliente_id: clienteId,
            }))

            // Atualizar campo de busca quando selecionado pelo dropdown
            if (clienteId) {
                const cliente = clientes.find((c) => String(c.id) === String(clienteId))
                if (cliente) {
                    setBuscaCliente(`${cliente.nome} ${cliente.numero_interno ? `(${cliente.numero_interno})` : ""}`)
                }
            } else {
                setBuscaCliente("")
            }
        },
        [clientes],
    )

    const handleNovoCliente = useCallback(() => {
        setShowClienteForm(true)
    }, [])

    const handleClienteSalvo = useCallback(() => {
        setShowClienteForm(false)
        axios
            .get("http://localhost:8082/clientes")
            .then((response) => {
                setClientes(response.data)
                if (response.data.length > 0) {
                    const ultimoCliente = response.data[response.data.length - 1]
                    setClienteSelecionado(ultimoCliente.id)
                    setBuscaCliente(
                        `${ultimoCliente.nome} ${ultimoCliente.numero_interno ? `(${ultimoCliente.numero_interno})` : ""}`,
                    )
                    setForm((prev) => ({
                        ...prev,
                        cliente_id: ultimoCliente.id,
                    }))
                }
            })
            .catch(() => console.error("Erro ao recarregar clientes"))
    }, [])

    const handleCentroChange = useCallback(
        (e) => {
            const centroId = e.target.value
            const centroSelecionado = centros.find((c) => String(c.id) === String(centroId))
            setForm((prev) => ({
                ...prev,
                nomecentro: centroSelecionado ? centroSelecionado.nome : "",
            }))
        },
        [centros],
    )

    const handleOrcamentoChange = useCallback(
        (e) => {
            const orcamentoId = e.target.value
            const orcamentoSelecionado = orcamentos.find((o) => String(o.id) === String(orcamentoId))
            setForm((prev) => ({
                ...prev,
                estadoorcamento: orcamentoSelecionado ? orcamentoSelecionado.estado : "",
            }))
        },
        [orcamentos],
    )

    const handleEstadoreparacaoChange = useCallback(
        (e) => {
            const estadareparacaoId = e.target.value
            const estadareparacaoSelecionado = reparacoes.find((o) => String(o.id) === String(estadareparacaoId))
            setForm((prev) => ({
                ...prev,
                estadoreparacao: estadareparacaoSelecionado ? estadareparacaoSelecionado.estado : "",
            }))
        },
        [reparacoes],
    )

    // Peças
    const handleNovaPecaChange = useCallback((e) => {
        const { name, value } = e.target
        setNovaPeca((prev) => ({
            ...prev,
            [name]:
                name === "quantidade"
                    ? Number.parseInt(value) || 1
                    : name === "preco_unitario"
                        ? Number.parseFloat(value) || 0
                        : value,
        }))
    }, [])

    const verificarPecaExistente = useCallback(
        (tipopeca, marca) =>
            pecasExistentes.find(
                (peca) =>
                    peca.tipopeca.toLowerCase().trim() === tipopeca.toLowerCase().trim() &&
                    peca.marca.toLowerCase().trim() === marca.toLowerCase().trim(),
            ),
        [pecasExistentes],
    )

    const adicionarPeca = useCallback(() => {
        if (!novaPeca.tipopeca.trim() || !novaPeca.marca.trim()) {
            setErro("Tipo de peça e marca são obrigatórios.")
            return
        }
        const pecaJaAdicionada = pecasNecessarias.find(
            (peca) =>
                peca.tipopeca.toLowerCase().trim() === novaPeca.tipopeca.toLowerCase().trim() &&
                peca.marca.toLowerCase().trim() === novaPeca.marca.toLowerCase().trim(),
        )
        if (pecaJaAdicionada) {
            setErro("Esta peça já foi adicionada à lista.")
            return
        }
        const pecaExistente = verificarPecaExistente(novaPeca.tipopeca, novaPeca.marca)
        const novaPecaCompleta = {
            ...novaPeca,
            id: Date.now(),
            existeNoSistema: !!pecaExistente,
            pecaExistente: pecaExistente || null,
        }
        setPecasNecessarias((prev) => [...prev, novaPecaCompleta])
        setNovaPeca({ tipopeca: "", marca: "", quantidade: 1, preco_unitario: 0, observacao: "" })
        setErro("")
    }, [novaPeca, pecasNecessarias, verificarPecaExistente])

    const removerPeca = useCallback((id) => {
        setPecasNecessarias((prev) => prev.filter((peca) => peca.id !== id))
    }, [])

    const buscarPecasSimilares = useCallback(
        (tipopeca) => {
            if (!tipopeca.trim()) return []
            return pecasExistentes
                .filter((peca) => peca.tipopeca.toLowerCase().includes(tipopeca.toLowerCase().trim()))
                .slice(0, 5)
        },
        [pecasExistentes],
    )

    const calcularTotais = useCallback(() => {
        const totalPecas = pecasNecessarias.reduce((total, peca) => {
            return total + peca.preco_unitario * peca.quantidade
        }, 0)

        const totalGeral = totalPecas + valorMaoObra

        return {
            totalPecas: totalPecas.toFixed(2),
            totalGeral: totalGeral.toFixed(2),
        }
    }, [pecasNecessarias, valorMaoObra])

    const pecasSimilares = useMemo(
        () => buscarPecasSimilares(novaPeca.tipopeca),
        [buscarPecasSimilares, novaPeca.tipopeca],
    )

    const clienteSelecionadoObj = useMemo(
        () => clientes.find((c) => String(c.id) === String(clienteSelecionado)),
        [clientes, clienteSelecionado],
    )

    const validarFormulario = useCallback(() => {
        if (!form.dataentrega) {
            setErro("A data de entrada é obrigatória.")
            return false
        }
        if (form.dataconclusao && new Date(form.dataconclusao) < new Date(form.dataentrega)) {
            setErro("A data de conclusão deve ser posterior à data de entrada.")
            return false
        }
        if (form.datasaida && form.dataconclusao && new Date(form.datasaida) < new Date(form.dataconclusao)) {
            setErro("A data de saída deve ser posterior à data de conclusão.")
            return false
        }
        if (!form.estadoreparacao || !form.nomemaquina || !form.cliente_id) {
            setErro("Todos os campos obrigatórios devem ser preenchidos (incluindo cliente).")
            return false
        }
        return true
    }, [form])

    const handleSubmit = useCallback(
        (e) => {
            e.preventDefault()
            setErro("")
            if (!validarFormulario()) return
            setLoading(true)

            const totais = calcularTotais()
            const dadosReparacao = {
                ...form,
                mao_obra: valorMaoObra.toFixed(2),
                totalPecas: totais.totalPecas,
                totalGeral: totais.totalGeral,
                pecasNecessarias: mostrarPecas ? pecasNecessarias : [],
            }

            axios
                .post("http://localhost:8082/reparacoes", dadosReparacao)
                .then(() => {
                    alert("Reparação registrada com sucesso!")
                    navigate("/reparacoes")
                })
                .catch(() => setErro("Erro ao registrar reparação. Por favor, tente novamente."))
                .finally(() => setLoading(false))
        },
        [form, validarFormulario, mostrarPecas, pecasNecessarias, navigate, valorMaoObra, calcularTotais],
    )

    const handleCancel = useCallback(() => {
        if (window.confirm("Tem certeza que deseja cancelar? Todas as alterações serão perdidas.")) {
            navigate("/reparacoes")
        }
    }, [navigate])

    if (loadingData) {
        return (
            <div className="container mt-4 text-center">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando...</span>
                </div>
                <p className="mt-2">Carregando dados...</p>
            </div>
        )
    }

    const totais = calcularTotais()

    return (
        <div className="container mt-4">
            <div className="card shadow-sm">
                <div className="card-header bg-primary text-white">
                    <h4 className="mb-0">
                        <i className="bi bi-tools me-2"></i>
                        Registo de Reparação
                    </h4>
                </div>
                <div className="card-body">
                    {erro && (
                        <div className="alert alert-danger d-flex align-items-center" role="alert">
                            <i className="bi bi-exclamation-triangle-fill me-2"></i>
                            <div>{erro}</div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="row">
                            {/* Coluna da esquerda */}
                            <div className="col-md-6">
                                {/* Seção do Cliente - MANTIDA ORIGINAL + PESQUISA */}
                                <div className="card mb-3">
                                    <div className="card-header bg-light">
                                        <h5 className="mb-0">
                                            <i className="bi bi-person-fill me-2"></i>
                                            Informações do Cliente
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        {!showClienteForm ? (
                                            <>
                                                {/* NOVA FUNCIONALIDADE: Campo de Pesquisa */}
                                                <div className="mb-3">
                                                    <label className="form-label">
                                                        <i className="bi bi-search me-1"></i>
                                                        Pesquisar Cliente
                                                    </label>
                                                    <div className="position-relative">
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            value={buscaCliente}
                                                            onChange={handleBuscaClienteChange}
                                                            placeholder="Digite o nome ou número interno do cliente..."
                                                        />

                                                        {mostrarResultados && clientesFiltrados.length > 0 && (
                                                            <div
                                                                className="position-absolute w-100 bg-white border rounded shadow-sm mt-1"
                                                                style={{ zIndex: 1000, maxHeight: "200px", overflowY: "auto" }}
                                                            >
                                                                {clientesFiltrados.map((cliente) => (
                                                                    <div
                                                                        key={cliente.id}
                                                                        className="p-2 border-bottom cursor-pointer hover-bg-light"
                                                                        onClick={() => selecionarClienteDaBusca(cliente)}
                                                                        style={{ cursor: "pointer" }}
                                                                        onMouseEnter={(e) => (e.target.style.backgroundColor = "#f8f9fa")}
                                                                        onMouseLeave={(e) => (e.target.style.backgroundColor = "white")}
                                                                    >
                                                                        <div className="fw-bold">{cliente.nome}</div>
                                                                        <small className="text-muted">
                                                                            {cliente.numero_interno && `Nº: ${cliente.numero_interno} | `}
                                                                            {cliente.telefone && `Tel: ${cliente.telefone} | `}
                                                                            {cliente.email && `Email: ${cliente.email}`}
                                                                        </small>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {mostrarResultados && clientesFiltrados.length === 0 && buscaCliente.length >= 2 && (
                                                            <div
                                                                className="position-absolute w-100 bg-white border rounded shadow-sm mt-1 p-3 text-center text-muted"
                                                                style={{ zIndex: 1000 }}
                                                            >
                                                                <i className="bi bi-search me-2"></i>
                                                                Nenhum cliente encontrado
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="form-text">
                                                        Digite pelo menos 2 caracteres para pesquisar por nome ou número interno.
                                                    </div>
                                                </div>

                                                {/* FORMULÁRIO ORIGINAL MANTIDO */}
                                                <div className="mb-3">
                                                    <label className="form-label">
                                                        <i className="bi bi-person-fill me-1"></i>
                                                        Cliente <span className="text-danger">*</span>
                                                    </label>
                                                    <div className="input-group">
                                                        <select
                                                            className="form-select"
                                                            value={clienteSelecionado}
                                                            onChange={handleClienteChange}
                                                            required
                                                            style={{ maxHeight: "50px", overflowY: "auto" }} // <-- aqui!
                                                        >
                                                            <option value="">Selecione um cliente</option>
                                                            {clientes.map((cliente) => (
                                                                <option key={cliente.id} value={cliente.id}>
                                                                    {cliente.nome} {cliente.numero_interno ? `(${cliente.numero_interno})` : ""}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <button type="button" className="btn btn-outline-primary" onClick={handleNovoCliente}>
                                                            <i className="bi bi-plus-circle me-1"></i>
                                                            Novo
                                                        </button>
                                                    </div>
                                                </div>

                                                {clienteSelecionadoObj && (
                                                    <div className="alert alert-info">
                                                        <small>
                                                            <strong>Cliente selecionado:</strong> {clienteSelecionadoObj.nome}
                                                            <br />
                                                            <strong>Contacto:</strong> {clienteSelecionadoObj.telefone || "N/A"}
                                                            <br />
                                                            <strong>Nº Interno:</strong> {clienteSelecionadoObj.numero_interno || "N/A"}
                                                        </small>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <ClienteForm onSave={handleClienteSalvo} onCancel={() => setShowClienteForm(false)} />
                                        )}
                                    </div>
                                </div>

                                <div className="card mb-3">
                                    <div className="card-header bg-light">
                                        <h5 className="mb-0">Informações da Máquina</h5>
                                    </div>
                                    <div className="card-body">
                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-hash me-1"></i>
                                                Número da Reparação
                                            </label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                name="numreparacao"
                                                value={form.numreparacao}
                                                onChange={handleChange}
                                                placeholder="Ex: 12345"
                                            />
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-laptop me-1"></i>
                                                Nome da Máquina <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className="form-control"
                                                name="nomemaquina"
                                                value={form.nomemaquina}
                                                onChange={handleChange}
                                                required
                                                placeholder="Ex: Rebarbadora Dewalt DWE415"
                                            />
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-chat-left-text me-1"></i>
                                                Descrição da Reparação
                                            </label>
                                            <textarea
                                                className="form-control"
                                                name="descricao"
                                                value={form.descricao}
                                                onChange={handleChange}
                                                rows="3"
                                                placeholder="Descreva o problema ou serviço a ser realizado..."
                                            />
                                            <div className="form-text">Descrição detalhada do problema ou serviço</div>
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-building me-1"></i>
                                                Centro de Reparação <span className="text-danger">*</span>
                                            </label>
                                            <select
                                                className="form-select"
                                                onChange={handleCentroChange}
                                                required
                                                value={centros.find((c) => c.nome === form.nomecentro)?.id || ""}
                                            >
                                                <option value="">Selecione um centro</option>
                                                {centros.map((centro) => (
                                                    <option key={centro.id} value={centro.id}>
                                                        {centro.nome}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="card mb-3">
                                    <div className="card-header bg-light">
                                        <h5 className="mb-0">Estados</h5>
                                    </div>
                                    <div className="card-body">
                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-cash-coin me-1"></i>
                                                Estado do Orçamento
                                            </label>
                                            <select
                                                className="form-select"
                                                onChange={handleOrcamentoChange}
                                                value={orcamentos.find((o) => o.estado === form.estadoorcamento)?.id || ""}
                                            >
                                                <option value="">Selecione o estado do Orçamento</option>
                                                {orcamentos.map((orc) => (
                                                    <option key={orc.id} value={orc.id}>
                                                        {orc.estado}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-wrench me-1"></i>
                                                Estado da Reparação <span className="text-danger">*</span>
                                            </label>
                                            <select
                                                className="form-select"
                                                onChange={handleEstadoreparacaoChange}
                                                required
                                                value={reparacoes.find((r) => r.estado === form.estadoreparacao)?.id || ""}
                                            >
                                                <option value="">Selecione o estado da Reparação</option>
                                                {reparacoes.map((rep) => (
                                                    <option key={rep.id} value={rep.id}>
                                                        {rep.estado}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Coluna da direita */}
                            <div className="col-md-6">
                                <div className="card mb-3">
                                    <div className="card-header bg-light">
                                        <h5 className="mb-0">Datas</h5>
                                    </div>
                                    <div className="card-body">
                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-calendar-plus me-1"></i>
                                                Data de Entrega <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                className="form-control"
                                                name="dataentrega"
                                                value={form.dataentrega}
                                                onChange={handleChange}
                                                required
                                            />
                                            <div className="form-text">Data em que a máquina entrou na loja</div>
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-calendar-check me-1"></i>
                                                Data de Conclusão
                                            </label>
                                            <input
                                                type="date"
                                                className="form-control"
                                                name="dataconclusao"
                                                value={form.dataconclusao}
                                                onChange={handleChange}
                                            />
                                            <div className="form-text">Data em que a reparação foi concluída</div>
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-calendar-x me-1"></i>
                                                Data de Saída
                                            </label>
                                            <input
                                                type="date"
                                                className="form-control"
                                                name="datasaida"
                                                value={form.datasaida}
                                                onChange={handleChange}
                                            />
                                            <div className="form-text">Data em que a máquina saiu da loja</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Seção de Valores */}
                                <div className="card mb-3">
                                    <div className="card-header bg-light">
                                        <h5 className="mb-0">
                                            <i className="bi bi-currency-euro me-2"></i>
                                            Valores
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-tools me-1"></i>
                                                Valor da Mão de Obra (€)
                                            </label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                value={valorMaoObra === 0 ? "" : valorMaoObra}
                                                onChange={(e) => setValorMaoObra(Number.parseFloat(e.target.value) || 0)}
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                            />
                                        </div>

                                        {/* Resumo Financeiro */}
                                        <div className="card bg-light">
                                            <div className="card-body">
                                                <h6 className="card-title">
                                                    <i className="bi bi-calculator me-1"></i>
                                                    Resumo Financeiro
                                                </h6>
                                                <div className="row text-center">
                                                    <div className="col-6">
                                                        <div className="border-end">
                                                            <h5 className="text-primary mb-0">€{totais.totalPecas}</h5>
                                                            <small className="text-muted">Total Peças</small>
                                                        </div>
                                                    </div>
                                                    <div className="col-6">
                                                        <h5 className="text-success mb-0">€{totais.totalGeral}</h5>
                                                        <small className="text-muted">Total Geral</small>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="alert alert-info" role="alert">
                                    <h5 className="alert-heading">
                                        <i className="bi bi-info-circle me-2"></i>
                                        Informações
                                    </h5>
                                    <p>
                                        Os campos marcados com <span className="text-danger">*</span> são obrigatórios.
                                    </p>
                                    <hr />
                                    <p className="mb-0">
                                        É obrigatório selecionar ou criar um cliente antes de registrar a reparação. As datas de conclusão e
                                        saída podem ser preenchidas posteriormente.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Seção de Peças - Aparece apenas quando orçamento é aceito */}
                        {mostrarPecas && (
                            <div className="mt-4">
                                <div className="card">
                                    <div className="card-header bg-success text-white d-flex justify-content-between align-items-center">
                                        <h5 className="mb-0">
                                            <i className="bi bi-wrench-adjustable-circle me-2"></i>
                                            Peças Necessárias para Reparação
                                        </h5>
                                        <span className="badge bg-light text-success">Orçamento Aceito</span>
                                    </div>
                                    <div className="card-body">
                                        {/* Adicionar Nova Peça */}
                                        <div className="card mb-3">
                                            <div className="card-header bg-primary text-white">
                                                <h6 className="mb-0">
                                                    <i className="bi bi-plus-circle me-2"></i>
                                                    Adicionar Peça
                                                </h6>
                                            </div>
                                            <div className="card-body">
                                                <div className="row g-3">
                                                    <div className="col-md-3">
                                                        <label className="form-label">Tipo de Peça</label>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            name="tipopeca"
                                                            value={novaPeca.tipopeca}
                                                            onChange={handleNovaPecaChange}
                                                            placeholder="Ex: Filtro, Correia, Pistão..."
                                                            list="pecas-sugestoes"
                                                        />
                                                        {pecasSimilares.length > 0 && (
                                                            <datalist id="pecas-sugestoes">
                                                                {pecasSimilares.map((peca, index) => (
                                                                    <option key={index} value={peca.tipopeca} />
                                                                ))}
                                                            </datalist>
                                                        )}
                                                    </div>
                                                    <div className="col-md-3">
                                                        <label className="form-label">Descrição Interna</label>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            name="marca"
                                                            value={novaPeca.marca}
                                                            onChange={handleNovaPecaChange}
                                                            placeholder="Ex: Bosch, Mann, Donaldson..."
                                                        />
                                                    </div>
                                                    <div className="col-md-2">
                                                        <label className="form-label">Quantidade</label>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            name="quantidade"
                                                            value={novaPeca.quantidade}
                                                            onChange={handleNovaPecaChange}
                                                            min="1"
                                                        />
                                                    </div>
                                                    <div className="col-md-2">
                                                        <label className="form-label">Preço Unit. (€)</label>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            name="preco_unitario"
                                                            value={novaPeca.preco_unitario === 0 ? "" : novaPeca.preco_unitario}
                                                            onChange={handleNovaPecaChange}
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    <div className="col-md-2">
                                                        <label className="form-label">&nbsp;</label>
                                                        <button type="button" className="btn btn-primary w-100" onClick={adicionarPeca}>
                                                            <i className="bi bi-plus-lg"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="row g-3 mt-2">
                                                    <div className="col-12">
                                                        <label className="form-label">Observações</label>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            name="observacao"
                                                            value={novaPeca.observacao}
                                                            onChange={handleNovaPecaChange}
                                                            placeholder="Observações sobre a peça (opcional)"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Lista de Peças Adicionadas */}
                                        {pecasNecessarias.length > 0 && (
                                            <div className="card">
                                                <div className="card-header bg-light">
                                                    <h6 className="mb-0">
                                                        <i className="bi bi-list-check me-2"></i>
                                                        Peças Adicionadas ({pecasNecessarias.length})
                                                    </h6>
                                                </div>
                                                <div className="card-body">
                                                    <div className="table-responsive">
                                                        <table className="table table-hover">
                                                            <thead>
                                                                <tr>
                                                                    <th>Tipo de Peça</th>
                                                                    <th>Marca</th>
                                                                    <th>Qtd</th>
                                                                    <th>Preço Unit.</th>
                                                                    <th>Total</th>
                                                                    <th>Status</th>
                                                                    <th>Ações</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {pecasNecessarias.map((peca) => (
                                                                    <tr key={peca.id}>
                                                                        <td>
                                                                            <strong>{peca.tipopeca}</strong>
                                                                            {peca.observacao && (
                                                                                <div>
                                                                                    <small className="text-muted">{peca.observacao}</small>
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td>{peca.marca}</td>
                                                                        <td>
                                                                            <span className="badge bg-info">{peca.quantidade}</span>
                                                                        </td>
                                                                        <td>€{peca.preco_unitario.toFixed(2)}</td>
                                                                        <td>
                                                                            <strong>€{(peca.preco_unitario * peca.quantidade).toFixed(2)}</strong>
                                                                        </td>
                                                                        <td>
                                                                            {peca.existeNoSistema ? (
                                                                                <div>
                                                                                    <span className="badge bg-success">
                                                                                        <i className="bi bi-check-circle me-1"></i>
                                                                                        Existe no Sistema
                                                                                    </span>
                                                                                    <br />
                                                                                    <small className="text-muted">
                                                                                        Máquina: {peca.pecaExistente.maquina_tipo} -{" "}
                                                                                        {peca.pecaExistente.maquina_marca}
                                                                                    </small>
                                                                                </div>
                                                                            ) : (
                                                                                <span className="badge bg-warning">
                                                                                    <i className="bi bi-exclamation-circle me-1"></i>
                                                                                    Não Encontrada
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td>
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-outline-danger btn-sm"
                                                                                onClick={() => removerPeca(peca.id)}
                                                                                title="Remover peça"
                                                                            >
                                                                                <i className="bi bi-trash"></i>
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="d-flex justify-content-between mt-4">
                            <button type="button" className="btn btn-outline-secondary" onClick={handleCancel}>
                                <i className="bi bi-x-circle me-1"></i>
                                Cancelar
                            </button>

                            <button type="submit" className="btn btn-success" disabled={loading || showClienteForm}>
                                {loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Processando...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-check-circle me-1"></i>
                                        Registrar Reparação (€{totais.totalGeral})
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default ReparacoesRegisto
