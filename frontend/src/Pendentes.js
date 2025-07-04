import React, { useEffect, useState } from 'react';
import axios from 'axios';
import DataTable from 'react-data-table-component';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

function Pendentes() {
    const [pendentes, setPendentes] = useState([]);
    const [selectedRow, setSelectedRow] = useState(null);
    const [paymentType, setPaymentType] = useState('');

    const fetchPendentes = () => {
        const token = localStorage.getItem('token');
        axios.get('http://localhost:8081/pending', {
            headers: {
                'Authorization': token
            }
        })
            .then(response => {
                console.log('Pendentes fetched:', response.data); // Log para verificar os pendentes recebidos
                setPendentes(response.data);
            })
            .catch(error => {
                console.error('There was an error fetching the pendentes!', error);
            });
    };

    useEffect(() => {
        fetchPendentes();
    }, []);

    const handleMarkAsPaid = () => {
        const token = localStorage.getItem('token');
        axios.put(`http://localhost:8081/pending/${selectedRow.id}/mark_as_paid`, { payment_type: paymentType }, {
            headers: {
                'Authorization': token
            }
        })
            .then(response => {
                alert('Recebimento marcado como pago com sucesso');
                setPendentes(pendentes.filter(item => item.id !== selectedRow.id));
                setSelectedRow(null);
                setPaymentType('');
            })
            .catch(error => {
                console.error('Houve um erro ao marcar o recebimento como pago!', error);
            });
    };

    const columns = [
        {
            name: 'Ações',
            cell: row => (
                <div className='d-flex'>
                    <button onClick={() => setSelectedRow(row)} className='btn btn-success btn-sm'>
                        <i className="bi bi-check"></i>
                    </button>
                </div>
            ),
            ignoreRowClick: true,
        },
        { name: 'Data', selector: row => new Date(row.date).toLocaleDateString('pt-PT'), sortable: true },
        { name: 'Número do Documento', selector: row => row.document_number, sortable: true },
        { name: 'Tipo de Documento', selector: row => row.document_type, sortable: true },
        { name: 'Descrição', selector: row => row.description, sortable: true },
        { name: 'Tipo de Pagamento', selector: row => row.payment_type || 'N/A', sortable: true },
        { name: 'Valor de Recebimento', selector: row => row.receipt_amount, sortable: true },
    ];

    return (
        <div className="container">
            <h2>Recebimentos Pendentes</h2>
            <DataTable
                columns={columns}
                data={pendentes}
                pagination
            />

            {selectedRow && (
                <div className="modal fade show" style={{ display: 'block' }}>
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Marcar como Pago</h5>
                                <button type="button" className="close" onClick={() => setSelectedRow(null)}>
                                    <span>&times;</span>
                                </button>
                            </div>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label htmlFor="paymentType">Tipo de Pagamento</label>
                                    <select id="paymentType" className="form-control" value={paymentType} onChange={e => setPaymentType(e.target.value)}>
                                        <option value="">Selecione</option>
                                        <option value="C">Cheque</option>
                                        <option value="N">Numerário</option>
                                        <option value="A">Multibanco</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setSelectedRow(null)}>Cancelar</button>
                                <button type="button" className="btn btn-primary" onClick={handleMarkAsPaid}>Marcar como Pago</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Pendentes;