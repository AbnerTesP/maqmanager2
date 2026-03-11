"use client"

import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import { cn } from "../lib/utils"
import {
  User,
  Phone,
  Mail,
  MapPin,
  Hash,
  FileText,
  Loader2,
  Check,
  X,
  AlertTriangle
} from "lucide-react"

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
  const [loadingData, setLoadingData] = useState(false)
  const [erro, setErro] = useState("")

  useEffect(() => {
    if (clienteId) {
      const carregar = async () => {
        setLoadingData(true)
        try {
          const response = await axios.get(`${API_BASE_URL}/clientes/${clienteId}`)
          setForm(response.data)
        } catch (error) {
          console.error("Erro ao carregar:", error)
          setErro("Não foi possível carregar os dados do cliente.")
        } finally {
          setLoadingData(false)
        }
      }
      carregar()
    } else {
      setForm({
        nome: "",
        morada: "",
        numero_interno: "",
        telefone: "",
        email: "",
        nif: "",
      })
      setErro("")
    }
  }, [clienteId])

  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    if (erro) setErro("")
  }, [erro])

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()

    if (!form.nome.trim()) {
      setErro("O nome do cliente é obrigatório.")
      return
    }

    if (form.nif && !/^\d{9}$/.test(form.nif)) {
      setErro("NIF inválido. Deve conter 9 dígitos numéricos.")
      return
    }

    setLoading(true)
    setErro("")

    try {
      let response
      if (clienteId) {
        response = await axios.put(`${API_BASE_URL}/clientes/${clienteId}`, form)
      } else {
        response = await axios.post(`${API_BASE_URL}/clientes`, form)
      }
      const idRetorno = response.data.id || clienteId
      if (onSave) onSave(idRetorno)
    } catch (error) {
      console.error("Erro ao salvar:", error)
      const msg = error.response?.data?.error || "Erro ao salvar as alterações."
      setErro(msg)
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="form-loading">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm">A carregar dados...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden animate-fadeIn" data-testid="client-form">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-lg text-foreground">
              {clienteId ? "Editar Cliente" : "Novo Cliente"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {clienteId ? "Atualize os dados do cliente" : "Adicione um novo cliente à base de dados"}
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {erro && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-md text-destructive text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {erro}
          </div>
        )}

        {/* Nome */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
            <User className="w-4 h-4 text-muted-foreground" />
            Nome Completo
            <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            name="nome"
            value={form.nome}
            onChange={handleChange}
            placeholder="Nome da Empresa ou Pessoa"
            className="w-full px-4 py-2.5 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
            autoFocus={!clienteId}
            data-testid="input-nome"
          />
        </div>

        {/* Telefone & NIF */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              Telefone
            </label>
            <input
              type="tel"
              name="telefone"
              value={form.telefone}
              onChange={handleChange}
              placeholder="Ex: +351 9XX XXX XXX"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              data-testid="input-telefone"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              NIF
            </label>
            <input
              type="text"
              name="nif"
              value={form.nif}
              onChange={handleChange}
              placeholder="Ex: 123456789"
              maxLength="9"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors font-mono"
              data-testid="input-nif"
            />
          </div>
        </div>

        {/* Email & Nº Interno */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              Email
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="email@exemplo.com"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              data-testid="input-email"
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
              <Hash className="w-4 h-4 text-muted-foreground" />
              Nº Interno
            </label>
            <input
              type="text"
              name="numero_interno"
              value={form.numero_interno}
              onChange={handleChange}
              placeholder="Opcional"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors font-mono"
              data-testid="input-numero-interno"
            />
          </div>
        </div>

        {/* Morada */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            Morada
          </label>
          <textarea
            name="morada"
            value={form.morada}
            onChange={handleChange}
            rows="2"
            placeholder="Rua, Código Postal, Localidade"
            className="w-full px-4 py-2.5 bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-none"
            data-testid="input-morada"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-muted text-foreground rounded-md text-sm font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
            data-testid="cancel-btn"
          >
            <X className="w-4 h-4" />
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !form.nome.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="submit-btn"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                A guardar...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {clienteId ? "Guardar Alterações" : "Criar Cliente"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ClienteForm
