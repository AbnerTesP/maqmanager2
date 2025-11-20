"use client"

import { useState, useEffect, useMemo } from "react"
import axios from "axios"
import ClienteForm from "./ClienteForm"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"

const API_BASE_URL = "http://localhost:8082"

function removerAcentos(str) {
    if (!str) return ""
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function ClientesList() {
    const [clientes, setClientes] = useState([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState("")

    // Estados de UI
    const [mostrarForm, setMostrarForm] = useState(false)
    const [clienteEditando, setClienteEditando] = useState(null)
    const [busca, setBusca] = useState("")
    const [clienteParaDeletar, setClienteParaDeletar] = useState(null)

    useEffect(() => {
        carregarClientes()
    }, [])

    const carregarClientes = async () => {
        setLoading(true)
        setErro("")
        try {
            const response = await axios.get(`${API_BASE_URL}/clientes`)
            setClientes(response.data || [])
        } catch (error) {
            console.error("Erro ao carregar:", error)
            setErro("Não foi possível carregar a lista de clientes.")
        } finally {
            setLoading(false)
        }
    }

    const handleSalvarCliente = (novoId) => {
        setMostrarForm(false)
        setClienteEditando(null)
        carregarClientes() // Recarrega para garantir consistência
    }

    const handleDeletarCliente = async () => {
        if (!clienteParaDeletar) return

        const id = clienteParaDeletar.id
        // Otimisticamente remove da UI
        setClientes(prev => prev.filter(c => c.id !== id))
        setClienteParaDeletar(null)

        try {
            await axios.delete(`${API_BASE_URL}/clientes/${id}`)
        } catch (error) {
            console.error("Erro ao deletar:", error)
            setErro("Erro ao excluir o cliente. Tente novamente.")
            carregarClientes() // Reverte em caso de erro
        }
    }

    // Filtragem Otimizada (Memoizada)
    const clientesFiltrados = useMemo(() => {
        if (!busca) return clientes

        const termo = removerAcentos(busca)
        return clientes.filter((cliente) =>
            removerAcentos(cliente.nome).includes(termo) ||
            removerAcentos(cliente.numero_interno).includes(termo) ||
            removerAcentos(cliente.telefone).includes(termo) ||
            removerAcentos(cliente.email).includes(termo)
        )
    }, [clientes, busca])

    if (mostrarForm) {
        return (
            <div className="container mt-4">
                <ClienteForm
                    clienteId={clienteEditando?.id}
                    onSave={handleSalvarCliente}
                    onCancel={() => { setMostrarForm(false); setClienteEditando(null); }}
                />
            </div>
        )
    }

    return (
        <div className="container-fluid bg-light min-vh-100 py-4 px-4">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h3 className="fw-bold text-dark mb-1">Clientes</h3>
                    <p className="text-muted mb-0">Gerencie sua base de clientes e contatos.</p>
                </div>
                <button
                    className="btn btn-primary shadow-sm d-flex align-items-center gap-2"
                    onClick={() => { setClienteEditando(null); setMostrarForm(true); }}
                >
                    <i className="bi bi-person-plus-fill"></i>
                    <span>Novo Cliente</span>
                </button>
            </div>

            {/* Barra de Ferramentas */}
            <div className="card border-0 shadow-sm rounded-3 mb-4">
                <div className="card-body p-3">
                    <div className="row align-items-center">
                        <div className="col-md-6">
                            <div className="input-group">
                                <span className="input-group-text bg-white border-end-0 text-muted">
                                    <i className="bi bi-search"></i>
                                </span>
                                <input
                                    type="text"
                                    className="form-control border-start-0 ps-0 shadow-none"
                                    placeholder="Pesquisar por nome, telefone, email..."
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="col-md-6 text-md-end mt-3 mt-md-0">
                            <span className="badge bg-light text-dark border px-3 py-2">
                                {clientesFiltrados.length} registos encontrados
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {erro && <div className="alert alert-danger shadow-sm">{erro}</div>}

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status"></div>
                </div>
            ) : clientesFiltrados.length === 0 ? (
                <div className="text-center py-5">
                    <div className="mb-3 text-muted opacity-25"><i className="bi bi-people fs-1"></i></div>
                    <h5 className="text-muted">Nenhum cliente encontrado</h5>
                    <p className="small text-muted">Tente uma pesquisa diferente ou adicione um novo cliente.</p>
                </div>
            ) : (
                <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0 align-middle">
                            <thead className="bg-light text-secondary small text-uppercase">
                                <tr>
                                    <th className="ps-4 py-3">Nome</th>
                                    <th>Contacto</th>
                                    <th>NIF</th>
                                    <th className="text-end pe-4">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {clientesFiltrados.map((cliente) => (
                                    <tr key={cliente.id} className="cursor-pointer" onClick={() => { setClienteEditando(cliente); setMostrarForm(true); }}>
                                        <td className="ps-4 py-3">
                                            <div className="d-flex align-items-center">
                                                <div className="avatar me-3 bg-primary bg-opacity-10 text-primary rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: '40px', height: '40px' }}>
                                                    {cliente.nome.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="fw-bold text-dark">{cliente.nome}</div>
                                                    {cliente.numero_interno && <small className="text-muted">ID: {cliente.numero_interno}</small>}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="d-flex flex-column small">
                                                {cliente.telefone && (
                                                    <span className="text-dark mb-1"><i className="bi bi-telephone me-2 text-muted"></i>{cliente.telefone}</span>
                                                )}
                                                {cliente.email && (
                                                    <span className="text-muted"><i className="bi bi-envelope me-2"></i>{cliente.email}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            {cliente.nif ? <span className="font-monospace text-dark">{cliente.nif}</span> : <span className="text-muted">-</span>}
                                        </td>
                                        <td className="text-end pe-4">
                                            <button
                                                className="btn btn-sm btn-light text-danger border ms-2"
                                                onClick={(e) => { e.stopPropagation(); setClienteParaDeletar(cliente); }}
                                                title="Excluir"
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
            )}

            {/* Modal de Confirmação (Bootstrap Modal Nativo Simplificado) */}
            {clienteParaDeletar && (
                <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content border-0 shadow">
                            <div className="modal-body text-center p-4">
                                <div className="mb-3 text-danger"><i className="bi bi-exclamation-circle fs-1"></i></div>
                                <h5 className="fw-bold">Excluir Cliente?</h5>
                                <p className="text-muted">
                                    Tem a certeza que deseja remover <strong>{clienteParaDeletar.nome}</strong>? <br />
                                    Esta ação não pode ser desfeita.
                                </p>
                                <div className="d-flex justify-content-center gap-2 mt-4">
                                    <button className="btn btn-light px-4" onClick={() => setClienteParaDeletar(null)}>Cancelar</button>
                                    <button className="btn btn-danger px-4" onClick={handleDeletarCliente}>Sim, excluir</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ClientesList