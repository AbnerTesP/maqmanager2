"use client"

import { useState, useEffect, useMemo } from "react"
import axios from "axios"
import ClienteForm from "./ClienteForm"
import { cn } from "../lib/utils"
import {
  Plus,
  Search,
  User,
  Phone,
  Mail,
  MapPin,
  Trash2,
  Pencil,
  X,
  AlertTriangle
} from "lucide-react"

const API_BASE_URL = "http://localhost:8082"

function removerAcentos(str) {
  if (!str) return ""
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

function ClientesList() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState("")
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

  const handleSalvarCliente = () => {
    setMostrarForm(false)
    setClienteEditando(null)
    carregarClientes()
  }

  const handleDeletarCliente = async () => {
    if (!clienteParaDeletar) return
    const id = clienteParaDeletar.id
    setClientes(prev => prev.filter(c => c.id !== id))
    setClienteParaDeletar(null)

    try {
      await axios.delete(`${API_BASE_URL}/clientes/${id}`)
    } catch (error) {
      console.error("Erro ao deletar:", error)
      setErro("Erro ao excluir o cliente. Tente novamente.")
      carregarClientes()
    }
  }

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
      <div className="max-w-2xl mx-auto animate-fadeIn" data-testid="client-form-container">
        <div className="mb-4">
          <button
            onClick={() => { setMostrarForm(false); setClienteEditando(null) }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
        </div>
        <ClienteForm
          clienteId={clienteEditando?.id}
          onSave={handleSalvarCliente}
          onCancel={() => { setMostrarForm(false); setClienteEditando(null) }}
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="clients-loading">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">A carregar clientes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn" data-testid="clients-list">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-1">Gestão da base de clientes</p>
        </div>
        <button
          onClick={() => { setClienteEditando(null); setMostrarForm(true) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          data-testid="new-client"
        >
          <Plus className="w-4 h-4" />
          Novo Cliente
        </button>
      </div>

      {/* Search & Stats */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Pesquisar por nome, telefone, email..."
            className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-md text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            data-testid="search-clients"
          />
        </div>
        <span className="px-3 py-1.5 bg-muted rounded-md text-sm text-muted-foreground">
          {clientesFiltrados.length} clientes encontrados
        </span>
      </div>

      {erro && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/30 rounded-md text-destructive">
          <AlertTriangle className="w-4 h-4" />
          {erro}
        </div>
      )}

      {/* Clients Grid */}
      {clientesFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-lg">
          <User className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">Nenhum cliente encontrado</h3>
          <p className="text-muted-foreground text-center max-w-md">
            {busca ? "Tente uma pesquisa diferente." : "Adicione o primeiro cliente para começar."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientesFiltrados.map((cliente) => (
            <div
              key={cliente.id}
              className="group bg-card border border-border rounded-lg p-5 hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
              onClick={() => { setClienteEditando(cliente); setMostrarForm(true) }}
              data-testid={`client-card-${cliente.id}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-heading font-bold text-lg">
                    {cliente.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {cliente.nome}
                    </h3>
                    {cliente.numero_interno && (
                      <p className="text-xs text-muted-foreground font-mono">
                        ID: {cliente.numero_interno}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setClienteParaDeletar(cliente) }}
                  className="p-2 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  title="Excluir"
                  data-testid={`delete-client-${cliente.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                {cliente.telefone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{cliente.telefone}</span>
                  </div>
                )}
                {cliente.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{cliente.email}</span>
                  </div>
                )}
                {cliente.nif && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">NIF:</span>
                    <span className="font-mono text-foreground">{cliente.nif}</span>
                  </div>
                )}
              </div>

              {/* Address */}
              {cliente.morada && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="line-clamp-2">{cliente.morada}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {clienteParaDeletar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="delete-modal">
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setClienteParaDeletar(null)}
          />
          <div className="relative w-full max-w-md bg-card border border-border rounded-lg shadow-xl p-6 animate-fadeIn">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-heading font-bold text-foreground mb-2">
                Excluir Cliente?
              </h3>
              <p className="text-muted-foreground mb-6">
                Tem a certeza que deseja remover <strong className="text-foreground">{clienteParaDeletar.nome}</strong>?
                <br />
                <span className="text-sm">Esta ação não pode ser desfeita.</span>
              </p>
              <div className="flex items-center gap-3 w-full">
                <button
                  onClick={() => setClienteParaDeletar(null)}
                  className="flex-1 px-4 py-2.5 bg-muted text-foreground rounded-md text-sm font-medium hover:bg-muted/80 transition-colors"
                  data-testid="cancel-delete"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeletarCliente}
                  className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-md text-sm font-medium hover:bg-destructive/90 transition-colors"
                  data-testid="confirm-delete"
                >
                  Sim, excluir
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
