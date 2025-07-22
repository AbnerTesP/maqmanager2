"use client"

import { useState, useEffect } from "react"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

function PecasEditor({ reparacaoId, onSave, onCancel, initialPecas = [] }) {
    const [pecas, setPecas] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [novaPeca, setNovaPeca] = useState({
        tipopeca: "",
        marca: "",
        quantidade: 1,
        preco_unitario: 0,
        desconto_unitario: 0,
        desconto_percentual: 0,
        tipo_desconto: "valor",
        existe_no_sistema: false,
        observacoes: "",
    })

    useEffect(() => {
        if (initialPecas.length > 0) {
            setPecas(initialPecas)
        }
    }, [initialPecas])

    const adicionarPeca = () => {
        if (!novaPeca.tipopeca || !novaPeca.marca || novaPeca.quantidade < 1 || novaPeca.preco_unitario <= 0) {
            return
        }

        const peca = {
            id: Date.now(),
            ...novaPeca,
            quantidade: Number(novaPeca.quantidade) || 1,
            preco_unitario: Number(novaPeca.preco_unitario) || 0,
            desconto_unitario: Number(novaPeca.desconto_unitario) || 0,
            desconto_percentual: Number(novaPeca.desconto_percentual) || 0,
        }

        setPecas([...pecas, peca])

        // Reset do formulário
        setNovaPeca({
            tipopeca: "",
            marca: "",
            quantidade: 1,
            preco_unitario: 0,
            desconto_unitario: 0,
            desconto_percentual: 0,
            tipo_desconto: "valor",
            existe_no_sistema: false,
            observacoes: "",
        })
    }

    const removerPeca = (id) => {
        setPecas(pecas.filter((peca) => peca.id !== id))
    }

    const atualizarPeca = (id, campo, valor) => {
        setPecas(
            pecas.map((peca) => {
                if (peca.id === id) {
                    const pecaAtualizada = { ...peca, [campo]: valor }

                    // Se mudou o tipo de desconto, resetar os valores
                    if (campo === "tipo_desconto") {
                        pecaAtualizada.desconto_unitario = 0
                        pecaAtualizada.desconto_percentual = 0
                    }

                    return pecaAtualizada
                }
                return peca
            }),
        )
    }

    const calcularPrecoComDesconto = (peca) => {
        const precoOriginal = Number(peca.preco_unitario) || 0

        if (peca.tipo_desconto === "percentual") {
            const desconto = Number(peca.desconto_percentual) || 0
            return precoOriginal - (precoOriginal * desconto) / 100
        } else {
            const desconto = Number(peca.desconto_unitario) || 0
            return Math.max(0, precoOriginal - desconto)
        }
    }

    const calcularTotal = (peca) => {
        const precoComDesconto = calcularPrecoComDesconto(peca)
        return precoComDesconto * (peca.quantidade || 1)
    }

    const calcularTotalGeral = () => {
        return pecas.reduce((total, peca) => total + calcularTotal(peca), 0)
    }

    const calcularTotalDescontos = () => {
        return pecas.reduce((total, peca) => {
            const precoOriginal = Number(peca.preco_unitario) || 0
            const precoComDesconto = calcularPrecoComDesconto(peca)
            const descontoUnitario = precoOriginal - precoComDesconto
            return total + descontoUnitario * (peca.quantidade || 1)
        }, 0)
    }

    const validarPecas = () => {
        const erros = []

        pecas.forEach((peca, index) => {
            if (!peca.tipopeca.trim()) {
                erros.push(`Peça ${index + 1}: Tipo de peça é obrigatório`)
            }
            if (!peca.marca.trim()) {
                erros.push(`Peça ${index + 1}: Marca é obrigatória`)
            }
            if (peca.quantidade <= 0) {
                erros.push(`Peça ${index + 1}: Quantidade deve ser maior que zero`)
            }
            if (peca.preco_unitario < 0) {
                erros.push(`Peça ${index + 1}: Preço não pode ser negativo`)
            }
            if (peca.tipo_desconto === "percentual" && peca.desconto_percentual > 100) {
                erros.push(`Peça ${index + 1}: Desconto percentual não pode ser maior que 100%`)
            }
        })

        return erros
    }

    const handleSave = async () => {
        const erros = validarPecas()

        if (erros.length > 0) {
            setError(erros.join("\n"))
            return
        }

        setLoading(true)
        setError("")

        try {
            // Preparar dados para envio
            const pecasParaEnvio = pecas.map((peca) => ({
                tipopeca: peca.tipopeca.trim(),
                marca: peca.marca.trim(),
                quantidade: Number(peca.quantidade) || 1,
                preco_unitario: Number(peca.preco_unitario) || 0,
                desconto_unitario: Number(peca.desconto_unitario) || 0,
                desconto_percentual: Number(peca.desconto_percentual) || 0,
                tipo_desconto: peca.tipo_desconto || "valor",
                existe_no_sistema: Boolean(peca.existe_no_sistema),
                observacoes: peca.observacoes?.trim() || "",
            }))

            await onSave(pecasParaEnvio)
        } catch (error) {
            console.error("Erro ao salvar peças:", error)
            setError("Erro ao salvar peças: " + (error.message || "Erro desconhecido"))
        } finally {
            setLoading(false)
        }
    }

    // Verificar se o formulário de nova peça está válido
    const isFormularioValido = () => {
        return novaPeca.tipopeca.trim() && novaPeca.marca.trim() && novaPeca.quantidade >= 1 && novaPeca.preco_unitario > 0
    }

    // Obter mensagem de tooltip para botão desabilitado
    const getTooltipMessage = () => {
        if (!novaPeca.tipopeca.trim()) return "Digite o tipo de peça"
        if (!novaPeca.marca.trim()) return "Digite a marca"
        if (novaPeca.quantidade < 1) return "Quantidade deve ser maior que 0"
        if (novaPeca.preco_unitario <= 0) return "Digite um preço válido"
        return ""
    }

    return (
        <div className="modal fade show" style={{ display: "block" }} tabIndex="-1">
            <div className="modal-dialog modal-xl">
                <div className="modal-content">
                    <div className="modal-header bg-primary text-white">
                        <h5 className="modal-title">
                            <i className="bi bi-wrench-adjustable me-2"></i>
                            Editar Peças da Reparação #{reparacaoId}
                        </h5>
                        <button type="button" className="btn-close btn-close-white" onClick={onCancel}></button>
                    </div>

                    <div className="modal-body">
                        {error && (
                            <div className="alert alert-danger" role="alert">
                                <i className="bi bi-exclamation-triangle me-2"></i>
                                <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                                    {error}
                                </pre>
                            </div>
                        )}

                        {/* Resumo Financeiro */}
                        <div className="row mb-4">
                            <div className="col-md-4">
                                <div className="card bg-light">
                                    <div className="card-body text-center">
                                        <h6 className="text-muted">Total sem Desconto</h6>
                                        <h4 className="text-primary">€{(calcularTotalGeral() + calcularTotalDescontos()).toFixed(2)}</h4>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="card bg-warning bg-opacity-25">
                                    <div className="card-body text-center">
                                        <h6 className="text-muted">Total Descontos</h6>
                                        <h4 className="text-warning">€{calcularTotalDescontos().toFixed(2)}</h4>
                                    </div>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="card bg-success bg-opacity-25">
                                    <div className="card-body text-center">
                                        <h6 className="text-muted">Total Final</h6>
                                        <h4 className="text-success">€{calcularTotalGeral().toFixed(2)}</h4>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Formulário para Adicionar Nova Peça */}
                        <div className="card mb-4">
                            <div className="card-header bg-light">
                                <h6 className="mb-0">
                                    <i className="bi bi-plus-circle me-2"></i>
                                    Adicionar Nova Peça
                                </h6>
                            </div>
                            <div className="card-body">
                                <div className="row g-3">
                                    {/* Tipo de Peça */}
                                    <div className="col-md-3">
                                        <label className="form-label">
                                            Tipo de Peça <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className={`form-control ${!novaPeca.tipopeca.trim() ? "is-invalid" : ""}`}
                                            value={novaPeca.tipopeca}
                                            onChange={(e) => setNovaPeca({ ...novaPeca, tipopeca: e.target.value })}
                                            placeholder="Ex: Teclado, Tela..."
                                        />
                                    </div>

                                    {/* Marca */}
                                    <div className="col-md-3">
                                        <label className="form-label">
                                            Marca <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className={`form-control ${!novaPeca.marca.trim() ? "is-invalid" : ""}`}
                                            value={novaPeca.marca}
                                            onChange={(e) => setNovaPeca({ ...novaPeca, marca: e.target.value })}
                                            placeholder="Ex: Dell, HP..."
                                        />
                                    </div>

                                    {/* Quantidade */}
                                    <div className="col-md-2">
                                        <label className="form-label">
                                            Quantidade <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            className={`form-control ${novaPeca.quantidade < 1 ? "is-invalid" : ""}`}
                                            value={novaPeca.quantidade}
                                            onChange={(e) => setNovaPeca({ ...novaPeca, quantidade: Number(e.target.value) || 1 })}
                                            min="1"
                                        />
                                    </div>

                                    {/* Preço Unitário */}
                                    <div className="col-md-2">
                                        <label className="form-label">
                                            Preço Unit. <span className="text-danger">*</span>
                                        </label>
                                        <div className="input-group">
                                            <span className="input-group-text">€</span>
                                            <input
                                                type="number"
                                                className={`form-control ${novaPeca.preco_unitario <= 0 ? "is-invalid" : ""}`}
                                                value={novaPeca.preco_unitario}
                                                onChange={(e) => setNovaPeca({ ...novaPeca, preco_unitario: Number(e.target.value) || 0 })}
                                                step="0.01"
                                                min="0"
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>

                                    {/* Botão de Adicionar Melhorado */}
                                    <div className="col-md-2">
                                        <label className="form-label">&nbsp;</label>
                                        <div className="d-grid">
                                            {isFormularioValido() ? (
                                                <button
                                                    type="button"
                                                    className="btn btn-success btn-lg position-relative overflow-hidden"
                                                    onClick={adicionarPeca}
                                                    style={{
                                                        transition: "all 0.3s ease",
                                                        transform: "scale(1)",
                                                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.target.style.transform = "scale(1.05)"
                                                        e.target.style.boxShadow = "0 4px 8px rgba(0,0,0,0.2)"
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.target.style.transform = "scale(1)"
                                                        e.target.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)"
                                                    }}
                                                >
                                                    <i className="bi bi-plus-circle-fill me-2"></i>
                                                    <span className="fw-bold">Adicionar</span>
                                                    <div
                                                        className="position-absolute top-0 start-0 w-100 h-100 bg-white opacity-25"
                                                        style={{
                                                            transform: "translateX(-100%)",
                                                            transition: "transform 0.6s ease",
                                                        }}
                                                    ></div>
                                                </button>
                                            ) : (
                                                <div className="position-relative">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary btn-lg w-100"
                                                        disabled
                                                        style={{
                                                            cursor: "not-allowed",
                                                            opacity: 0.6,
                                                        }}
                                                        title={getTooltipMessage()}
                                                        data-bs-toggle="tooltip"
                                                        data-bs-placement="top"
                                                    >
                                                        <i className="bi bi-plus-circle me-2"></i>
                                                        Adicionar
                                                    </button>

                                                    {/* Tooltip customizado */}
                                                    <div
                                                        className="position-absolute top-0 start-50 translate-middle-x bg-dark text-white px-2 py-1 rounded small"
                                                        style={{
                                                            marginTop: "-35px",
                                                            whiteSpace: "nowrap",
                                                            zIndex: 1000,
                                                            opacity: getTooltipMessage() ? 1 : 0,
                                                            transition: "opacity 0.3s ease",
                                                        }}
                                                    >
                                                        {getTooltipMessage()}
                                                        <div
                                                            className="position-absolute top-100 start-50 translate-middle-x"
                                                            style={{
                                                                width: 0,
                                                                height: 0,
                                                                borderLeft: "5px solid transparent",
                                                                borderRight: "5px solid transparent",
                                                                borderTop: "5px solid #000",
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Linha adicional para desconto e observações */}
                                <div className="row g-3 mt-2">
                                    {/* Tipo de Desconto */}
                                    <div className="col-md-2">
                                        <label className="form-label">Tipo Desconto</label>
                                        <select
                                            className="form-select"
                                            value={novaPeca.tipo_desconto}
                                            onChange={(e) =>
                                                setNovaPeca({
                                                    ...novaPeca,
                                                    tipo_desconto: e.target.value,
                                                    desconto_unitario: 0,
                                                    desconto_percentual: 0,
                                                })
                                            }
                                        >
                                            <option value="valor">Valor (€)</option>
                                            <option value="percentual">Percentual (%)</option>
                                        </select>
                                    </div>

                                    {/* Campo de Desconto */}
                                    <div className="col-md-2">
                                        <label className="form-label">Desconto</label>
                                        {novaPeca.tipo_desconto === "percentual" ? (
                                            <div className="input-group">
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    value={novaPeca.desconto_percentual}
                                                    onChange={(e) =>
                                                        setNovaPeca({ ...novaPeca, desconto_percentual: Number(e.target.value) || 0 })
                                                    }
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    placeholder="0"
                                                />
                                                <span className="input-group-text">%</span>
                                            </div>
                                        ) : (
                                            <div className="input-group">
                                                <span className="input-group-text">€</span>
                                                <input
                                                    type="number"
                                                    className="form-control"
                                                    value={novaPeca.desconto_unitario}
                                                    onChange={(e) => setNovaPeca({ ...novaPeca, desconto_unitario: Number(e.target.value) || 0 })}
                                                    step="0.01"
                                                    min="0"
                                                    placeholder="0,00"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Existe no Sistema */}
                                    <div className="col-md-2">
                                        <label className="form-label">No Sistema</label>
                                        <div className="form-check form-switch mt-2">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                checked={novaPeca.existe_no_sistema}
                                                onChange={(e) => setNovaPeca({ ...novaPeca, existe_no_sistema: e.target.checked })}
                                            />
                                            <label className="form-check-label">{novaPeca.existe_no_sistema ? "Sim" : "Não"}</label>
                                        </div>
                                    </div>

                                    {/* Observações */}
                                    <div className="col-md-6">
                                        <label className="form-label">Observações</label>
                                        <textarea
                                            className="form-control"
                                            value={novaPeca.observacoes}
                                            onChange={(e) => setNovaPeca({ ...novaPeca, observacoes: e.target.value })}
                                            rows="2"
                                            placeholder="Observações adicionais..."
                                        />
                                    </div>
                                </div>

                                {/* Preview da peça a ser adicionada */}
                                {isFormularioValido() && (
                                    <div className="mt-3 p-3 bg-light rounded">
                                        <h6 className="text-muted mb-2">
                                            <i className="bi bi-eye me-1"></i>
                                            Preview da Peça:
                                        </h6>
                                        <div className="row">
                                            <div className="col-md-8">
                                                <strong>{novaPeca.tipopeca}</strong> - {novaPeca.marca}
                                                <br />
                                                <small className="text-muted">
                                                    Qtd: {novaPeca.quantidade} × €{Number(novaPeca.preco_unitario).toFixed(2)}
                                                    {(novaPeca.desconto_unitario > 0 || novaPeca.desconto_percentual > 0) && (
                                                        <span className="text-warning ms-2">
                                                            (Desconto:{" "}
                                                            {novaPeca.tipo_desconto === "percentual"
                                                                ? `${novaPeca.desconto_percentual}%`
                                                                : `€${novaPeca.desconto_unitario}`}
                                                            )
                                                        </span>
                                                    )}
                                                </small>
                                            </div>
                                            <div className="col-md-4 text-end">
                                                <div className="h5 text-success mb-0">
                                                    €{(calcularPrecoComDesconto(novaPeca) * novaPeca.quantidade).toFixed(2)}
                                                </div>
                                                {(novaPeca.desconto_unitario > 0 || novaPeca.desconto_percentual > 0) && (
                                                    <small className="text-decoration-line-through text-muted">
                                                        €{(novaPeca.preco_unitario * novaPeca.quantidade).toFixed(2)}
                                                    </small>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Lista de Peças Adicionadas */}
                        {pecas.length > 0 && (
                            <div className="card">
                                <div className="card-header bg-light">
                                    <h6 className="mb-0">
                                        <i className="bi bi-list-ul me-2"></i>
                                        Peças Adicionadas ({pecas.length})
                                    </h6>
                                </div>
                                <div className="card-body p-0">
                                    <div className="table-responsive">
                                        <table className="table table-hover mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th>Peça</th>
                                                    <th>Marca</th>
                                                    <th>Qtd</th>
                                                    <th>Preço Unit.</th>
                                                    <th>Desconto</th>
                                                    <th>Preço Final</th>
                                                    <th>Total</th>
                                                    <th>Sistema</th>
                                                    <th>Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pecas.map((peca, index) => {
                                                    const precoComDesconto = calcularPrecoComDesconto(peca)
                                                    const total = calcularTotal(peca)
                                                    const temDesconto = precoComDesconto < (Number(peca.preco_unitario) || 0)

                                                    return (
                                                        <tr key={peca.id}>
                                                            <td>
                                                                <div className="fw-bold">{peca.tipopeca}</div>
                                                                {peca.observacoes && <small className="text-muted">{peca.observacoes}</small>}
                                                            </td>
                                                            <td>{peca.marca}</td>
                                                            <td>
                                                                <span className="badge bg-secondary">{peca.quantidade}</span>
                                                            </td>
                                                            <td>€{(Number(peca.preco_unitario) || 0).toFixed(2)}</td>
                                                            <td>
                                                                {temDesconto ? (
                                                                    <span
                                                                        className={`badge ${peca.tipo_desconto === "percentual" ? "bg-warning" : "bg-info"}`}
                                                                    >
                                                                        {peca.tipo_desconto === "percentual"
                                                                            ? `${peca.desconto_percentual}%`
                                                                            : `€${peca.desconto_unitario}`}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-muted">-</span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span className={temDesconto ? "fw-bold text-success" : "text-muted"}>
                                                                    €{precoComDesconto.toFixed(2)}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div className="fw-bold text-primary">€{total.toFixed(2)}</div>
                                                            </td>
                                                            <td>
                                                                {peca.existe_no_sistema ? (
                                                                    <i className="bi bi-check-circle text-success" title="Existe no sistema"></i>
                                                                ) : (
                                                                    <i className="bi bi-x-circle text-muted" title="Não existe no sistema"></i>
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
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
                            <i className="bi bi-x-circle me-1"></i>
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className="btn btn-success"
                            onClick={handleSave}
                            disabled={loading || pecas.length === 0}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-check-circle me-1"></i>
                                    Salvar {pecas.length} {pecas.length === 1 ? "Peça" : "Peças"} (€{calcularTotalGeral().toFixed(2)})
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop fade show"></div>
        </div>
    )
}

export default PecasEditor
