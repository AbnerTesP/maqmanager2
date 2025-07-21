"use client"

import { useState } from "react"

const PDFViewer = ({ reparacaoId, onClose }) => {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8082"

    const handleViewPDF = () => {
        setLoading(true)
        setError(null)

        // Abrir PDF em nova aba
        const pdfUrl = `${API_BASE_URL}/reparacoes/${reparacaoId}/pdf`
        window.open(pdfUrl, "_blank")

        setLoading(false)
    }

    const handleDownloadPDF = async () => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`${API_BASE_URL}/reparacoes/${reparacaoId}/pdf`)

            if (!response.ok) {
                throw new Error("Erro ao gerar PDF")
            }

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.style.display = "none"
            a.href = url
            a.download = `orcamento-${reparacaoId}.pdf`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
        } catch (err) {
            console.error("Erro ao baixar PDF:", err)
            setError("Erro ao baixar PDF: " + err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="modal fade show" style={{ display: "block" }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title">
                            <i className="bi bi-file-earmark-pdf me-2"></i>
                            Orçamento PDF
                        </h5>
                        <button type="button" className="btn-close" onClick={onClose} disabled={loading}></button>
                    </div>

                    <div className="modal-body text-center">
                        {error && (
                            <div className="alert alert-danger" role="alert">
                                <i className="bi bi-exclamation-triangle me-2"></i>
                                {error}
                            </div>
                        )}

                        <div className="mb-4">
                            <i className="bi bi-file-earmark-pdf display-1 text-danger"></i>
                            <h6 className="mt-2">Reparação #{reparacaoId}</h6>
                        </div>

                        <div className="d-grid gap-2">
                            <button className="btn btn-primary btn-lg" onClick={handleViewPDF} disabled={loading}>
                                {loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                        Gerando PDF...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-eye me-2"></i>
                                        Visualizar PDF
                                    </>
                                )}
                            </button>

                            <button className="btn btn-success" onClick={handleDownloadPDF} disabled={loading}>
                                <i className="bi bi-download me-2"></i>
                                Baixar PDF
                            </button>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop fade show"></div>
        </div>
    )
}

export default PDFViewer
