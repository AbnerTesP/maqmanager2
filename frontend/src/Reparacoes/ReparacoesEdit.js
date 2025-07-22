"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import axios from "axios"
import { useNavigate, useParams } from "react-router-dom"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

function ReparacoesEdit() {
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
    const [originalForm, setOriginalForm] = useState({})
    const [centros, setCentros] = useState([])
    const [orcamentos, setOrcamentos] = useState([])
    const [reparacoes, setReparacoes] = useState([])
    const [clientes, setClientes] = useState([])
    const [erro, setErro] = useState("")
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [loadingData, setLoadingData] = useState(true)
    const [validationErrors, setValidationErrors] = useState({})
    const navigate = useNavigate()
    const { id } = useParams()

    // Estados para peças com preços e descontos
    const [pecasNecessarias, setPecasNecessarias] = useState([])
    const [originalPecas, setOriginalPecas] = useState([])
    const [novaPeca, setNovaPeca] = useState({
        tipopeca: "",
        marca: "",
        quantidade: 1,
        preco_unitario: 0,
        desconto_unitario: 0,
        desconto_percentual: 0,
        tipo_desconto: "valor", // 'valor' ou 'percentual'
        observacao: "",
    })
    const [pecasExistentes, setPecasExistentes] = useState([])
    const [mostrarPecas, setMostrarPecas] = useState(false)
    const [loadingPecas, setLoadingPecas] = useState(false)

    // Estados financeiros
    const [valorMaoObra, setValorMaoObra] = useState(0)
    const [desconto, setDesconto] = useState(0)
    const [tipoDesconto, setTipoDesconto] = useState("percentual") // 'percentual' ou 'valor'

    // Cálculos automáticos usando useMemo para otimização
    const totalPecasSemDesconto = useMemo(() => {
        return pecasNecessarias.reduce((total, peca) => {
            const precoOriginal = (Number(peca.preco_unitario) || 0) * (Number(peca.quantidade) || 1)
            return total + precoOriginal
        }, 0)
    }, [pecasNecessarias])

    const totalDescontosPecas = useMemo(() => {
        return pecasNecessarias.reduce((total, peca) => {
            const precoUnitario = Number(peca.preco_unitario) || 0
            const quantidade = Number(peca.quantidade) || 1
            let descontoUnitario = 0

            if (peca.tipo_desconto === "percentual") {
                descontoUnitario = precoUnitario * ((Number(peca.desconto_percentual) || 0) / 100)
            } else {
                descontoUnitario = Number(peca.desconto_unitario) || 0
            }

            return total + descontoUnitario * quantidade
        }, 0)
    }, [pecasNecessarias])

    const totalPecas = useMemo(() => {
        return totalPecasSemDesconto - totalDescontosPecas
    }, [totalPecasSemDesconto, totalDescontosPecas])

    const valorDesconto = useMemo(() => {
        if (tipoDesconto === "percentual") {
            return (totalPecas + valorMaoObra) * (desconto / 100)
        }
        return Number(desconto) || 0
    }, [totalPecas, valorMaoObra, desconto, tipoDesconto])

    const totalGeral = useMemo(() => {
        return Math.max(0, totalPecas + valorMaoObra - valorDesconto)
    }, [totalPecas, valorMaoObra, valorDesconto])

    // Função para calcular preço com desconto de uma peça
    const calcularPrecoComDesconto = useCallback((peca) => {
        const precoUnitario = Number(peca.preco_unitario) || 0;
        const descontoPercentual = Number(peca.desconto_percentual) || 0;

        const descontoUnitario = precoUnitario * (descontoPercentual / 100);

        return Math.max(0, precoUnitario - descontoUnitario);
    }, []);


    // Função para carregar dados auxiliares
    const carregarDadosAuxiliares = useCallback(() => {
        setLoadingData(true)
        const promises = [
            axios.get("http://localhost:8082/centros"),
            axios.get("http://localhost:8082/orcamentos"),
            axios.get("http://localhost:8082/estadoReparacoes"),
            axios.get("http://localhost:8082/pecas"),
            axios.get("http://localhost:8082/clientes"),
        ]

        Promise.allSettled(promises)
            .then(([centrosResult, orcamentosResult, reparacoesResult, pecasResult, clientesResult]) => {
                setCentros(centrosResult.status === "fulfilled" ? centrosResult.value.data : [])
                setOrcamentos(orcamentosResult.status === "fulfilled" ? orcamentosResult.value.data : [])
                setReparacoes(reparacoesResult.status === "fulfilled" ? reparacoesResult.value.data : [])
                setPecasExistentes(pecasResult.status === "fulfilled" ? pecasResult.value.data : [])
                setClientes(clientesResult.status === "fulfilled" ? clientesResult.value.data : [])
            })
            .finally(() => setLoadingData(false))
    }, [])

    // Função para carregar dados da reparação
    const carregarReparacao = useCallback(() => {
        setLoading(true)
        setErro("")
        axios
            .get(`http://localhost:8082/reparacoes/${id}`)
            .then((response) => {
                const data = response.data
                const formattedData = {
                    ...data,
                    dataentrega: data.dataentrega ? data.dataentrega.split("T")[0] : "",
                    datasaida: data.datasaida ? data.datasaida.split("T")[0] : "",
                    dataconclusao: data.dataconclusao ? data.dataconclusao.split("T")[0] : "",
                    numreparacao: data.numreparacao || "",
                    descricao: data.descricao || "",
                    cliente_id: String(data.cliente_id || ""),
                }
                setForm(formattedData)
                setOriginalForm(formattedData)

                // Carregar valores financeiros
                setValorMaoObra(Number(data.mao_obra) || 0)
                setDesconto(Number(data.desconto) || 0)
                setTipoDesconto(data.tipo_desconto || "percentual")

                const orcamentoAceito =
                    formattedData.estadoorcamento?.toLowerCase().includes("em processo") ||
                    formattedData.estadoorcamento?.toLowerCase().includes("aceite")

                setMostrarPecas(orcamentoAceito)

                if (orcamentoAceito) {
                    carregarPecasReparacao(data.id)
                }
            })
            .catch((error) => {
                console.error("Erro ao buscar reparação:", error)
                setErro("Erro ao buscar reparação.")
            })
            .finally(() => setLoading(false))
    }, [id])

    // Função para carregar peças da reparação com informações de desconto
    const carregarPecasReparacao = useCallback((reparacaoId) => {
        setLoadingPecas(true)
        axios
            .get(`http://localhost:8082/reparacoes/${reparacaoId}/pecas`)
            .then((response) => {
                const pecas = response.data.map((peca) => ({
                    ...peca,
                    id: peca.id,
                    quantidade: Number(peca.quantidade) || 1,
                    preco_unitario: Number(peca.preco_unitario) || 0,
                    desconto_unitario: Number(peca.desconto_unitario) || 0,
                    desconto_percentual: Number(peca.desconto_percentual) || 0,
                    tipo_desconto: peca.tipo_desconto || "valor",
                    preco_com_desconto: Number(peca.preco_com_desconto) || Number(peca.preco_unitario) || 0,
                    preco_total: Number(peca.preco_total) || 0,
                    observacao: peca.observacoes || "",
                    existeNoSistema: peca.existe_no_sistema === 1,
                }))
                setPecasNecessarias(pecas)
                setOriginalPecas(JSON.parse(JSON.stringify(pecas)))
            })
            .catch((error) => {
                console.error("Erro ao carregar peças da reparação:", error)
                setErro("Erro ao carregar peças da reparação.")
                setPecasNecessarias([])
                setOriginalPecas([])
            })
            .finally(() => setLoadingPecas(false))
    }, [])

    useEffect(() => {
        carregarDadosAuxiliares()
        carregarReparacao()
    }, [carregarDadosAuxiliares, carregarReparacao])

    // Verificar se deve mostrar campo de peças quando o estado do orçamento muda
    useEffect(() => {
        const orcamentoAceito =
            form.estadoorcamento?.toLowerCase().includes("em processo") ||
            form.estadoorcamento?.toLowerCase().includes("aceite")
        setMostrarPecas(orcamentoAceito)
        if (!orcamentoAceito) {
            setPecasNecessarias([])
        }
    }, [form.estadoorcamento])

    const handleChange = useCallback(
        (e) => {
            const { name, value } = e.target
            setForm((prev) => ({ ...prev, [name]: value }))
            if (validationErrors[name]) {
                setValidationErrors((prev) => ({ ...prev, [name]: "" }))
            }
        },
        [validationErrors],
    )

    const handleClienteChange = useCallback((e) => {
        const clienteId = String(e.target.value)
        setForm((prev) => ({ ...prev, cliente_id: clienteId }))
    }, [])

    const handleCentroChange = useCallback(
        (e) => {
            const centroId = e.target.value
            const centroSelecionado = centros.find((c) => String(c.id) === String(centroId))
            setForm((prev) => ({
                ...prev,
                nomecentro: centroSelecionado ? centroSelecionado.nome : "",
                localcentro: centroSelecionado ? centroSelecionado.local : "",
            }))
        },
        [centros],
    )

    const handleOrcamentoChange = useCallback(
        (e) => {
            const orcamentoId = e.target.value
            const orcamentoSelecionado = orcamentos.find((o) => String(o.id) === String(orcamentoId))
            const novoEstadoOrcamento = orcamentoSelecionado ? orcamentoSelecionado.estado : ""
            let novoEstadoReparacao = form.estadoreparacao
            let novaDataConclusao = form.dataconclusao

            if (novoEstadoOrcamento?.toLowerCase().includes("recusado")) {
                const hoje = new Date().toISOString().split("T")[0]
                novaDataConclusao = hoje
                novoEstadoReparacao = "Sem reparação"
            } else {
                novoEstadoReparacao = "Em reparação"
                novaDataConclusao = ""
            }

            setForm((prev) => ({
                ...prev,
                estadoorcamento: novoEstadoOrcamento,
                estadoreparacao: novoEstadoReparacao,
                dataconclusao: novaDataConclusao,
            }))
        },
        [orcamentos, form.estadoreparacao, form.dataconclusao],
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

    // Funções para gerenciar peças com desconto
    const handleNovaPecaChange = useCallback((e) => {
        const { name, value } = e.target
        setNovaPeca((prev) => {
            const updated = {
                ...prev,
                [name]: ["quantidade", "preco_unitario", "desconto_unitario", "desconto_percentual"].includes(name)
                    ? Number.parseFloat(value) || 0
                    : value,
            }

            // Validações para desconto
            if (name === "desconto_percentual" && updated.desconto_percentual > 100) {
                updated.desconto_percentual = 100
            }
            if (name === "desconto_unitario" && updated.desconto_unitario > updated.preco_unitario) {
                updated.desconto_unitario = updated.preco_unitario
            }

            return updated
        })
    }, [])

    const verificarPecaExistente = useCallback(
        (tipopeca, marca) => {
            return pecasExistentes.find(
                (peca) =>
                    peca.tipopeca.toLowerCase().trim() === tipopeca.toLowerCase().trim() &&
                    peca.marca.toLowerCase().trim() === marca.toLowerCase().trim(),
            )
        },
        [pecasExistentes],
    )

    const adicionarPeca = useCallback(() => {
        if (!novaPeca.tipopeca.trim() || !novaPeca.marca.trim()) {
            setErro("Tipo de peça e marca são obrigatórios.")
            return
        }

        if (novaPeca.quantidade < 1) {
            setErro("Quantidade deve ser maior que zero.")
            return
        }

        if (novaPeca.preco_unitario < 0) {
            setErro("Preço unitário deve ser maior que zero.")
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

        // Calcular preço com desconto
        let descontoUnitario = 0
        if (novaPeca.tipo_desconto === "percentual") {
            descontoUnitario = novaPeca.preco_unitario * (novaPeca.desconto_percentual / 100)
        } else {
            descontoUnitario = novaPeca.desconto_unitario
        }

        const precoComDesconto = Math.max(0, novaPeca.preco_unitario - descontoUnitario)
        const preco_total = novaPeca.quantidade * precoComDesconto

        const novaPecaCompleta = {
            ...novaPeca,
            id: Date.now(),
            preco_com_desconto: precoComDesconto,
            preco_total,
            existeNoSistema: !!pecaExistente,
            pecaExistente: pecaExistente || null,
            isNew: true,
        }

        setPecasNecessarias((prev) => [...prev, novaPecaCompleta])
        setNovaPeca({
            tipopeca: "",
            marca: "",
            quantidade: 1,
            preco_unitario: 0,
            desconto_unitario: 0,
            desconto_percentual: 0,
            tipo_desconto: "valor",
            observacao: "",
        })
        setErro("")
    }, [novaPeca, pecasNecessarias, verificarPecaExistente])

    const removerPeca = useCallback((id) => {
        setPecasNecessarias((prev) => prev.filter((peca) => peca.id !== id))
    }, [])

    const atualizarPeca = useCallback((pecaId, campo, valor) => {
        setPecasNecessarias((prev) =>
            prev.map((peca) => {
                if (peca.id === pecaId) {
                    const novaPeca = { ...peca, [campo]: valor }

                    // Validações
                    if (campo === "desconto_percentual" && novaPeca.desconto_percentual > 100) {
                        novaPeca.desconto_percentual = 100
                    }
                    if (campo === "desconto_unitario" && novaPeca.desconto_unitario > novaPeca.preco_unitario) {
                        novaPeca.desconto_unitario = novaPeca.preco_unitario
                    }

                    // Recalcular preços
                    let descontoUnitario = 0
                    if (novaPeca.tipo_desconto === "percentual") {
                        descontoUnitario = novaPeca.preco_unitario * (novaPeca.desconto_percentual / 100)
                    } else {
                        descontoUnitario = novaPeca.desconto_unitario
                    }

                    novaPeca.preco_com_desconto = Math.max(0, novaPeca.preco_unitario - descontoUnitario)
                    novaPeca.preco_total = novaPeca.quantidade * novaPeca.preco_com_desconto

                    return novaPeca
                }
                return peca
            }),
        )
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

    const validateForm = useCallback(() => {
        const errors = {}
        if (!form.dataentrega) {
            errors.dataentrega = "Data de entrada é obrigatória"
        }
        if (!form.nomemaquina.trim()) {
            errors.nomemaquina = "Nome da máquina é obrigatório"
        }
        if (!form.estadoreparacao) {
            errors.estadoreparacao = "Estado da reparação é obrigatório"
        }
        if (!form.nomecentro) {
            errors.nomecentro = "Centro de reparação é obrigatório"
        }
        if (!form.cliente_id) {
            errors.cliente_id = "Cliente é obrigatório"
        }

        // Validar datas
        if (form.dataconclusao && new Date(form.dataconclusao) < new Date(form.dataentrega)) {
            errors.dataconclusao = "Data de conclusão deve ser posterior à data de entrada"
        }
        if (form.datasaida && form.dataconclusao && new Date(form.datasaida) < new Date(form.dataconclusao)) {
            errors.datasaida = "Data de saída deve ser posterior à data de conclusão"
        }

        setValidationErrors(errors)
        return Object.keys(errors).length === 0
    }, [form])

    const hasChanges = useCallback(() => {
        const formChanged = JSON.stringify(form) !== JSON.stringify(originalForm)
        const pecasChanged = JSON.stringify(pecasNecessarias) !== JSON.stringify(originalPecas)
        const valoresChanged =
            valorMaoObra !== (Number(originalForm.mao_obra) || 0) ||
            desconto !== (Number(originalForm.desconto) || 0) ||
            tipoDesconto !== (originalForm.tipo_desconto || "percentual")
        return formChanged || pecasChanged || valoresChanged
    }, [form, originalForm, pecasNecessarias, originalPecas, valorMaoObra, desconto, tipoDesconto])

    const getStatus = useCallback(() => {
        if (form.datasaida) return { text: "Entregue", class: "bg-success" }
        if (form.dataconclusao) return { text: "Pronta", class: "bg-info" }
        if (form.dataentrega) return { text: "Em Andamento", class: "bg-warning text-dark" }
        if (form.estadoreparacao === "Sem reparação") return { text: "Sem Reparação", class: "bg-danger" }
        return { text: "Pendente", class: "bg-secondary" }
    }, [form])

    const handleSubmit = useCallback(
        (e) => {
            e.preventDefault()
            setErro("")

            if (!validateForm()) {
                return
            }

            if (!hasChanges()) {
                alert("Nenhuma alteração foi feita.")
                return
            }

            setSaving(true)

            const formToSend = {
                ...form,
                mao_obra: valorMaoObra,
                desconto,
                tipo_desconto: tipoDesconto,
                total_pecas: totalPecas,
                total_geral: totalGeral,
            }

            // Primeiro, atualizar os dados da reparação
            axios
                .put(`http://localhost:8082/reparacoes/${id}`, formToSend)
                .then(() => {
                    // Se o orçamento foi aceito e há peças, atualizar as peças
                    if (mostrarPecas && pecasNecessarias.length > 0) {
                        const pecasParaEnvio = pecasNecessarias.map((peca) => ({
                            tipopeca: peca.tipopeca,
                            marca: peca.marca,
                            quantidade: peca.quantidade,
                            preco_unitario: peca.preco_unitario,
                            desconto_unitario: peca.desconto_unitario || 0,
                            desconto_percentual: peca.desconto_percentual || 0,
                            tipo_desconto: peca.tipo_desconto || "valor",
                            preco_total: peca.preco_total,
                            observacoes: peca.observacao || "",
                            existe_no_sistema: peca.existeNoSistema,
                        }))

                        return axios.put(`http://localhost:8082/reparacoes/${id}/pecas`, {
                            pecasNecessarias: pecasParaEnvio,
                        })
                    }
                    return Promise.resolve()
                })
                .then(() => {
                    alert("Reparação atualizada com sucesso!")
                    navigate("/reparacoes")
                })
                .catch((error) => {
                    console.error("Erro ao atualizar reparação:", error)
                    setErro("Erro ao atualizar reparação.")
                })
                .finally(() => setSaving(false))
        },
        [
            form,
            validateForm,
            hasChanges,
            valorMaoObra,
            desconto,
            tipoDesconto,
            totalPecas,
            totalGeral,
            mostrarPecas,
            pecasNecessarias,
            id,
            navigate,
        ],
    )

    const handleCancel = useCallback(() => {
        if (hasChanges()) {
            if (window.confirm("Tem certeza que deseja cancelar? Todas as alterações serão perdidas.")) {
                navigate("/reparacoes")
            }
        } else {
            navigate("/reparacoes")
        }
    }, [hasChanges, navigate])

    const handleReset = useCallback(() => {
        if (window.confirm("Tem certeza que deseja restaurar os valores originais?")) {
            setForm(originalForm)
            setPecasNecessarias(JSON.parse(JSON.stringify(originalPecas)))
            setValorMaoObra(Number(originalForm.mao_obra) || 0)
            setDesconto(Number(originalForm.desconto) || 0)
            setTipoDesconto(originalForm.tipo_desconto || "percentual")
            setValidationErrors({})
            setErro("")
        }
    }, [originalForm, originalPecas])

    // Memoized values
    const status = useMemo(() => getStatus(), [getStatus])
    const pecasSimilares = useMemo(
        () => buscarPecasSimilares(novaPeca.tipopeca),
        [buscarPecasSimilares, novaPeca.tipopeca],
    )
    const clienteSelecionado = useMemo(() => {
        const cliente = clientes.find((c) => String(c.id) === String(form.cliente_id))
        return cliente
    }, [clientes, form.cliente_id])

    // Calcular preview da nova peça
    const previewNovaPeca = useMemo(() => {
        if (!novaPeca.tipopeca || !novaPeca.marca || novaPeca.preco_unitario <= 0) return null

        let descontoUnitario = 0
        if (novaPeca.tipo_desconto === "percentual") {
            descontoUnitario = novaPeca.preco_unitario * (novaPeca.desconto_percentual / 100)
        } else {
            descontoUnitario = novaPeca.desconto_unitario
        }

        const precoComDesconto = Math.max(0, novaPeca.preco_unitario - descontoUnitario)
        const economia = novaPeca.preco_unitario - precoComDesconto
        const totalPeca = novaPeca.quantidade * precoComDesconto

        return {
            precoOriginal: novaPeca.preco_unitario,
            precoComDesconto,
            economia,
            totalPeca,
            temDesconto: economia > 0,
        }
    }, [novaPeca])

    if (loading || loadingData) {
        return (
            <div className="container mt-4">
                <div className="d-flex justify-content-center align-items-center" style={{ height: "400px" }}>
                    <div className="text-center">
                        <div className="spinner-border text-primary mb-3" role="status">
                            <span className="visually-hidden">Carregando...</span>
                        </div>
                        <p className="text-muted">Carregando dados da reparação...</p>
                    </div>
                </div>
            </div>
        )
    }

    if (erro && !form.nomemaquina) {
        return (
            <div className="container mt-4">
                <div className="alert alert-danger d-flex align-items-center" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    <div>
                        <h4 className="alert-heading">Erro!</h4>
                        <p className="mb-2">{erro}</p>
                        <button className="btn btn-outline-danger btn-sm" onClick={carregarReparacao}>
                            <i className="bi bi-arrow-clockwise me-1"></i>
                            Tentar Novamente
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="container mt-4">
            <div className="card shadow-sm">
                <div className="card-header bg-primary text-white">
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <h4 className="mb-0">
                                <i className="bi bi-tools me-2"></i>
                                Editar Reparação #{id}
                            </h4>
                            <small className="opacity-75">
                                Status atual: <span className={`badge ${status.class} ms-1`}>{status.text}</span>
                            </small>
                        </div>
                        <button className="btn btn-light btn-sm" onClick={() => navigate("/reparacoes")}>
                            <i className="bi bi-arrow-left me-1"></i>
                            Voltar
                        </button>
                    </div>
                </div>

                <div className="card-body">
                    {erro && (
                        <div className="alert alert-danger d-flex align-items-center mb-4" role="alert">
                            <i className="bi bi-exclamation-triangle-fill me-2"></i>
                            <div>{erro}</div>
                        </div>
                    )}

                    {hasChanges() && (
                        <div className="alert alert-info d-flex align-items-center mb-4" role="alert">
                            <i className="bi bi-info-circle-fill me-2"></i>
                            <div>Você tem alterações não salvas.</div>
                        </div>
                    )}

                    {form.estadoorcamento &&
                        (form.estadoorcamento.toLowerCase().includes("recusado") ||
                            form.estadoorcamento.toLowerCase().includes("rejeitado") ||
                            form.estadoorcamento.toLowerCase().includes("negado")) && (
                            <div className="alert alert-warning d-flex align-items-center mb-4" role="alert">
                                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                <div>
                                    <strong>Atenção:</strong> Orçamento recusado detectado. O status será automaticamente alterado para
                                    "Sem reparação" ao salvar.
                                </div>
                            </div>
                        )}

                    <form onSubmit={handleSubmit}>
                        <div className="row">
                            {/* Coluna da esquerda */}
                            <div className="col-md-6">
                                {/* Informações do Cliente */}
                                <div className="card mb-3">
                                    <div className="card-header bg-light">
                                        <h5 className="mb-0">
                                            <i className="bi bi-person-fill me-2"></i>
                                            Informações do Cliente
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-person-fill me-1"></i>
                                                Cliente <span className="text-danger">*</span>
                                            </label>
                                            <select
                                                className={`form-select ${validationErrors.cliente_id ? "is-invalid" : ""}`}
                                                value={form.cliente_id || ""}
                                                onChange={handleClienteChange}
                                                required
                                            >
                                                <option value="">Selecione um cliente</option>
                                                {clientes.map((cliente) => (
                                                    <option key={cliente.id} value={cliente.id}>
                                                        {cliente.nome} {cliente.numero_interno ? `(${cliente.numero_interno})` : ""}
                                                    </option>
                                                ))}
                                            </select>
                                            {validationErrors.cliente_id && (
                                                <div className="invalid-feedback">{validationErrors.cliente_id}</div>
                                            )}
                                        </div>

                                        {clienteSelecionado && (
                                            <div className="alert alert-info">
                                                <small>
                                                    <strong>Cliente selecionado:</strong> {clienteSelecionado.nome}
                                                    <br />
                                                    <strong>Contacto:</strong> {clienteSelecionado.telefone || "N/A"}
                                                    <br />
                                                    <strong>Nº Interno:</strong> {clienteSelecionado.numero_interno || "N/A"}
                                                </small>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Informações da Máquina */}
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
                                                type="text"
                                                className="form-control"
                                                name="numreparacao"
                                                value={form.numreparacao || ""}
                                                onChange={handleChange}
                                                placeholder="Ex: REP-2023-001"
                                            />
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-laptop me-1"></i>
                                                Nome da Máquina <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                className={`form-control ${validationErrors.nomemaquina ? "is-invalid" : ""}`}
                                                name="nomemaquina"
                                                value={form.nomemaquina || ""}
                                                onChange={handleChange}
                                                placeholder="Ex: Laptop Dell XPS 15"
                                            />
                                            {validationErrors.nomemaquina && (
                                                <div className="invalid-feedback">{validationErrors.nomemaquina}</div>
                                            )}
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-chat-left-text me-1"></i>
                                                Descrição da Reparação
                                            </label>
                                            <textarea
                                                className="form-control"
                                                name="descricao"
                                                value={form.descricao || ""}
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
                                                className={`form-select ${validationErrors.nomecentro ? "is-invalid" : ""}`}
                                                onChange={handleCentroChange}
                                                value={centros.find((c) => c.nome === form.nomecentro)?.id || ""}
                                            >
                                                <option value="">Selecione um centro</option>
                                                {centros.map((centro) => (
                                                    <option key={centro.id} value={centro.id}>
                                                        {centro.nome}
                                                    </option>
                                                ))}
                                            </select>
                                            {validationErrors.nomecentro && (
                                                <div className="invalid-feedback">{validationErrors.nomecentro}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Estados */}
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
                                                className={`form-select ${validationErrors.estadoreparacao ? "is-invalid" : ""}`}
                                                onChange={handleEstadoreparacaoChange}
                                                value={reparacoes.find((r) => r.estado === form.estadoreparacao)?.id || ""}
                                            >
                                                <option value="">Selecione o estado da Reparação</option>
                                                {reparacoes.map((rep) => (
                                                    <option key={rep.id} value={rep.id}>
                                                        {rep.estado}
                                                    </option>
                                                ))}
                                            </select>
                                            {validationErrors.estadoreparacao && (
                                                <div className="invalid-feedback">{validationErrors.estadoreparacao}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Coluna da direita */}
                            <div className="col-md-6">
                                {/* Cronologia */}
                                <div className="card mb-3">
                                    <div className="card-header bg-light">
                                        <h5 className="mb-0">Cronologia</h5>
                                    </div>
                                    <div className="card-body">
                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-calendar-plus me-1"></i>
                                                Data de Entrada <span className="text-danger">*</span>
                                            </label>
                                            <input
                                                type="date"
                                                className={`form-control ${validationErrors.dataentrega ? "is-invalid" : ""}`}
                                                name="dataentrega"
                                                value={form.dataentrega || ""}
                                                onChange={handleChange}
                                            />
                                            {validationErrors.dataentrega && (
                                                <div className="invalid-feedback">{validationErrors.dataentrega}</div>
                                            )}
                                            <div className="form-text">Data em que a máquina entrou na loja</div>
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-calendar-check me-1"></i>
                                                Data de Conclusão
                                            </label>
                                            <input
                                                type="date"
                                                className={`form-control ${validationErrors.dataconclusao ? "is-invalid" : ""}`}
                                                name="dataconclusao"
                                                value={form.dataconclusao || ""}
                                                onChange={handleChange}
                                            />
                                            {validationErrors.dataconclusao && (
                                                <div className="invalid-feedback">{validationErrors.dataconclusao}</div>
                                            )}
                                            <div className="form-text">Data em que a reparação foi concluída</div>
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-calendar-x me-1"></i>
                                                Data de Saída
                                            </label>
                                            <input
                                                type="date"
                                                className={`form-control ${validationErrors.datasaida ? "is-invalid" : ""}`}
                                                name="datasaida"
                                                value={form.datasaida || ""}
                                                onChange={handleChange}
                                            />
                                            {validationErrors.datasaida && (
                                                <div className="invalid-feedback">{validationErrors.datasaida}</div>
                                            )}
                                            <div className="form-text">Data em que a máquina saiu da loja</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Valores Financeiros */}
                                <div className="card mb-3">
                                    <div className="card-header bg-light">
                                        <h5 className="mb-0">
                                            <i className="bi bi-currency-euro me-2"></i>
                                            Valores Financeiros
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-person-workspace me-1"></i>
                                                Valor da Mão de Obra (€)
                                            </label>
                                            <input
                                                type="number"
                                                className="form-control"
                                                value={valorMaoObra === 0 && valorMaoObra !== "" ? "" : valorMaoObra}
                                                onChange={(e) => {
                                                    const val = e.target.value
                                                    setValorMaoObra(val === "" ? 0 : Number.parseFloat(val))
                                                }}
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                            />
                                        </div>

                                        <div className="mb-3">
                                            <label className="form-label">
                                                <i className="bi bi-percent me-1"></i>
                                                Desconto Geral
                                            </label>
                                            <div className="input-group">
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    value={desconto === 0 && desconto !== "" ? "" : desconto}
                                                    onChange={(e) => {
                                                        const val = e.target.value
                                                        setDesconto(val === "" ? 0 : Number.parseFloat(val))
                                                    }}
                                                    min="0"
                                                    step="0.01"
                                                    placeholder="0"
                                                />
                                                <select
                                                    className="form-select"
                                                    style={{ maxWidth: "120px" }}
                                                    value={tipoDesconto}
                                                    onChange={(e) => setTipoDesconto(e.target.value)}
                                                >
                                                    <option value="percentual">%</option>
                                                    <option value="valor">€</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Resumo Financeiro */}
                                        <div className="card bg-light">
                                            <div className="card-body">
                                                <h6 className="card-title">
                                                    <i className="bi bi-calculator me-2"></i>
                                                    Resumo Financeiro
                                                </h6>
                                                <div className="row text-center">
                                                    <div className="col-4">
                                                        <div className="border-end">
                                                            <div className="h5 mb-0 text-primary">{totalPecas.toFixed(2)}€</div>
                                                            <small className="text-muted">Peças</small>
                                                        </div>
                                                    </div>
                                                    <div className="col-4">
                                                        <div className="border-end">
                                                            <div className="h5 mb-0 text-info">{valorMaoObra.toFixed(2)}€</div>
                                                            <small className="text-muted">Mão de Obra</small>
                                                        </div>
                                                    </div>
                                                    <div className="col-4">
                                                        <div className="h5 mb-0 text-success">{totalGeral.toFixed(2)}€</div>
                                                        <small className="text-muted">Total</small>
                                                    </div>
                                                </div>
                                                {(valorDesconto > 0 || totalDescontosPecas > 0) && (
                                                    <div className="mt-2 text-center">
                                                        {totalDescontosPecas > 0 && (
                                                            <small className="text-warning d-block">
                                                                <i className="bi bi-tag me-1"></i>
                                                                Descontos em peças: {totalDescontosPecas.toFixed(2)}€
                                                            </small>
                                                        )}
                                                        {valorDesconto > 0 && (
                                                            <small className="text-warning d-block">
                                                                <i className="bi bi-dash-circle me-1"></i>
                                                                Desconto geral: {valorDesconto.toFixed(2)}€
                                                            </small>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
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
                                        {loadingPecas ? (
                                            <div className="text-center py-4">
                                                <div className="spinner-border text-primary" role="status">
                                                    <span className="visually-hidden">Carregando...</span>
                                                </div>
                                                <p className="mt-2">Carregando peças...</p>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Adicionar Nova Peça com Desconto */}
                                                <div className="card mb-4">
                                                    <div className="card-header bg-primary text-white">
                                                        <h6 className="mb-0">
                                                            <i className="bi bi-plus-circle me-2"></i>
                                                            Adicionar Peça
                                                        </h6>
                                                    </div>
                                                    <div className="card-body">
                                                        <div className="row g-3">
                                                            <div className="col-md-6">
                                                                <label className="form-label">Designação *</label>
                                                                <input
                                                                    type="text"
                                                                    className="form-control"
                                                                    name="tipopeca"
                                                                    value={novaPeca.tipopeca}
                                                                    onChange={handleNovaPecaChange}
                                                                    placeholder="Ex: Filtro, Correia..."
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
                                                            <div className="col-md-2">
                                                                <label className="form-label">Ref. Interna *</label>
                                                                <input
                                                                    type="text"
                                                                    className="form-control"
                                                                    name="marca"
                                                                    value={novaPeca.marca}
                                                                    onChange={handleNovaPecaChange}
                                                                    placeholder="Ex: Bosch, Mann..."
                                                                />
                                                            </div>
                                                            <div className="col-md-1">
                                                                <label className="form-label">Qtd*</label>
                                                                <input
                                                                    type="number"
                                                                    className="form-control"
                                                                    name="quantidade"
                                                                    value={novaPeca.quantidade}
                                                                    onChange={handleNovaPecaChange}
                                                                    min="1"
                                                                />
                                                            </div>
                                                            <div className="col-md-1">
                                                                <label className="form-label">Preço(€) *</label>
                                                                <input
                                                                    type="text"
                                                                    className="form-control"
                                                                    name="preco_unitario"
                                                                    value={novaPeca.preco_unitario}
                                                                    onChange={(e) => {
                                                                        let value = e.target.value.replace(',', '.');

                                                                        // Remove caracteres não numéricos, exceto o ponto
                                                                        value = value.replace(/[^0-9.]/g, '');

                                                                        // Garante apenas um ponto decimal
                                                                        const parts = value.split('.');
                                                                        if (parts.length > 2) {
                                                                            value = parts[0] + '.' + parts.slice(1).join('');
                                                                        }

                                                                        // Atualiza o estado corretamente
                                                                        setNovaPeca(prev => ({
                                                                            ...prev,
                                                                            preco_unitario: value
                                                                        }));
                                                                    }}
                                                                    placeholder="0.00"
                                                                />
                                                            </div>

                                                            <div className="col-md-2">
                                                                <label className="form-label">&nbsp;</label>
                                                                <div
                                                                    className="position-relative"
                                                                    title={
                                                                        !novaPeca.tipopeca
                                                                            ? "Preencha a designação"
                                                                            : !novaPeca.marca
                                                                                ? "Preencha a marca"
                                                                                : novaPeca.quantidade < 1
                                                                                    ? "Quantidade deve ser maior que 0"
                                                                                    : novaPeca.preco_unitario < 0
                                                                                        ? "Preço deve ser maior que 0"
                                                                                        : "Clique para adicionar a peça"
                                                                    }
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        className={`btn w-50 d-flex align-items-center justify-content-center ${!novaPeca.tipopeca ||
                                                                            !novaPeca.marca ||
                                                                            novaPeca.quantidade < 1 ||
                                                                            novaPeca.preco_unitario < 0
                                                                            ? "btn-outline-secondary"
                                                                            : "btn-success"
                                                                            }`}
                                                                        onClick={adicionarPeca}
                                                                        disabled={
                                                                            !novaPeca.tipopeca ||
                                                                            !novaPeca.marca ||
                                                                            novaPeca.quantidade < 1 ||
                                                                            novaPeca.preco_unitario < 0
                                                                        }
                                                                        style={{
                                                                            transition: "all 0.3s ease",
                                                                            transform:
                                                                                !novaPeca.tipopeca ||
                                                                                    !novaPeca.marca ||
                                                                                    novaPeca.quantidade < 1 ||
                                                                                    novaPeca.preco_unitario < 0
                                                                                    ? "scale(0.95)"
                                                                                    : "scale(1)",
                                                                        }}
                                                                    >
                                                                        <i></i>
                                                                        Adicionar
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Campos de Desconto */}
                                                        <div className="row g-3 mt-2">
                                                            <div className="col-md-2">
                                                                <label className="form-label">Tipo de Desconto</label>
                                                                <select
                                                                    className="form-select"
                                                                    name="tipo_desconto"
                                                                    value="percentual" // Valor fixo
                                                                    disabled // Seleção desativada
                                                                >
                                                                    <option value="percentual">Percentual(%)</option>
                                                                </select>
                                                            </div>

                                                            <div className="col-md-1">
                                                                <label className="form-label">Desc(%)</label>
                                                                <input
                                                                    type="text"
                                                                    className="form-control"
                                                                    name="desconto_percentual"
                                                                    value={novaPeca.desconto_percentual}
                                                                    onChange={(e) => {
                                                                        let value = e.target.value.replace(',', '.');

                                                                        // Remove tudo exceto números e ponto
                                                                        value = value.replace(/[^0-9.]/g, '');

                                                                        // Garante apenas um ponto decimal
                                                                        const parts = value.split('.');
                                                                        if (parts.length > 2) {
                                                                            value = parts[0] + '.' + parts.slice(1).join('');
                                                                        }

                                                                        // Limita a 100%
                                                                        const floatValue = parseFloat(value);
                                                                        if (!isNaN(floatValue) && floatValue > 100) value = '100';

                                                                        handleNovaPecaChange({
                                                                            ...e,
                                                                            target: {
                                                                                ...e.target,
                                                                                name: "desconto_percentual",
                                                                                value
                                                                            }
                                                                        });
                                                                    }}
                                                                    placeholder="0"
                                                                    inputMode="decimal"
                                                                    style={{
                                                                        WebkitAppearance: 'none',
                                                                        MozAppearance: 'textfield',
                                                                        margin: 0
                                                                    }}
                                                                    onWheel={(e) => e.currentTarget.blur()} // previne alteração via scroll
                                                                    lang="pt-PT"
                                                                />
                                                            </div>

                                                            <div className="col-md-6">
                                                                <label className="form-label">Observações</label>
                                                                <input
                                                                    type="text"
                                                                    className="form-control"
                                                                    name="observacao"
                                                                    value={novaPeca.observacao}
                                                                    onChange={handleNovaPecaChange}
                                                                    placeholder="Observações adicionais sobre a peça..."
                                                                />
                                                            </div>
                                                        </div>

                                                        {/* Preview da Nova Peça */}
                                                        {previewNovaPeca && (
                                                            <div className="mt-3">
                                                                <div className="alert alert-info">
                                                                    <h6 className="alert-heading">
                                                                        <i className="bi bi-eye me-2"></i>
                                                                        Preview da Peça
                                                                    </h6>
                                                                    <div className="row">
                                                                        <div className="col-md-3">
                                                                            <strong>Preço Original:</strong>
                                                                            <br />
                                                                            <span className="text-muted">€{previewNovaPeca.precoOriginal.toFixed(2)}</span>
                                                                        </div>
                                                                        {previewNovaPeca.temDesconto && (
                                                                            <div className="col-md-3">
                                                                                <strong>Economia:</strong>
                                                                                <br />
                                                                                <span className="text-success">-€{previewNovaPeca.economia.toFixed(2)}</span>
                                                                            </div>
                                                                        )}
                                                                        <div className="col-md-3">
                                                                            <strong>Preço Final:</strong>
                                                                            <br />
                                                                            <span className="text-primary">
                                                                                €{previewNovaPeca.precoComDesconto.toFixed(2)}
                                                                            </span>
                                                                        </div>
                                                                        <div className="col-md-3">
                                                                            <strong>Total:</strong>
                                                                            <br />
                                                                            <span className="text-success fw-bold">
                                                                                €{previewNovaPeca.totalPeca.toFixed(2)}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Lista de Peças Adicionadas */}
                                                {pecasNecessarias.length > 0 ? (
                                                    <div className="card">
                                                        <div className="card-header bg-light">
                                                            <h6 className="mb-0">
                                                                <i className="bi bi-list-check me-2"></i>
                                                                Peças da Reparação ({pecasNecessarias.length})
                                                            </h6>
                                                        </div>
                                                        <div className="card-body">
                                                            <div className="table-responsive">
                                                                <table className="table table-hover">
                                                                    <thead>
                                                                        <tr>
                                                                            <th style={{ width: "25%" }}>Tipo de Peça</th>
                                                                            <th style={{ width: "10%" }}>Ref. Interna</th>
                                                                            <th className="text-start">Qtd</th>
                                                                            <th className="text-start">Preço Unit. (€)</th>
                                                                            <th className="text-start">Desconto</th>
                                                                            <th className="text-start">Preço Final (€)</th>
                                                                            <th className="text-start">Total (€)</th>
                                                                            <th className="text-start">Ações</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {pecasNecessarias.map((peca) => {
                                                                            const precoComDesconto = calcularPrecoComDesconto(peca)
                                                                            const economia = peca.preco_unitario - precoComDesconto

                                                                            return (
                                                                                <tr key={peca.id}>
                                                                                    {/* Tipo de Peça */}
                                                                                    <td>
                                                                                        <div className="d-flex align-items-center">
                                                                                            <input
                                                                                                type="text"
                                                                                                className="form-control form-control-sm"
                                                                                                value={peca.tipopeca}
                                                                                                onChange={(e) => atualizarPeca(peca.id, "tipopeca", e.target.value)}
                                                                                            />
                                                                                            {peca.isNew && <span className="badge bg-primary ms-1">Nova</span>}
                                                                                        </div>
                                                                                    </td>
                                                                                    <td>
                                                                                        <input
                                                                                            type="text"
                                                                                            className="form-control form-control-sm"
                                                                                            value={peca.marca}
                                                                                            onChange={(e) => atualizarPeca(peca.id, "marca", e.target.value)}
                                                                                        />
                                                                                    </td>
                                                                                    <td>
                                                                                        <input
                                                                                            type="number"
                                                                                            className="form-control form-control-sm absolute-center"
                                                                                            value={peca.quantidade}
                                                                                            onChange={(e) =>
                                                                                                atualizarPeca(
                                                                                                    peca.id,
                                                                                                    "quantidade",
                                                                                                    Number.parseFloat(e.target.value) || 1,
                                                                                                )
                                                                                            }
                                                                                            min="1"
                                                                                            style={{ width: "40px" }}
                                                                                        />
                                                                                    </td>
                                                                                    <td className="content-center">
                                                                                        <input
                                                                                            type="number"
                                                                                            className="form-control form-control-sm "
                                                                                            value={peca.preco_unitario}
                                                                                            onChange={(e) =>
                                                                                                atualizarPeca(
                                                                                                    peca.id,
                                                                                                    "preco_unitario",
                                                                                                    Number.parseFloat(e.target.value) || 0,
                                                                                                )
                                                                                            }
                                                                                            min="0"
                                                                                            step="0.01"
                                                                                            style={{ width: "80px" }}
                                                                                        />
                                                                                    </td>
                                                                                    <td>
                                                                                        <div className="d-flex align-items-right gap-1">
                                                                                            <input
                                                                                                type="number"
                                                                                                className="form-control form-control-sm "
                                                                                                value={peca.desconto_percentual === 0 ? "" : peca.desconto_percentual}
                                                                                                onChange={(e) => {
                                                                                                    const raw = e.target.value.replace(',', '.');
                                                                                                    const parsed = parseFloat(raw);
                                                                                                    atualizarPeca(peca.id, "desconto_percentual", isNaN(parsed) ? 0 : parsed);
                                                                                                }}
                                                                                                min="0"
                                                                                                max="100"
                                                                                                step="0.01"
                                                                                                style={{ width: "70px" }}
                                                                                                onWheel={(e) => e.currentTarget.blur()}
                                                                                                placeholder="0"
                                                                                                lang="pt-PT"
                                                                                            />
                                                                                        </div>

                                                                                        {economia > 0 && (
                                                                                            <small className="text-success">
                                                                                                <i className="bi bi-tag-fill me-1"></i>
                                                                                                {`${peca.desconto_percentual}%`}
                                                                                            </small>
                                                                                        )}
                                                                                    </td>

                                                                                    <td>
                                                                                        <strong className={economia > 0 ? "text-success" : "text-primary"}>
                                                                                            {precoComDesconto.toFixed(2)}€
                                                                                        </strong>
                                                                                        {economia > 0 && (
                                                                                            <div>
                                                                                                <small className="text-muted text-decoration-line-through">
                                                                                                    {peca.preco_unitario.toFixed(2)}€
                                                                                                </small>
                                                                                            </div>
                                                                                        )}
                                                                                    </td>
                                                                                    <td>
                                                                                        <strong className="text-success text-end">
                                                                                            {peca.preco_total?.toFixed(2) || "0.00"}€
                                                                                        </strong>
                                                                                        {economia > 0 && (
                                                                                            <div>
                                                                                                <small className="text-success">
                                                                                                    <i className="bi bi-arrow-down me-1"></i>-
                                                                                                    {(economia * peca.quantidade).toFixed(2)}€
                                                                                                </small>
                                                                                            </div>
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
                                                                            )
                                                                        })}
                                                                    </tbody>
                                                                    <tfoot>
                                                                        <tr className="table-success">
                                                                            <td colSpan="6" className="text-end fw-bold">
                                                                                Total das Peças:
                                                                            </td>
                                                                            <td className="fw-bold text-success">{totalPecas.toFixed(2)}€</td>
                                                                            <td colSpan="2">
                                                                                {totalDescontosPecas > 0 && (
                                                                                    <small className="text-success">
                                                                                        <i className="bi bi-piggy-bank me-1"></i>
                                                                                        Economia: {totalDescontosPecas.toFixed(2)}€
                                                                                    </small>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    </tfoot>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="alert alert-warning">
                                                        <i className="bi bi-exclamation-triangle me-2"></i>
                                                        Nenhuma peça adicionada. Adicione as peças necessárias para a reparação.
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="d-flex justify-content-between flex-wrap gap-2 mt-4">
                            <div className="d-flex gap-2">
                                <button type="button" className="btn btn-outline-secondary" onClick={handleCancel}>
                                    <i className="bi bi-x-circle me-1"></i>
                                    Cancelar
                                </button>

                                <button
                                    type="button"
                                    className="btn btn-outline-warning"
                                    onClick={handleReset}
                                    disabled={!hasChanges()}
                                >
                                    <i className="bi bi-arrow-counterclockwise me-1"></i>
                                    Restaurar
                                </button>
                            </div>

                            <button type="submit" className="btn btn-success btn-lg" disabled={saving || !hasChanges()}>
                                {saving ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-check-circle me-1"></i>
                                        Salvar Alterações
                                        {totalGeral > 0 && (
                                            <span className="badge bg-light text-success ms-2">{totalGeral.toFixed(2)}€</span>
                                        )}
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <style jsx>{`
                .card {
                    border: none;
                    border-radius: 10px;
                    margin-bottom: 20px;
                }
                
                .card-header {
                    border-radius: 10px 10px 0 0 !important;
                    border: none;
                }
                
                .form-control:focus, .form-select:focus {
                    border-color: #0d6efd;
                    box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25);
                }
                
                .btn-success {
                    background-color: #198754;
                    border-color: #198754;
                    transition: all 0.3s ease;
                }
                
                .btn-success:hover:not(:disabled) {
                    background-color: #157347;
                    border-color: #146c43;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
                
                .btn-success:disabled {
                    opacity: 0.6;
                    transform: none;
                }
                
                .btn-outline-warning:hover {
                    background-color: #ffc107;
                    color: #000;
                }
                
                .btn-outline-secondary:hover {
                    background-color: #6c757d;
                    color: white;
                }
                
                .invalid-feedback {
                    display: block;
                }
                
                .badge {
                    font-size: 0.75em;
                    padding: 0.5em 0.75em;
                    border-radius: 20px;
                }
                
                .table th {
                    background-color: #f8f9fa;
                    border-top: none;
                    font-weight: 600;
                    font-size: 0.9em;
                }
                
                .table td {
                    vertical-align: middle;
                }

                .input-xs { width: 20px; }
                .input-sm { width: 90px; }
                .input-md { width: 120px; }
                .input-lg { width: 150px; }
                
                .form-control-sm {
                    font-size: 0.90rem;
                }
                
                .text-decoration-line-through {
                    text-decoration: line-through !important;
                }
                
                @media (max-width: 768px) {
                    .card-header h4 {
                        font-size: 1.1rem;
                    }
                    
                    .d-flex.justify-content-between {
                        flex-direction: column;
                    }
                    
                    .d-flex.gap-2 {
                        justify-content: center;
                        margin-bottom: 10px;
                    }
                    
                    .btn {
                        padding: 0.375rem 0.75rem;
                        font-size: 0.9rem;
                    }
                    
                    .table-responsive {
                        font-size: 0.8rem;
                    }
                    
                    .form-control-sm {
                        font-size: 0.75rem;
                    }
                }
                
                .position-relative [title]:hover::after {
                    content: attr(title);
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0,0,0,0.8);
                    color: white;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    white-space: nowrap;
                    z-index: 1000;
                }
            `}</style>
        </div>
    )
}

export default ReparacoesEdit
