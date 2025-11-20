"use client"

import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

const API_BASE_URL = "http://localhost:8082"

function ClienteForm({ clienteId, onSave, onCancel }) {
    const [form, setForm] = useState({
        nome: "",
        morada: "",
        numero_interno: "",
        telefone: "",
        email: "",
        nif: "",
    })
    const [loading, setLoading] = useState(false)
    const [erro, setErro] = useState("")

    // Carregar dados se for edição
    useEffect(() => {
        if (clienteId) {
            const carregar = async () => {
                setLoading(true)
                try {
                    const response = await axios.get(`${API_BASE_URL}/clientes/${clienteId}`)
                    setForm(response.data)
                } catch (error) {
                    console.error("Erro ao carregar:", error)
                    setErro("Não foi possível carregar os dados do cliente.")
                } finally {
                    setLoading(false)
                }
            }
            carregar()
        } else {
            // Limpar formulário se não houver clienteId (para "Novo Cliente")
            setForm({
                nome: "",
                morada: "",
                numero_interno: "",
                telefone: "",
                email: "",
                nif: "",
            });
            setErro(""); // Limpar erros anteriores
        }
    }, [clienteId])

    const handleChange = useCallback((e) => {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
        if (erro) setErro("") // Limpa erro ao digitar
    }, [erro])

    const handleSubmit = async (e) => {
        if (e) e.preventDefault()

        if (!form.nome.trim()) {
            setErro("O nome do cliente é obrigatório.")
            return
        }

        // Validação básica do NIF (9 dígitos)
        if (form.nif && !/^\d{9}$/.test(form.nif)) {
            setErro("NIF inválido. Deve conter 9 dígitos numéricos.");
            return;
        }

        setLoading(true)
        setErro("")

        try {
            let response;
            if (clienteId) {
                response = await axios.put(`${API_BASE_URL}/clientes/${clienteId}`, form)
            } else {
                response = await axios.post(`${API_BASE_URL}/clientes`, form)
            }

            const idRetorno = response.data.id || clienteId;

            if (onSave) onSave(idRetorno)

        } catch (error) {
            console.error("Erro ao salvar:", error)
            const msg = error.response?.data?.error || "Erro ao salvar as alterações."
            setErro(msg)
        } finally {
            setLoading(false)
        }
    }

    if (loading && clienteId && !form.nome) { // Mostrar spinner apenas ao carregar um cliente existente
        return (
            <div className="text-center p-5">
                <div className="spinner-border text-primary mb-2" role="status"></div>
                <div className="text-muted small">A carregar cliente...</div>
            </div>
        )
    }

    return (
        <div className="card shadow-lg border-0 fade-in-animation">
            <div className="card-header bg-primary text-white py-3 d-flex justify-content-between align-items-center rounded-top-3">
                <h5 className="mb-0 fw-bold">
                    <i className={`bi ${clienteId ? 'bi-pencil-square' : 'bi-person-plus-fill'} me-2`}></i>
                    {clienteId ? "Editar Cliente" : "Novo Cliente"}
                </h5>
                <button type="button" className="btn-close btn-close-white" aria-label="Fechar" onClick={onCancel}></button>
            </div>

            <div className="card-body p-4">
                {erro && (
                    <div className="alert alert-danger d-flex align-items-center py-2 small" role="alert">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        <div>{erro}</div>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="row g-3">
                        {/* Nome */}
                        <div className="col-12">
                            <label className="form-label small fw-bold text-muted text-uppercase">Nome Completo <span className="text-danger">*</span></label>
                            <input
                                type="text"
                                className="form-control form-control-lg border-primary border-opacity-25"
                                name="nome"
                                value={form.nome}
                                onChange={handleChange}
                                placeholder="Nome da Empresa ou Pessoa"
                                autoFocus={!clienteId}
                                aria-required="true"
                            />
                        </div>

                        {/* Telefone e NIF */}
                        <div className="col-md-6">
                            <label className="form-label small fw-bold text-muted text-uppercase">Telefone</label>
                            <div className="input-group">
                                <span className="input-group-text bg-light border-primary border-opacity-25"><i className="bi bi-telephone text-primary"></i></span>
                                <input
                                    type="tel"
                                    className="form-control form-control-lg border-primary border-opacity-25 border-start-0"
                                    name="telefone"
                                    value={form.telefone}
                                    onChange={handleChange}
                                    placeholder="Ex: +351 9XX XXX XXX"
                                />
                            </div>
                        </div>

                        <div className="col-md-6">
                            <label className="form-label small fw-bold text-muted text-uppercase">NIF</label>
                            <input
                                type="text"
                                className="form-control form-control-lg border-primary border-opacity-25"
                                name="nif"
                                value={form.nif}
                                onChange={handleChange}
                                placeholder="Ex: 123456789"
                                maxLength="9"
                            />
                        </div>

                        {/* Email e Nº Interno */}
                        <div className="col-md-8">
                            <label className="form-label small fw-bold text-muted text-uppercase">Email</label>
                            <input
                                type="email"
                                className="form-control form-control-lg border-primary border-opacity-25"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                placeholder="Ex: email@exemplo.com"
                            />
                        </div>

                        <div className="col-md-4">
                            <label className="form-label small fw-bold text-muted text-uppercase">Nº Interno</label>
                            <input
                                type="text"
                                className="form-control form-control-lg border-primary border-opacity-25"
                                name="numero_interno"
                                value={form.numero_interno}
                                onChange={handleChange}
                                placeholder="Opcional"
                            />
                        </div>

                        {/* Morada */}
                        <div className="col-12">
                            <label className="form-label small fw-bold text-muted text-uppercase">Morada</label>
                            <textarea
                                className="form-control border-primary border-opacity-25"
                                name="morada"
                                value={form.morada}
                                onChange={handleChange}
                                rows="2"
                                placeholder="Rua, Código Postal, Localidade"
                            />
                        </div>
                    </div>

                    {/* Ações */}
                    <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                        <button
                            type="button"
                            className="btn btn-outline-secondary px-4"
                            onClick={onCancel}
                            disabled={loading}
                        >
                            <i className="bi bi-x-lg me-2"></i>Cancelar
                        </button>

                        <button
                            type="submit"
                            className="btn btn-primary px-4 fw-bold"
                            disabled={loading || !form.nome.trim()}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    A guardar...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-check-lg me-2"></i>
                                    {clienteId ? "Guardar Alterações" : "Criar Cliente"}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            {/* Animação CSS (Zero dependências) */}
            <style>{`
                .fade-in-animation {
                    animation: fadeIn 0.4s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .form-label { margin-bottom: 0.4rem; }
                .form-control.border-primary:focus {
                    border-color: #0d6efd; /* Bootstrap primary color */
                    box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25); /* Focus ring */
                }
                .input-group-text {
                    color: var(--bs-primary); /* Ícones com a cor primária */
                }
            `}</style>
        </div>
    )
}

export default ClienteForm