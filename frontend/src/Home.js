import React, { useEffect, useState } from 'react';
import axios from 'axios';
import DataTable from 'react-data-table-component';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';

function Home() {
    const [totals, setTotals] = useState([]);
    const navigate = useNavigate();

    const fetchTotals = () => {
        const token = localStorage.getItem('token');
        axios.get('http://localhost:8081/totals', {
            headers: {
                'Authorization': token
            }
        })
            .then(response => {
                console.log('Totals fetched:', response.data); // Log para verificar os totais recebidos
                setTotals(response.data);
            })
            .catch(error => {
                console.error('There was an error fetching the totals!', error);
            });
    };

    useEffect(() => {
        fetchTotals();// Chama a função para obter os totais
    }, []);

    const handleView = (row) => {
        navigate(`/detalhes_mes/${row.month}`);
    };

    const totalColumns = [
        {
            name: 'Ações',
            cell: row => (
                <div className='d-flex'>
                    <button onClick={() => handleView(row)} className='btn btn-primary btn-sm'>
                        <i className="bi bi-eye"></i>
                    </button>
                </div>
            ),
            ignoreRowClick: true,
        },
        { name: 'Mês', selector: row => row.month, sortable: true },
        { name: 'Total Numerário', selector: row => row.total_numerario, sortable: true },
        { name: 'Total Multibanco', selector: row => row.total_multibanco, sortable: true },
        { name: 'Total Cheques', selector: row => row.total_cheques, sortable: true },
        { name: 'Total Saída', selector: row => row.total_payment_amount, sortable: true },
        { name: 'Total de Entrada', selector: row => row.total_numerario_multibanco, sortable: true },
        { name: 'Saldo Total', selector: row => row.saldo_total, sortable: true },
    ];

    return (
        <div className="container">
            <h2>Totais Mensais</h2>
            <button className='btn btn-secondary mb-3' onClick={fetchTotals}> Atualizar Totais</button>
            <DataTable
                columns={totalColumns}
                data={totals}
                pagination
            />
        </div>
    );
}

export default Home;