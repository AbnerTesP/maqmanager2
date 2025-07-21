import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

function PecasView() {
    const { maquinas_id } = useParams();
    const [tipopeca, setTipopeca] = useState('');
    const [marca, setMarca] = useState('');
    const [pecas, setPecas] = useState([]);

    const fetchPecas = () => {
        axios.get(`http://localhost:8082/pecas/${maquinas_id}`)
            .then(response => {
                setPecas(response.data);
            })
            .catch(error => {
                console.error('There was an error fetching the parts!', error);
            });
    };

    useEffect(() => {
        fetchPecas();
    }, [maquinas_id]);

    const handleSubmit = (event) => {
        event.preventDefault();
        const data = {
            tipopeca,
            marca,
            maquinas_id
        };
        console.log('Enviando dados:', data); // Adicione este log para verificar os dados enviados
        axios.post('http://localhost:8082/pecas', data)
            .then(res => {
                alert(res.data.message);
                fetchPecas();
            })
            .catch(err => {
                console.log('Erro ao criar peça:', err); // Adicione este log para verificar o erro
            });
    };

    return (
        <div className="container">
            <h2>Peças da Máquina</h2>
            <form onSubmit={handleSubmit} className="shadow p-4 rounded bg-white">
                <div className="form-group">
                    <label htmlFor="tipopeca" className="form-label">Tipo de Peça</label>
                    <input type="text" id="tipopeca" className="form-control" value={tipopeca} onChange={e => setTipopeca(e.target.value)} />
                </div>
                <div className="form-group">
                    <label htmlFor="marca" className="form-label">Marca</label>
                    <input type="text" id="marca" className="form-control" value={marca} onChange={e => setMarca(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary btn-block">Inserir Peça</button>
            </form>
            <h3 className="mt-4">Lista de Peças</h3>
            <ul className="list-group">
                {pecas.map(peca => (
                    <li key={peca.id} className="list-group-item">
                        {peca.tipopeca} - {peca.marca}
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default PecasView;