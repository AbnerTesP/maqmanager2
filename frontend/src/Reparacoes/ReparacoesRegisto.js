"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import ReactModal from 'react-modal';
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
    const [pecaEditavel, setPecaEditavel] = useState(null);
    const [clienteSelecionado, setClienteSelecionado] = useState("")
    const [pecasNecessarias, setPecasNecessarias] = useState([])
    const novaPecaInicial = {
        tipopeca: "",
        marca: "",
        quantidade: 1,
        preco_unitario: 0,
        preco_com_desconto: 0,
        desconto_unitario: 0,
        desconto_percentual: 0,
        tipo_desconto: "nenhum",
        observacao: "",
    };

    const [novaPeca, setNovaPeca] = useState(novaPecaInicial);
    const [pecasExistentes, setPecasExistentes] = useState([])
    const [mostrarPecas, setMostrarPecas] = useState(false)
    const [valorMaoObra, setValorMaoObra] = useState(0)
    const [buscaCliente, setBuscaCliente] = useState("")
    const [mostrarResultados, setMostrarResultados] = useState(false)
    const [descontoMaoObra, setDescontoMaoObra] = useState(0);
    const [clientesFiltrados, setClientesFiltrados] = useState([])

    const [showModalDesconto, setShowModalDesconto] = useState(false);
    const [pecaSelecionada, setPecaSelecionada] = useState(null);
    const [descontoAtual, setDescontoAtual] = useState({
        tipo: 'nenhum',
        valor: 0,
        percentual: 0
    });

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
        ReactModal.setAppElement('#root');
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

    // Corrigir cálculo do total da peça
    const calcularTotalPeca = (peca) => {
        if (!peca || !peca.preco_unitario || !peca.quantidade) return 0;
        return calcularPrecoComDesconto(peca) * peca.quantidade;
    };

    const iniciarEdicaoPeca = (peca) => {
        setPecaEditavel(peca);
        setNovaPeca({
            tipopeca: peca.tipopeca,
            marca: peca.marca,
            quantidade: peca.quantidade,
            preco_unitario: peca.preco_unitario,
            preco_com_desconto: peca.preco_com_desconto,
            desconto_unitario: peca.desconto_unitario || 0,
            desconto_percentual: peca.desconto_percentual || 0,
            tipo_desconto: peca.tipo_desconto || "nenhum",
            observacao: peca.observacao || ""
        });
    };

    const cancelarEdicao = () => {
        setPecaEditavel(null);
        setNovaPeca(novaPecaInicial);
    };

    const atualizarPeca = () => {
        if (!novaPeca.tipopeca.trim() || !novaPeca.marca.trim()) {
            setErro("Tipo de peça e marca são obrigatórios.");
            return;
        }

        const precoFinal = calcularPrecoComDesconto(novaPeca);

        setPecasNecessarias(prev =>
            prev.map(peca =>
                peca.id === pecaEditavel.id
                    ? {
                        ...peca,
                        tipopeca: novaPeca.tipopeca,
                        marca: novaPeca.marca,
                        quantidade: novaPeca.quantidade,
                        preco_unitario: novaPeca.preco_unitario,
                        preco_com_desconto: precoFinal,
                        desconto_unitario: novaPeca.desconto_unitario,
                        desconto_percentual: novaPeca.desconto_percentual,
                        tipo_desconto: novaPeca.tipo_desconto,
                        observacao: novaPeca.observacao
                    }
                    : peca
            )
        );

        cancelarEdicao();
    };

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

    const selecionarCliente = useCallback((cliente) => {
        setClienteSelecionado(cliente.id)
        setBuscaCliente(`${cliente.nome} ${cliente.numero_interno ? `(${cliente.numero_interno})` : ""}`)
        setMostrarResultados(false)
        setForm((prev) => ({ ...prev, cliente_id: String(cliente.id) }))
    }, [])



    const handleClienteChange = useCallback(
        (e) => {
            const clienteId = e.target.value
            setClienteSelecionado(clienteId)
            setForm((prev) => ({
                ...prev,
                cliente_id: clienteId,
            }))

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

    const handleClienteSalvo = async (clienteId) => {
        setShowClienteForm(false);

        // Recarregar lista de clientes
        try {
            const response = await axios.get("http://localhost:8082/clientes");
            const novosClientes = Array.isArray(response.data) ? response.data : [];
            setClientes(novosClientes);

            // Selecionar o cliente recém-criado ou o selecionado anteriormente
            let clienteParaSelecionar = null;

            if (clienteId) {
                clienteParaSelecionar = novosClientes.find((c) => String(c.id) === String(clienteId));
            } else if (clienteSelecionado) {
                // Se não temos um novo ID, mantemos o selecionado anteriormente
                clienteParaSelecionar = novosClientes.find((c) => String(c.id) === String(clienteSelecionado));
            }

            if (clienteParaSelecionar) {
                console.log("Cliente encontrado:", clienteParaSelecionar);
                selecionarCliente(clienteParaSelecionar);
            } else if (novosClientes.length > 0) {
                // Fallback: selecionar o cliente mais recente se não encontrarmos o específico
                const clienteMaisRecente = [...novosClientes].sort((a, b) => b.id - a.id)[0];
                console.log("Selecionando cliente mais recente:", clienteMaisRecente);
                selecionarCliente(clienteMaisRecente);
            }
        } catch (error) {
            console.error("Erro ao recarregar clientes:", error);
            setErro("Erro ao recarregar lista de clientes");
        }
    };

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

    const abrirModalDesconto = (pecaId) => {
        const peca = pecasNecessarias.find(p => p.id === pecaId);
        setPecaSelecionada(peca);

        // Preencher com os descontos existentes se houver
        setDescontoAtual({
            tipo: peca.tipo_desconto || 'nenhum',
            valor: peca.desconto_unitario || 0,
            percentual: peca.desconto_percentual || 0
        });

        setShowModalDesconto(true);
    };

    const fecharModalDesconto = () => {
        setShowModalDesconto(false);
        setPecaSelecionada(null);
    };

    const calcularPrecoComDesconto = useCallback((peca) => {
        if (!peca) return 0;
        let preco = Number(peca.preco_unitario) || 0;
        if (peca.tipo_desconto === "valor" && peca.desconto_unitario > 0) {
            preco = Math.max(0, preco - Number(peca.desconto_unitario));
        } else if (peca.tipo_desconto === "percentual" && peca.desconto_percentual > 0) {
            preco = preco * (1 - Number(peca.desconto_percentual) / 100);
        }
        return preco;
    }, []);

    const aplicarDesconto = () => {
        const pecasAtualizadas = pecasNecessarias.map(peca => {
            if (peca.id === pecaSelecionada.id) {
                return {
                    ...peca,
                    tipo_desconto: descontoAtual.tipo === 'nenhum' ? null : descontoAtual.tipo,
                    desconto_unitario: descontoAtual.tipo === 'valor' ? descontoAtual.valor : null,
                    desconto_percentual: descontoAtual.tipo === 'percentual' ? descontoAtual.percentual : null,
                    preco_com_desconto: calcularPrecoComDesconto()
                };
            }
            return peca;
        });

        setPecasNecessarias(pecasAtualizadas);
        fecharModalDesconto();
    };




    const handleNovaPecaChange = (e) => {
        const { name, value } = e.target;
        setNovaPeca(prev => {
            let val = value;
            if (["preco_unitario", "desconto_unitario", "desconto_percentual", "quantidade"].includes(name)) {
                val = Number(val) || 0;
            }
            const updated = { ...prev, [name]: val };
            if (name === "tipo_desconto") {
                updated.desconto_unitario = 0;
                updated.desconto_percentual = 0;
            }
            return updated;
        });
    };

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
        if (novaPeca.tipo_desconto === "percentual" && (novaPeca.desconto_percentual < 0 || novaPeca.desconto_percentual > 100)) {
            setErro("O desconto percentual deve estar entre 0% e 100%.")
            return
        }
        if (novaPeca.preco_unitario < 0) {
            setErro("O preço unitário não pode ser negativo.")
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
        const precoFinal = calcularPrecoComDesconto(novaPeca);
        const pecaExistente = verificarPecaExistente(novaPeca.tipopeca, novaPeca.marca)
        const novaPecaCompleta = {
            ...novaPeca,
            id: Date.now(),
            ordem: pecasNecessarias.length, // Adiciona um índice de ordem
            preco_com_desconto: precoFinal,
            existeNoSistema: !!pecaExistente,
            pecaExistente: pecaExistente || null
        };
        setPecasNecessarias((prev) => [...prev, novaPecaCompleta]);
        setNovaPeca(novaPecaInicial);
        setErro("");
    }, [novaPeca, pecasNecessarias, verificarPecaExistente, calcularPrecoComDesconto, novaPecaInicial]);

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
        let totalPecas = 0, totalDescontos = 0;

        // Cálculo das peças
        pecasNecessarias.forEach(peca => {
            const precoDesc = calcularPrecoComDesconto(peca);
            totalPecas += precoDesc * peca.quantidade;
            totalDescontos += (peca.preco_unitario - precoDesc) * peca.quantidade;
        });

        // Aplicar desconto na mão de obra
        const maoObraComDesconto = valorMaoObra * (1 - (descontoMaoObra / 100));
        const descontoMaoObraValor = valorMaoObra - maoObraComDesconto;

        const totalGeral = totalPecas + maoObraComDesconto;

        return {
            totalPecas: totalPecas.toFixed(2),
            totalGeral: totalGeral.toFixed(2),
            totalDescontos: (totalDescontos + descontoMaoObraValor).toFixed(2),
            totalSemDescontos: (totalPecas + totalDescontos + valorMaoObra).toFixed(2),
            maoObraComDesconto: maoObraComDesconto.toFixed(2),
            descontoMaoObraValor: descontoMaoObraValor.toFixed(2)
        };
    }, [pecasNecessarias, valorMaoObra, descontoMaoObra, calcularPrecoComDesconto]);

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
                totalDescontos: totais.totalDescontos,
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
                                {/* Seção do Cliente */}
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
                                                                        onClick={() => selecionarCliente(cliente)}
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
                                                            style={{ maxHeight: "50px", overflowY: "auto" }}
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

                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-percent me-1"></i>
                                                Desconto na Mão de Obra (%)
                                            </label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                value={descontoMaoObra === 0 ? "" : descontoMaoObra}
                                                onChange={(e) => setDescontoMaoObra(Number.parseFloat(e.target.value) || 0)}
                                                min="0"
                                                max="100"
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
                                                    <div className="col-md-3 border-end">
                                                        <h5 className="text-primary mb-0">€{totais.totalSemDescontos}</h5>
                                                        <small className="text-muted">Total Sem Descontos</small>
                                                    </div>
                                                    <div className="col-md-3 border-end">
                                                        <h5 className="text-danger mb-0">-€{totais.totalDescontos}</h5>
                                                        <small className="text-muted">Total Descontos</small>
                                                    </div>
                                                    <div className="col-md-3 border-end">
                                                        <h5 className="text-primary mb-0">€{totais.maoObraComDesconto}</h5>
                                                        <small className="text-muted">Mão de Obra c/ Desc.</small>
                                                    </div>
                                                    <div className="col-md-3">
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
                                        <span className="badge bg-light text-success">Orçamento Aceite</span>
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
                                                    {/* Tipo de Peça */}
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

                                                    {/* Descrição/Marca */}
                                                    <div className="col-md-2">
                                                        <label className="form-label">Ref.Interna</label>
                                                        <input
                                                            type="text"
                                                            className="form-control"
                                                            name="marca"
                                                            value={novaPeca.marca}
                                                            onChange={handleNovaPecaChange}
                                                            placeholder="Ex: Bosch, Mann..."
                                                        />
                                                    </div>

                                                    {/* Quantidade */}
                                                    <div className="col-md-1">
                                                        <label className="form-label">Qtd</label>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            name="quantidade"
                                                            value={novaPeca.quantidade}
                                                            onChange={handleNovaPecaChange}
                                                            min="1"
                                                        />
                                                    </div>

                                                    {/* Preço Unitário */}
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

                                                    {/* Tipo de Desconto */}
                                                    <div className="col-md-2">
                                                        <label className="form-label">Tipo Desconto</label>
                                                        <select
                                                            className="form-select"
                                                            name="tipo_desconto"
                                                            value={novaPeca.tipo_desconto || 'nenhum'}
                                                            onChange={handleNovaPecaChange}
                                                        >
                                                            <option value="nenhum">Sem desconto</option>
                                                            <option value="percentual">Percentual (%)</option>
                                                        </select>
                                                    </div>

                                                    {/* Valor do Desconto */}
                                                    <div className="col-md-2">
                                                        <label className="form-label">
                                                            {novaPeca.tipo_desconto === 'percentual' ? 'Desconto (%)' : 'Desconto (€)'}
                                                        </label>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            name={novaPeca.tipo_desconto === 'percentual' ? 'desconto_percentual' : 'desconto_unitario'}
                                                            value={
                                                                novaPeca.tipo_desconto === 'percentual'
                                                                    ? (novaPeca.desconto_percentual || '')
                                                                    : (novaPeca.desconto_unitario || '')
                                                            }
                                                            onChange={handleNovaPecaChange}
                                                            min="0"
                                                            step={novaPeca.tipo_desconto === 'percentual' ? '1' : '0.01'}
                                                            max={novaPeca.tipo_desconto === 'percentual' ? '100' : ''}
                                                            disabled={novaPeca.tipo_desconto === 'nenhum'}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Segunda Linha - Observações e Botão */}
                                                <div className="row g-3 mt-2">
                                                    {/* Observações */}
                                                    <div className="col-md-10">
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

                                                    {/* Botão Melhorado */}
                                                    <div className="col-md-2 d-flex align-items-end">
                                                        <div className="w-100">
                                                            <label className="form-label invisible">Ação</label>
                                                            {pecaEditavel ? (
                                                                <div className="btn-group w-100">
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-success w-50"
                                                                        onClick={atualizarPeca}
                                                                        disabled={!novaPeca.tipopeca.trim() || !novaPeca.marca.trim() || loading}
                                                                        title="Salvar edição"
                                                                    >
                                                                        <i className="bi bi-check-lg"></i>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-danger w-50"
                                                                        onClick={cancelarEdicao}
                                                                        title="Cancelar edição"
                                                                    >
                                                                        <i className="bi bi-x-lg"></i>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-primary w-100 btn-adicionar-peca"
                                                                    onClick={adicionarPeca}
                                                                    disabled={!novaPeca.tipopeca.trim() || !novaPeca.marca.trim() || loading}
                                                                    title="Adicionar peça à lista"
                                                                >
                                                                    {loading ? (
                                                                        <>
                                                                            <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                                            <span className="d-none d-md-inline">Adicionando...</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <i className="bi bi-plus-lg me-1"></i>
                                                                            <span className="d-none d-md-inline">Adicionar</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* Pré-visualização do Cálculo */}
                                                {novaPeca.preco_unitario > 0 && (
                                                    <div className="alert alert-info mt-3 mb-0">
                                                        <div className="d-flex justify-content-between">
                                                            <span>Subtotal: €{(novaPeca.preco_unitario * novaPeca.quantidade).toFixed(2)}</span>
                                                            {novaPeca.tipo_desconto !== 'nenhum' && (
                                                                <span>
                                                                    Desconto:
                                                                    {novaPeca.tipo_desconto === 'percentual' && ` ${novaPeca.desconto_percentual || 0}%`}
                                                                </span>
                                                            )}
                                                            <strong>
                                                                Total: €{calcularTotalPeca(novaPeca).toFixed(2)}
                                                            </strong>
                                                        </div>
                                                    </div>
                                                )}
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
                                                                    <th>Desconto</th>
                                                                    <th>Preço c/ Desc.</th>
                                                                    <th>Total</th>
                                                                    <th>Status</th>
                                                                    <th>Ações</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {pecasNecessarias
                                                                    .sort((a, b) => a.id - b.id) // Mantém a ordem de inserção (IDs mais antigos primeiro)
                                                                    .map((peca) => {
                                                                        const precoComDesconto = peca.preco_com_desconto || peca.preco_unitario;
                                                                        const totalItem = precoComDesconto * peca.quantidade;

                                                                        return (
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
                                                                                    <button
                                                                                        className="btn btn-sm btn-outline-primary"
                                                                                        onClick={() => abrirModalDesconto(peca.id)}
                                                                                    >
                                                                                        {peca.tipo_desconto === 'valor' && peca.desconto_unitario > 0 ? (
                                                                                            <>-€{peca.desconto_unitario.toFixed(2)}</>
                                                                                        ) : peca.tipo_desconto === 'percentual' && peca.desconto_percentual > 0 ? (
                                                                                            <>-{peca.desconto_percentual}%</>
                                                                                        ) : (
                                                                                            <i className="bi bi-percent"></i>
                                                                                        )}
                                                                                    </button>
                                                                                </td>
                                                                                <td>
                                                                                    <span className="fw-bold">
                                                                                        €{precoComDesconto.toFixed(2)}
                                                                                    </span>
                                                                                    {peca.preco_com_desconto < peca.preco_unitario && (
                                                                                        <div>
                                                                                            <small className="text-success">
                                                                                                (Economia: €{(peca.preco_unitario - precoComDesconto).toFixed(2)})
                                                                                            </small>
                                                                                        </div>
                                                                                    )}
                                                                                </td>
                                                                                <td>
                                                                                    <strong>€{totalItem.toFixed(2)}</strong>
                                                                                </td>
                                                                                <td>
                                                                                    {peca.existeNoSistema ? (
                                                                                        <div>
                                                                                            <span className="badge bg-success">
                                                                                                <i className="bi bi-check-circle me-1"></i>
                                                                                                Existe no Sistema
                                                                                            </span>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <span className="badge bg-warning">
                                                                                            <i className="bi bi-exclamation-circle me-1"></i>
                                                                                            Não Encontrada
                                                                                        </span>
                                                                                    )}
                                                                                </td>
                                                                                <td>
                                                                                    <div className="btn-group">
                                                                                        <button
                                                                                            type="button"
                                                                                            className="btn btn-outline-primary btn-sm"
                                                                                            onClick={() => iniciarEdicaoPeca(peca)}
                                                                                            title="Editar peça"
                                                                                        >
                                                                                            <i className="bi bi-pencil"></i>
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            className="btn btn-outline-danger btn-sm"
                                                                                            onClick={() => removerPeca(peca.id)}
                                                                                            title="Remover peça"
                                                                                        >
                                                                                            <i className="bi bi-trash"></i>
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Modal para Editar Desconto */}
                                        <ReactModal
                                            isOpen={showModalDesconto}
                                            onRequestClose={fecharModalDesconto}
                                            contentLabel="Editar Desconto"
                                            className="ReactModal__Content"
                                            overlayClassName="ReactModal__Overlay"
                                            closeTimeoutMS={200}
                                        >
                                            <div className="modal-header">
                                                <h3>Aplicar Desconto</h3>
                                                <button onClick={fecharModalDesconto}>&times;</button>
                                            </div>

                                            <div className="modal-body">
                                                <div className="mb-3">
                                                    <label className="form-label">Tipo de Desconto</label>
                                                    <select
                                                        className="form-select"
                                                        value={descontoAtual.tipo}
                                                        onChange={(e) => setDescontoAtual({ ...descontoAtual, tipo: e.target.value })}
                                                    >
                                                        <option value="nenhum">Sem desconto</option>
                                                        <option value="percentual">Percentual (%)</option>
                                                    </select>
                                                </div>

                                                {descontoAtual.tipo === 'percentual' && (
                                                    <div className="mb-3">
                                                        <label className="form-label">Percentual de Desconto (%)</label>
                                                        <input
                                                            type="number"
                                                            className="form-control"
                                                            step="1"
                                                            min="0"
                                                            max="100"
                                                            value={descontoAtual.percentual || ''}
                                                            onChange={(e) => setDescontoAtual({ ...descontoAtual, percentual: parseInt(e.target.value) || 0 })}
                                                        />
                                                    </div>
                                                )}

                                                <div className="alert alert-info mt-3">
                                                    <strong>Pré-visualização:</strong>
                                                    <div>Preço Original: €{pecaSelecionada?.preco_unitario?.toFixed(2) || '0.00'}</div>
                                                    <div>Preço com Desconto: €{calcularPrecoComDesconto().toFixed(2)}</div>
                                                    {calcularPrecoComDesconto() < (pecaSelecionada?.preco_unitario || 0) && (
                                                        <div className="text-success">
                                                            Economia: €{((pecaSelecionada?.preco_unitario || 0) - calcularPrecoComDesconto()).toFixed(2)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="modal-footer">
                                                <button className="btn btn-secondary" onClick={fecharModalDesconto}>
                                                    Cancelar
                                                </button>
                                                <button className="btn btn-primary" onClick={aplicarDesconto}>
                                                    Aplicar Desconto
                                                </button>
                                            </div>
                                        </ReactModal>
                                        {pecasNecessarias.length === 0 && (
                                            <div className="alert alert-info" role="alert">
                                                <i className="bi bi-info-circle me-2"></i>
                                                Nenhuma peça adicionada. Utilize o formulário acima para adicionar peças necessárias.
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

export default ReparacoesRegisto;