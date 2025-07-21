import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

function PecasEdit() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState({
        tipopeca: '',
        marca: '',
        modelo_maquina: ''
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await axios.get(`http://localhost:8082/pecas/${id}`);
                setData(response.data);
                setLoading(false);
            } catch (error) {
                setError('Houve um erro ao buscar a peça!');
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.put(`http://localhost:8082/pecas/${id}`, data);
            alert(response.data.message);
            navigate('/pecas');
        } catch (error) {
            console.error('Erro ao atualizar a peça:', error.response ? error.response.data : error.message);
            setError('Houve um erro ao atualizar a peça!');
        }
    };

    if (loading) {
        return <div>Carregando...</div>;
    }

    if (error) {
        return <div>{error}</div>;
    }

    return (
        <div className="container mt-4">
            <h2>Editar Peça</h2>
            <form onSubmit={handleSubmit} className="shadow p-4 rounded bg-white">
                <div className="form-group">
                    <label htmlFor="tipopeca" className="form-label">Tipo de Peça</label>
                    <input
                        type="text"
                        id="tipopeca"
                        name="tipopeca"
                        className="form-control"
                        value={data.tipopeca}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="marca" className="form-label">Marca</label>
                    <input
                        type="text"
                        id="marca"
                        name="marca"
                        className="form-control"
                        value={data.marca}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="modelo_maquina" className="form-label">Modelo da Máquina</label>
                    <input
                        type="text"
                        id="modelo_maquina"
                        name="modelo_maquina"
                        className="form-control"
                        value={data.modelo_maquina}
                        onChange={handleChange}
                    />
                </div>
                <button type="submit" className="btn btn-primary btn-block">Salvar</button>
            </form>
        </div>
    );
}

export default PecasEdit;