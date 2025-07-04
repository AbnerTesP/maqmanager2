import React, { useState } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Estilos/CashRegister.css';

function CashRegister() {
    const [date, setDate] = useState('');
    const [documentNumber, setDocumentNumber] = useState('');
    const [documentType, setDocumentType] = useState('');
    const [description, setDescription] = useState('');
    const [paymentType, setPaymentType] = useState('');
    const [receiptAmount, setReceiptAmount] = useState('');
    const [paymentAmount, setPaymentAmount] = useState('');
    const [isPending, setIsPending] = useState(false);

    function handleSubmit(event) {
        event.preventDefault();
        const userId = 1; // Substitua pelo ID do usuário logado
        const token = localStorage.getItem('token');
        axios.post('http://localhost:8081/cash_register', {
            date,
            document_number: documentNumber,
            document_type: documentType,
            description,
            payment_type: paymentType,
            receipt_amount: parseFloat(receiptAmount),
            payment_amount: parseFloat(paymentAmount),
            user_id: userId,
            is_pending: isPending
        }, {
            headers: {
                'Authorization': token
            }
        })
            .then(res => alert(res.data.message))
            .catch(err => console.log(err));
    }

    return (
        <div className="cash-register-container">
            <header className="cash-register-header">
                <h1>Inserir Registo de Caixa</h1>
            </header>
            <div className="cash-register-form-container">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="date">Data</label>
                        <input type="date" id="date" className="form-control" onChange={e => setDate(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="documentNumber">Nº do Documento</label>
                        <input type="text" id="documentNumber" className="form-control" onChange={e => setDocumentNumber(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="documentType">Tipo de Documento</label>
                        <input type="text" id="documentType" className="form-control" onChange={e => setDocumentType(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="description">Descrição</label>
                        <input type="text" id="description" className="form-control" onChange={e => setDescription(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="paymentType">Tipo de Pagamento</label>
                        <select id="paymentType" className="form-control" onChange={e => setPaymentType(e.target.value)}>
                            <option value="">Selecione</option>
                            <option value="C">Cheque</option>
                            <option value="N">Numerário</option>
                            <option value="A">Multibanco</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="receiptAmount">Valor de Recebimento</label>
                        <input type="number" step="0.01" id="receiptAmount" className="form-control" onChange={e => setReceiptAmount(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="paymentAmount">Valor de Pagamento</label>
                        <input type="number" step="0.01" id="paymentAmount" className="form-control" onChange={e => setPaymentAmount(e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="isPending">Recibento Pendente</label>
                        <input type="checkbox" step="0.01" id="isPending" className="form-check-input" checked={isPending} onChange={e => setIsPending(e.target.checked)} />
                    </div>
                    <button type="submit" className="btn btn-primary">Inserir</button>
                </form>
            </div>
        </div>
    );
}

export default CashRegister;