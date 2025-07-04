import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './DetalhesMes.css';
import DataTable from 'react-data-table-component';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useNavigate, useParams } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';

function DetalhesMes() {
    const [data, setData] = useState([]);
    const navigate = useNavigate();
    const { month } = useParams();

    useEffect(() => {
        const token = localStorage.getItem('token');
        axios.get(`http://localhost:8081/cash_register?month=${month}`, {
            headers: {
                'Authorization': token
            }
        })
            .then(response => {
                console.log('Data fetched:', response.data); // Log para verificar os dados recebidos
                setData(response.data);
            })
            .catch(error => {
                console.error('There was an error fetching the data!', error);
            });
    }, [month]);

    const handleEdit = (row) => {
        navigate(`/edit_detalhes_mes/${row.id}`);
    };

    const handleInactivate = (row) => {
        const token = localStorage.getItem('token');
        axios.put(`http://localhost:8081/cash_register/inactivate/${row.id}`, {}, {
            headers: {
                'Authorization': token
            }
        })
            .then(response => {
                alert('Registro marcado como inativo com sucesso');
                setData(data.filter(item => item.id !== row.id));
            })
            .catch(error => {
                console.error('Houve um erro ao marcar o registro como inativo!', error);
            });
    };

    const columns = [
        {
            name: 'Ações',
            cell: row => (
                <div className='d-flex'>
                    <button onClick={() => handleEdit(row)} className='btn btn-warning btn-sm me-2'>
                        <i className="bi bi-pencil"></i>
                    </button>
                    <button onClick={() => handleInactivate(row)} className='btn btn-danger btn-sm'>
                        <i className="bi bi-trash"></i>
                    </button>
                </div>
            ),
            ignoreRowClick: true,
        },
        {
            name: 'Data',
            selector: row => new Date(row.date).toLocaleDateString('pt-PT'),
            sortable: true
        },
        { name: 'Número do Documento', selector: row => row.document_number, sortable: true },
        { name: 'Tipo de Documento', selector: row => row.document_type, sortable: true },
        { name: 'Descrição', selector: row => row.description, sortable: true },
        { name: 'Tipo de Pagamento', selector: row => row.payment_type, sortable: true },
        { name: 'Valor Recebido', selector: row => row.receipt_amount, sortable: true },
        { name: 'Valor Pago', selector: row => row.payment_amount, sortable: true },
        { name: 'Saldo Diário', selector: row => row.saldo_diario, sortable: true },
    ];

    return (
        <div className="container">
            <h1>Detalhes do Mês: {month}</h1>
            <DataTable
                columns={columns}
                data={data}
                pagination
            />
        </div>
    );
}

export default DetalhesMes;