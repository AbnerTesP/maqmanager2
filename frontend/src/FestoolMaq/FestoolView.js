import React, { useState, useEffect } from 'react';
import axios from 'axios';
import DataTable from 'react-data-table-component';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useNavigate } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';

function FestoolView() {
    const [machines, setMachines] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchFestoolMachines();
    }, []);

    const fetchFestoolMachines = () => {
        const token = localStorage.getItem('token');
        axios.get('http://localhost:8082/machines?brand=Festool', {
            headers: {
                'Authorization': token
            }
        })
            .then(response => {
                setMachines(response.data);
            })
            .catch(error => {
                console.error('There was an error fetching the Festool machines!', error);
            });
    };

    const handleView = (row) => {
        navigate(`/detalhes_maquina/${row.id}`);
    };

    const machineColumns = [
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
        { name: 'Data', selector: row => new Date(row.date).toLocaleDateString('pt-PT'), sortable: true },
        { name: 'Tipo', selector: row => row.tipo, sortable: true },
        { name: 'Marca', selector: row => row.marca, sortable: true },
        { name: 'Modelo', selector: row => row.modelo, sortable: true },
    ];

    return (
        <div className="container mt-4">
            <h2>Máquinas Festool</h2>
            <DataTable
                columns={machineColumns}
                data={machines}
                pagination
            />
        </div>
    );
}

export default FestoolView;