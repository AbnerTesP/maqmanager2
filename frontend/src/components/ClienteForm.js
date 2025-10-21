"use client"

import { useState, useEffect, useRef } from "react"
import axios from "axios"
import anime from "animejs"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

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
    const formRef = useRef(null)
    const erroRef = useRef(null)

    useEffect(() => {
        if (clienteId) {
            carregarCliente()
        }
    }, [clienteId])

    useEffect(() => {
        if (formRef.current) {
            anime({
                targets: formRef.current,
                opacity: [0, 1],
                translateY: [20, 0],
                duration: 600,
                easing: "easeOutCubic",
            })
        }
    }, [])

    useEffect(() => {
        if (erro && erroRef.current) {
            anime({
                targets: erroRef.current,
                opacity: [0, 1],
                translateX: [-20, 0],
                duration: 400,
                easing: "easeOutCubic",
            })
        }
    }, [erro])

    const carregarCliente = async () => {
        try {
            setLoading(true)
            const response = await axios.get(`http://localhost:8082/clientes/${clienteId}`)
            setForm(response.data)
        } catch (error) {
            console.error("Erro ao carregar cliente:", error)
            setErro("Erro ao carregar dados do cliente")
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e) => {
        if (e) e.preventDefault()
        setErro("")

        if (!form.nome.trim()) {
            setErro("Nome é obrigatório")
            return
        }

        try {
            setLoading(true)

            if (clienteId) {
                await axios.put(`http://localhost:8082/clientes/${clienteId}`, form)
            } else {
                await axios.post("http://localhost:8082/clientes", form)
            }

            if (onSave) onSave()
        } catch (error) {
            console.error("Erro ao salvar cliente:", error)
            if (error.response?.data?.error) {
                setErro(error.response.data.error)
            } else {
                setErro("Erro ao salvar cliente")
            }
        } finally {
            setLoading(false)
        }
    }

    if (loading && clienteId) {
        return (
            <div className="text-center p-4" role="status" aria-live="polite">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="card shadow-sm" ref={formRef} style={{ opacity: 0 }}>
            <div
                className="card-header bg-gradient text-white"
                style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
            >
                <h5 className="mb-0">
                    <i className="bi bi-person me-2" aria-hidden="true"></i>
                    {clienteId ? "Editar Cliente" : "Novo Cliente"}
                </h5>
            </div>
            <div className="card-body">
                {erro && (
                    <div
                        ref={erroRef}
                        className="alert alert-danger d-flex align-items-center mb-3"
                        role="alert"
                        aria-live="assertive"
                        style={{ opacity: 0 }}
                    >
                        <i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true"></i>
                        <div>{erro}</div>
                    </div>
                )}

                <div>
                    <div className="row">
                        <div className="col-md-6">
                            <div className="mb-3">
                                <label htmlFor="cliente-nome" className="form-label">
                                    <i className="bi bi-person-fill me-1" aria-hidden="true"></i>
                                    Nome{" "}
                                    <span className="text-danger" aria-label="obrigatório">
                                        *
                                    </span>
                                </label>
                                <input
                                    type="text"
                                    id="cliente-nome"
                                    className="form-control"
                                    name="nome"
                                    value={form.nome}
                                    onChange={handleChange}
                                    required
                                    aria-required="true"
                                    placeholder="Nome completo do cliente"
                                    autoFocus
                                />
                            </div>

                            <div className="mb-3">
                                <label htmlFor="cliente-morada" className="form-label">
                                    <i className="bi bi-house-fill me-1" aria-hidden="true"></i>
                                    Morada
                                </label>
                                <textarea
                                    id="cliente-morada"
                                    className="form-control"
                                    name="morada"
                                    value={form.morada}
                                    onChange={handleChange}
                                    rows="3"
                                    placeholder="Morada completa do cliente"
                                    aria-describedby="morada-help"
                                />
                                <small id="morada-help" className="form-text text-muted">
                                    Endereço completo do cliente
                                </small>
                            </div>

                            <div className="mb-3">
                                <label htmlFor="cliente-numero-interno" className="form-label">
                                    <i className="bi bi-hash me-1" aria-hidden="true"></i>
                                    Número Interno
                                </label>
                                <input
                                    type="text"
                                    id="cliente-numero-interno"
                                    className="form-control"
                                    name="numero_interno"
                                    value={form.numero_interno}
                                    onChange={handleChange}
                                    placeholder="Número interno único"
                                />
                            </div>
                        </div>

                        <div className="col-md-6">
                            <div className="mb-3">
                                <label htmlFor="cliente-telefone" className="form-label">
                                    <i className="bi bi-telephone-fill me-1" aria-hidden="true"></i>
                                    Telefone
                                </label>
                                <input
                                    type="tel"
                                    id="cliente-telefone"
                                    className="form-control"
                                    name="telefone"
                                    value={form.telefone}
                                    onChange={handleChange}
                                    placeholder="+351 123 456 789"
                                    aria-describedby="telefone-help"
                                />
                                <small id="telefone-help" className="form-text text-muted">
                                    Formato: +351 XXX XXX XXX
                                </small>
                            </div>

                            <div className="mb-3">
                                <label htmlFor="cliente-email" className="form-label">
                                    <i className="bi bi-envelope-fill me-1" aria-hidden="true"></i>
                                    Email
                                </label>
                                <input
                                    type="email"
                                    id="cliente-email"
                                    className="form-control"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder="cliente@email.com"
                                    aria-describedby="email-help"
                                />
                                <small id="email-help" className="form-text text-muted">
                                    Email de contacto do cliente
                                </small>
                            </div>

                            <div className="mb-3">
                                <label htmlFor="cliente-nif" className="form-label">
                                    <i className="bi bi-card-text me-1" aria-hidden="true"></i>
                                    NIF
                                </label>
                                <input
                                    type="text"
                                    id="cliente-nif"
                                    className="form-control"
                                    name="nif"
                                    value={form.nif}
                                    onChange={handleChange}
                                    placeholder="123456789"
                                    maxLength="9"
                                    aria-describedby="nif-help"
                                />
                                <small id="nif-help" className="form-text text-muted">
                                    Número de Identificação Fiscal (9 dígitos)
                                </small>
                            </div>
                        </div>
                    </div>

                    <div className="d-flex justify-content-between mt-4">
                        <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={onCancel}
                            disabled={loading}
                            aria-label="Cancelar criação de cliente"
                        >
                            <i className="bi bi-x-circle me-1" aria-hidden="true"></i>
                            Cancelar
                        </button>

                        <button
                            type="button"
                            className="btn btn-success"
                            onClick={handleSubmit}
                            disabled={loading}
                            aria-label={clienteId ? "Atualizar dados do cliente" : "Criar novo cliente"}
                        >
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-check-circle me-1" aria-hidden="true"></i>
                                    {clienteId ? "Atualizar" : "Criar"} Cliente
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ClienteForm
