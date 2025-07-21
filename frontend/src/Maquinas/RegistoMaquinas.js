"use client"

import { useState, useEffect, useCallback } from "react"
import axios from "axios"
import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.css"
import "./RegistoMaquinas.css"

function RegistoMaquinas() {
    const [date, setDate] = useState("")
    const [tipo, setTipo] = useState("")
    const [marca, setMarca] = useState("")
    const [modelo, setModelo] = useState("")
    const [tipoRegistro, setTipoRegistro] = useState("maquina")
    const [pecaTipo, setPecaTipo] = useState("")
    const [pecaMarca, setPecaMarca] = useState("")
    const [file, setFile] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [errors, setErrors] = useState({})
    const [submitStatus, setSubmitStatus] = useState("idle") // idle, success, error
    const [successMessage, setSuccessMessage] = useState("")
    const [errorMessage, setErrorMessage] = useState("")

    useEffect(() => {
        const today = new Date().toISOString().split("T")[0]
        setDate(today)
    }, [])

    // Reset form when changing registration type
    useEffect(() => {
        setErrors({})
        setSubmitStatus("idle")
        setSuccessMessage("")
        setErrorMessage("")

        if (tipoRegistro === "maquina") {
            setPecaTipo("")
            setPecaMarca("")
        } else {
            setTipo("")
            setMarca("")
            setFile(null)
        }
    }, [tipoRegistro])

    const validateForm = useCallback(() => {
        const newErrors = {}

        if (tipoRegistro === "maquina") {
            if (!date.trim()) newErrors.date = "Data é obrigatória"
            if (!tipo.trim()) newErrors.tipo = "Tipo é obrigatório"
            if (!marca.trim()) newErrors.marca = "Marca é obrigatória"
            if (!modelo.trim()) newErrors.modelo = "Modelo é obrigatório"

            if (file && file.size > 10 * 1024 * 1024) {
                newErrors.file = "Arquivo deve ter no máximo 10MB"
            }

            const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"]
            if (file && !allowedTypes.includes(file.type)) {
                newErrors.file = "Apenas arquivos PDF, JPEG e PNG são permitidos"
            }
        } else {
            if (!pecaTipo.trim()) newErrors.pecaTipo = "Tipo de peça é obrigatório"
            if (!pecaMarca.trim()) newErrors.pecaMarca = "Marca da peça é obrigatória"
            if (!modelo.trim()) newErrors.modelo = "Modelo da máquina é obrigatório"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }, [tipoRegistro, date, tipo, marca, modelo, pecaTipo, pecaMarca, file])

    const resetForm = useCallback(() => {
        if (tipoRegistro === "maquina") {
            const today = new Date().toISOString().split("T")[0]
            setDate(today)
            setTipo("")
            setMarca("")
            setModelo("")
            setFile(null)
        } else {
            setPecaTipo("")
            setPecaMarca("")
            setModelo("")
        }
        setErrors({})
        setSubmitStatus("idle")
        setSuccessMessage("")
        setErrorMessage("")
    }, [tipoRegistro])

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (!validateForm()) {
            setSubmitStatus("error")
            setErrorMessage("Por favor, corrija os erros no formulário.")
            return
        }

        setIsLoading(true)
        setSubmitStatus("idle")
        setSuccessMessage("")
        setErrorMessage("")

        try {
            if (tipoRegistro === "maquina") {
                const formData = new FormData()
                formData.append("date", date)
                formData.append("tipo", tipo.trim())
                formData.append("marca", marca.trim())
                formData.append("modelo", modelo.trim())

                if (file) {
                    formData.append("file", file)
                }

                const response = await axios.post("http://localhost:8082/machines", formData, {
                    headers: {
                        "Content-Type": "multipart/form-data",
                    },
                    timeout: 30000,
                })

                setSubmitStatus("success")
                setSuccessMessage(response.data.message || "Máquina registrada com sucesso!")
                resetForm()
            } else if (tipoRegistro === "peca") {
                const data = {
                    tipopeca: pecaTipo.trim(),
                    marca: pecaMarca.trim(),
                    modelo_maquina: modelo.trim(),
                }

                const response = await axios.post("http://localhost:8082/pecas", data, {
                    timeout: 30000,
                })

                setSubmitStatus("success")
                setSuccessMessage(response.data.message || "Peça registrada com sucesso!")
                resetForm()
            }
        } catch (err) {
            console.error("Erro ao enviar dados:", err)
            setSubmitStatus("error")

            let errorMsg = "Erro desconhecido ao enviar dados"

            if (err.code === "ECONNABORTED") {
                errorMsg = "Timeout: A requisição demorou muito para responder"
            } else if (err.response) {
                errorMsg = err.response.data?.message || `Erro do servidor: ${err.response.status}`
            } else if (err.request) {
                errorMsg = "Erro de conexão: Verifique sua internet e se o servidor está rodando"
            } else {
                errorMsg = err.message
            }

            setErrorMessage(errorMsg)
        } finally {
            setIsLoading(false)
        }
    }

    const handleFileChange = (event) => {
        const selectedFile = event.target.files?.[0] || null
        setFile(selectedFile)

        // Clear file error when a new file is selected
        if (errors.file) {
            setErrors((prev) => ({ ...prev, file: undefined }))
        }
    }

    // Auto-hide messages after 5 seconds
    useEffect(() => {
        if (successMessage || errorMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage("")
                setErrorMessage("")
                setSubmitStatus("idle")
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [successMessage, errorMessage])

    return (
        <div className="registo-container">
            {/* Header Section */}
            <div className="header-section">
                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-md-8 text-center">
                            <div className="header-content">
                                <h1 className="page-title">
                                    <i className="bi bi-plus-circle-fill me-3"></i>
                                    Inserir Registo
                                </h1>
                                <p className="page-subtitle">Adicione novas máquinas e peças ao sistema de forma rápida e organizada</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container main-content">
                <div className="row justify-content-center">
                    <div className="col-lg-8 col-xl-7">
                        {/* Success Alert */}
                        {successMessage && (
                            <div className="alert alert-success alert-modern alert-dismissible fade show" role="alert">
                                <div className="alert-content">
                                    <i className="bi bi-check-circle-fill alert-icon"></i>
                                    <div className="alert-text">
                                        <strong>Sucesso!</strong> {successMessage}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => {
                                        setSuccessMessage("")
                                        setSubmitStatus("idle")
                                    }}
                                    aria-label="Close"
                                ></button>
                            </div>
                        )}

                        {/* Error Alert */}
                        {errorMessage && (
                            <div className="alert alert-danger alert-modern alert-dismissible fade show" role="alert">
                                <div className="alert-content">
                                    <i className="bi bi-exclamation-triangle-fill alert-icon"></i>
                                    <div className="alert-text">
                                        <strong>Erro!</strong> {errorMessage}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => {
                                        setErrorMessage("")
                                        setSubmitStatus("idle")
                                    }}
                                    aria-label="Close"
                                ></button>
                            </div>
                        )}

                        {/* Form Card */}
                        <div className="form-card">
                            <div className="form-header">
                                <h5 className="form-title">
                                    <i className="bi bi-clipboard-data me-2"></i>
                                    Formulário de Registro
                                </h5>
                                <div className="form-status">
                                    {submitStatus === "success" && <i className="bi bi-check-circle-fill text-success"></i>}
                                    {submitStatus === "error" && <i className="bi bi-x-circle-fill text-danger"></i>}
                                    {isLoading && <div className="spinner-border spinner-border-sm text-primary"></div>}
                                </div>
                            </div>

                            <div className="form-body">
                                <form onSubmit={handleSubmit} className="modern-form">
                                    {/* Registration Type */}
                                    <div className="form-group">
                                        <label htmlFor="tipoRegistro" className="form-label">
                                            <i className="bi bi-list-ul me-2"></i>
                                            Tipo de Registro *
                                        </label>
                                        <select
                                            id="tipoRegistro"
                                            className="form-control modern-select"
                                            value={tipoRegistro}
                                            onChange={(e) => setTipoRegistro(e.target.value)}
                                            disabled={isLoading}
                                        >
                                            <option value="maquina">🏭 Máquina</option>
                                            <option value="peca">🔧 Peça</option>
                                        </select>
                                    </div>

                                    {tipoRegistro === "maquina" ? (
                                        <>
                                            {/* Machine Fields */}
                                            <div className="form-group">
                                                <label htmlFor="date" className="form-label">
                                                    <i className="bi bi-calendar3 me-2"></i>
                                                    Data *
                                                </label>
                                                <input
                                                    type="date"
                                                    id="date"
                                                    className={`form-control modern-input ${errors.date ? "is-invalid" : ""}`}
                                                    value={date}
                                                    onChange={(e) => setDate(e.target.value)}
                                                    disabled={isLoading}
                                                />
                                                {errors.date && <div className="invalid-feedback">{errors.date}</div>}
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="tipo" className="form-label">
                                                    <i className="bi bi-tag me-2"></i>
                                                    Tipo *
                                                </label>
                                                <input
                                                    type="text"
                                                    id="tipo"
                                                    className={`form-control modern-input ${errors.tipo ? "is-invalid" : ""}`}
                                                    value={tipo}
                                                    onChange={(e) => setTipo(e.target.value)}
                                                    placeholder="Ex: Berbequim, Serra, Tupia..."
                                                    disabled={isLoading}
                                                />
                                                {errors.tipo && <div className="invalid-feedback">{errors.tipo}</div>}
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="marca" className="form-label">
                                                    <i className="bi bi-award me-2"></i>
                                                    Marca *
                                                </label>
                                                <input
                                                    type="text"
                                                    id="marca"
                                                    className={`form-control modern-input ${errors.marca ? "is-invalid" : ""}`}
                                                    value={marca}
                                                    onChange={(e) => setMarca(e.target.value)}
                                                    placeholder="Ex: Festool, Dewalt, Metabo..."
                                                    disabled={isLoading}
                                                />
                                                {errors.marca && <div className="invalid-feedback">{errors.marca}</div>}
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="modelo" className="form-label">
                                                    <i className="bi bi-gear me-2"></i>
                                                    Modelo *
                                                </label>
                                                <input
                                                    type="text"
                                                    id="modelo"
                                                    className={`form-control modern-input ${errors.modelo ? "is-invalid" : ""}`}
                                                    value={modelo}
                                                    onChange={(e) => setModelo(e.target.value)}
                                                    placeholder="Ex: 320D, 6120M, PC200..."
                                                    disabled={isLoading}
                                                />
                                                {errors.modelo && <div className="invalid-feedback">{errors.modelo}</div>}
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="file" className="form-label">
                                                    <i className="bi bi-file-earmark-pdf me-2"></i>
                                                    Guia de Montagem
                                                </label>
                                                <div className="file-input-wrapper">
                                                    <input
                                                        type="file"
                                                        id="file"
                                                        className={`form-control modern-file-input ${errors.file ? "is-invalid" : ""}`}
                                                        onChange={handleFileChange}
                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                        disabled={isLoading}
                                                    />
                                                    <div className="file-input-overlay">
                                                        <i className="bi bi-cloud-upload file-icon"></i>
                                                        <span className="file-text">
                                                            {file ? file.name : "Clique para selecionar ou arraste o arquivo"}
                                                        </span>
                                                    </div>
                                                </div>
                                                {file && (
                                                    <div className="file-info">
                                                        <i className="bi bi-file-check me-2"></i>
                                                        <span className="file-name">{file.name}</span>
                                                        <span className="file-size">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                                    </div>
                                                )}
                                                {errors.file && <div className="invalid-feedback">{errors.file}</div>}
                                                <small className="form-text">Formatos aceitos: PDF, JPEG, PNG (máx. 10MB)</small>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* Parts Fields */}
                                            <div className="form-group">
                                                <label htmlFor="pecaTipo" className="form-label">
                                                    <i className="bi bi-wrench me-2"></i>
                                                    Tipo de Peça *
                                                </label>
                                                <input
                                                    type="text"
                                                    id="pecaTipo"
                                                    className={`form-control modern-input ${errors.pecaTipo ? "is-invalid" : ""}`}
                                                    value={pecaTipo}
                                                    onChange={(e) => setPecaTipo(e.target.value)}
                                                    placeholder="Ex: Filtro, Correia, Pistão, Válvula..."
                                                    disabled={isLoading}
                                                />
                                                {errors.pecaTipo && <div className="invalid-feedback">{errors.pecaTipo}</div>}
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="pecaMarca" className="form-label">
                                                    <i className="bi bi-award me-2"></i>
                                                    Marca da Peça *
                                                </label>
                                                <input
                                                    type="text"
                                                    id="pecaMarca"
                                                    className={`form-control modern-input ${errors.pecaMarca ? "is-invalid" : ""}`}
                                                    value={pecaMarca}
                                                    onChange={(e) => setPecaMarca(e.target.value)}
                                                    placeholder="Ex: Bosch, Mann, Donaldson..."
                                                    disabled={isLoading}
                                                />
                                                {errors.pecaMarca && <div className="invalid-feedback">{errors.pecaMarca}</div>}
                                            </div>

                                            <div className="form-group">
                                                <label htmlFor="modelo" className="form-label">
                                                    <i className="bi bi-gear me-2"></i>
                                                    Modelo da Máquina *
                                                </label>
                                                <input
                                                    type="text"
                                                    id="modelo"
                                                    className={`form-control modern-input ${errors.modelo ? "is-invalid" : ""}`}
                                                    value={modelo}
                                                    onChange={(e) => setModelo(e.target.value)}
                                                    placeholder="Ex: 320D, 6120M, PC200..."
                                                    disabled={isLoading}
                                                />
                                                {errors.modelo && <div className="invalid-feedback">{errors.modelo}</div>}
                                            </div>
                                        </>
                                    )}

                                    {/* Form Actions */}
                                    <div className="form-actions">
                                        <button type="submit" className="btn btn-primary btn-modern btn-submit" disabled={isLoading}>
                                            {isLoading ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2" role="status">
                                                        <span className="visually-hidden">Carregando...</span>
                                                    </span>
                                                    Enviando...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="bi bi-check-lg me-2"></i>
                                                    Inserir {tipoRegistro === "maquina" ? "Máquina" : "Peça"}
                                                </>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary btn-modern"
                                            onClick={resetForm}
                                            disabled={isLoading}
                                        >
                                            <i className="bi bi-arrow-clockwise me-2"></i>
                                            Limpar
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default RegistoMaquinas
