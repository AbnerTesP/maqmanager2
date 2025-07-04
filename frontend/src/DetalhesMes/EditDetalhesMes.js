import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

function EditDetalhesMes() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState({
        date: '',
        document_number: '',
        document_type: '',
        description: '',
        payment_type: '',
        receipt_amount: '',
        payment_amount: ''
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        axios.get(`http://localhost:8081/cash_register/${id}`, {
            headers: {
                'Authorization': token
            }
        })
            .then(response => {
                setData(response.data);
            })
            .catch(error => {
                console.error('There was an error fetching the data!', error);
            });
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        axios.put(`http://localhost:8081/cash_register/${id}`, data, {
            headers: {
                'Authorization': token
            }
        })
            .then(response => {
                //alert('Registro atualizado com sucesso!');
                navigate(`/detalhes_mes/${data.date.slice(0, 7)}`); // Navegar de volta para a página de detalhes do mês
            })
            .catch(error => {
                console.error('There was an error updating the data!', error);
            });
    };

    return (
        <div className="container">
            <h1>Editar Registro de Caixa</h1>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="date">Data</label>
                    <input type="date" id="date" name="date" className="form-control" value={data.date} onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label htmlFor="documentNumber">Nº do Documento</label>
                    <input type="text" id="documentNumber" name="document_number" className="form-control" value={data.document_number} onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label htmlFor="documentType">Tipo de Documento</label>
                    <input type="text" id="documentType" name="document_type" className="form-control" value={data.document_type} onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label htmlFor="description">Descrição</label>
                    <input type="text" id="description" name="description" className="form-control" value={data.description} onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label htmlFor="paymentType">Tipo de Pagamento</label>
                    <select id="paymentType" name="payment_type" className="form-control" value={data.payment_type} onChange={handleChange}>
                        <option value="C">Cheque</option>
                        <option value="N">Numerário</option>
                        <option value="A">Multibanco</option>
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="receiptAmount">Valor de Recebimento</label>
                    <input type="number" step="0.01" id="receiptAmount" name="receipt_amount" className="form-control" value={data.receipt_amount} onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label htmlFor="paymentAmount">Valor de Pagamento</label>
                    <input type="number" step="0.01" id="paymentAmount" name="payment_amount" className="form-control" value={data.payment_amount} onChange={handleChange} />
                </div>
                <button type="submit" className="btn btn-primary">Atualizar</button>
            </form>
        </div>
    );
}

export default EditDetalhesMes;