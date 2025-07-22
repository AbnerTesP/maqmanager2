"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import ClienteForm from "./ClienteForm"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

function ClientesList() {
    const [clientes, setClientes] = useState([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState("")
    const [mostrarForm, setMostrarForm] = useState(false)
    const [clienteEditando, setClienteEditando] = useState(null)
    const [busca, setBusca] = useState("")
    const [confirmDelete, setConfirmDelete] = useState(null)

    useEffect(() => {
        carregarClientes()
    }, [])

    const carregarClientes = async () => {
        try {
            setLoading(true)
            setErro("")
            const response = await axios.get("http://localhost:8082/clientes")
            setClientes(response.data || [])
        } catch (error) {
            console.error("Erro ao carregar clientes:", error)
            setErro("Erro ao carregar lista de clientes")
            setClientes([])
        } finally {
            setLoading(false)
        }
    }

    const handleNovoCliente = () => {
        setClienteEditando(null)
        setMostrarForm(true)
    }

    const handleEditarCliente = (cliente) => {
        setClienteEditando(cliente)
        setMostrarForm(true)
    }

    const handleSalvarCliente = (clienteId) => {
        setMostrarForm(false)
        setClienteEditando(null)
        carregarClientes().then(() => {
            // Se foi criado um novo cliente, podemos fazer algo específico
            if (clienteId && !clienteEditando) {
                console.log("Novo cliente criado com ID:", clienteId)
                // Aqui você pode adicionar lógica adicional se necessário
            }
        })
    }

    const handleCancelarForm = () => {
        setMostrarForm(false)
        setClienteEditando(null)
    }

    const handleDeletarCliente = async (id) => {
        try {
            await axios.delete(`http://localhost:8082/clientes/${id}`)
            setConfirmDelete(null)
            carregarClientes()
        } catch (error) {
            console.error("Erro ao deletar cliente:", error)
            setErro("Erro ao deletar cliente")
        }
    }

    const clientesFiltrados = clientes.filter(
        (cliente) =>
            cliente.nome?.toLowerCase().includes(busca.toLowerCase()) ||
            cliente.numero_interno?.toLowerCase().includes(busca.toLowerCase()) ||
            cliente.telefone?.includes(busca) ||
            cliente.email?.toLowerCase().includes(busca.toLowerCase()),
    )

    if (mostrarForm) {
        return <ClienteForm clienteId={clienteEditando?.id} onSave={handleSalvarCliente} onCancel={handleCancelarForm} />
    }

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="mb-0">
                    <i className="bi bi-people-fill me-2 text-primary"></i>
                    Gestão de Clientes
                </h2>
                <button className="btn btn-success" onClick={handleNovoCliente}>
                    <i className="bi bi-person-plus me-1"></i>
                    Novo Cliente
                </button>
            </div>

            {/* Barra de Busca */}
            <div className="card mb-4">
                <div className="card-body">
                    <div className="row">
                        <div className="col-md-6">
                            <div className="input-group">
                                <span className="input-group-text">
                                    <i className="bi bi-search"></i>
                                </span>
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Buscar por nome, número interno, telefone ou email..."
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="col-md-6 d-flex align-items-center">
                            <span className="text-muted">
                                <i className="bi bi-info-circle me-1"></i>
                                {clientesFiltrados.length} cliente(s) encontrado(s)
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mensagens de Erro */}
            {erro && (
                <div className="alert alert-danger d-flex align-items-center mb-4" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    <div>{erro}</div>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Carregando...</span>
                    </div>
                    <p className="mt-2 text-muted">Carregando clientes...</p>
                </div>
            )}

            {/* Lista de Clientes */}
            {!loading && (
                <div className="card">
                    <div className="card-header bg-light">
                        <h5 className="mb-0">
                            <i className="bi bi-list-ul me-2"></i>
                            Lista de Clientes
                        </h5>
                    </div>
                    <div className="card-body p-0">
                        {clientesFiltrados.length === 0 ? (
                            <div className="text-center py-5">
                                <i className="bi bi-person-x display-1 text-muted"></i>
                                <h4 className="mt-3 text-muted">Nenhum cliente encontrado</h4>
                                <p className="text-muted">
                                    {busca ? "Tente ajustar os termos de busca" : "Comece criando um novo cliente"}
                                </p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-hover mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>
                                                <i className="bi bi-person me-1"></i>
                                                Nome
                                            </th>
                                            <th>
                                                <i className="bi bi-hash me-1"></i>
                                                Nº Interno
                                            </th>
                                            <th>
                                                <i className="bi bi-telephone me-1"></i>
                                                Telefone
                                            </th>
                                            <th>
                                                <i className="bi bi-envelope me-1"></i>
                                                Email
                                            </th>
                                            <th>
                                                <i className="bi bi-card-text me-1"></i>
                                                NIF
                                            </th>
                                            <th width="120">
                                                <i className="bi bi-gear me-1"></i>
                                                Ações
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clientesFiltrados.map((cliente) => (
                                            <tr key={cliente.id}>
                                                <td>
                                                    <div className="d-flex align-items-center">
                                                        <div
                                                            className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2"
                                                            style={{ width: "32px", height: "32px", fontSize: "14px" }}
                                                        >
                                                            {cliente.nome?.charAt(0)?.toUpperCase() || "?"}
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold">{cliente.nome || "Sem nome"}</div>
                                                            {cliente.morada && (
                                                                <small className="text-muted">
                                                                    <i className="bi bi-geo-alt me-1"></i>
                                                                    {cliente.morada.length > 30
                                                                        ? cliente.morada.substring(0, 30) + "..."
                                                                        : cliente.morada}
                                                                </small>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    {cliente.numero_interno ? (
                                                        <span className="badge bg-secondary">{cliente.numero_interno}</span>
                                                    ) : (
                                                        <span className="text-muted">-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {cliente.telefone ? (
                                                        <a href={`tel:${cliente.telefone}`} className="text-decoration-none">
                                                            {cliente.telefone}
                                                        </a>
                                                    ) : (
                                                        <span className="text-muted">-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {cliente.email ? (
                                                        <a href={`mailto:${cliente.email}`} className="text-decoration-none">
                                                            {cliente.email}
                                                        </a>
                                                    ) : (
                                                        <span className="text-muted">-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {cliente.nif ? (
                                                        <span className="font-monospace">{cliente.nif}</span>
                                                    ) : (
                                                        <span className="text-muted">-</span>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className="btn-group btn-group-sm" role="group">
                                                        <button
                                                            className="btn btn-outline-primary"
                                                            onClick={() => handleEditarCliente(cliente)}
                                                            title="Editar cliente"
                                                        >
                                                            <i className="bi bi-pencil"></i>
                                                        </button>
                                                        <button
                                                            className="btn btn-outline-danger"
                                                            onClick={() => setConfirmDelete(cliente)}
                                                            title="Deletar cliente"
                                                        >
                                                            <i className="bi bi-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Delete */}
            {confirmDelete && (
                <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header bg-danger text-white">
                                <h5 className="modal-title">
                                    <i className="bi bi-exclamation-triangle me-2"></i>
                                    Confirmar Exclusão
                                </h5>
                            </div>
                            <div className="modal-body">
                                <p>Tem certeza que deseja deletar o cliente:</p>
                                <div className="alert alert-light">
                                    <strong>{confirmDelete.nome}</strong>
                                    {confirmDelete.numero_interno && (
                                        <>
                                            <br />
                                            <small>Nº Interno: {confirmDelete.numero_interno}</small>
                                        </>
                                    )}
                                </div>
                                <p className="text-danger">
                                    <i className="bi bi-exclamation-triangle me-1"></i>
                                    Esta ação não pode ser desfeita!
                                </p>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                                    Cancelar
                                </button>
                                <button type="button" className="btn btn-danger" onClick={() => handleDeletarCliente(confirmDelete.id)}>
                                    <i className="bi bi-trash me-1"></i>
                                    Deletar Cliente
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ClientesList
