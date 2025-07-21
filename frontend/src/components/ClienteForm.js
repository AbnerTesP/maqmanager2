"use client"

import { useState, useEffect } from "react"
import axios from "axios"
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

    useEffect(() => {
        if (clienteId) {
            carregarCliente()
        }
    }, [clienteId])

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
            <div className="text-center p-4">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Carregando...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="card">
            <div className="card-header bg-primary text-white">
                <h5 className="mb-0">
                    <i className="bi bi-person me-2"></i>
                    {clienteId ? "Editar Cliente" : "Novo Cliente"}
                </h5>
            </div>
            <div className="card-body">
                {erro && (
                    <div className="alert alert-danger d-flex align-items-center mb-3" role="alert">
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        <div>{erro}</div>
                    </div>
                )}

                {/* Corrigido: troque <form> por <div> */}
                <div>
                    <div className="row">
                        <div className="col-md-6">
                            <div className="mb-3">
                                <label className="form-label">
                                    <i className="bi bi-person-fill me-1"></i>
                                    Nome <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="nome"
                                    value={form.nome}
                                    onChange={handleChange}
                                    required
                                    placeholder="Nome completo do cliente"
                                />
                            </div>

                            <div className="mb-3">
                                <label className="form-label">
                                    <i className="bi bi-house-fill me-1"></i>
                                    Morada
                                </label>
                                <textarea
                                    className="form-control"
                                    name="morada"
                                    value={form.morada}
                                    onChange={handleChange}
                                    rows="3"
                                    placeholder="Morada completa do cliente"
                                />
                            </div>

                            <div className="mb-3">
                                <label className="form-label">
                                    <i className="bi bi-hash me-1"></i>
                                    Número Interno
                                </label>
                                <input
                                    type="text"
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
                                <label className="form-label">
                                    <i className="bi bi-telephone-fill me-1"></i>
                                    Telefone
                                </label>
                                <input
                                    type="tel"
                                    className="form-control"
                                    name="telefone"
                                    value={form.telefone}
                                    onChange={handleChange}
                                    placeholder="+351 123 456 789"
                                />
                            </div>

                            <div className="mb-3">
                                <label className="form-label">
                                    <i className="bi bi-envelope-fill me-1"></i>
                                    Email
                                </label>
                                <input
                                    type="email"
                                    className="form-control"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder="cliente@email.com"
                                />
                            </div>

                            <div className="mb-3">
                                <label className="form-label">
                                    <i className="bi bi-card-text me-1"></i>
                                    NIF
                                </label>
                                <input
                                    type="text"
                                    className="form-control"
                                    name="nif"
                                    value={form.nif}
                                    onChange={handleChange}
                                    placeholder="123456789"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="d-flex justify-content-between mt-4">
                        <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={loading}>
                            <i className="bi bi-x-circle me-1"></i>
                            Cancelar
                        </button>

                        <button type="button" className="btn btn-success" onClick={handleSubmit} disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <i className="bi bi-check-circle me-1"></i>
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