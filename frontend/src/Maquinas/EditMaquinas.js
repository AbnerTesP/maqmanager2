import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

function EditMaquinas() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        date: '',
        tipo: '',
        marca: '',
        modelo: '',
        file: null
    });
    const [files, setFiles] = useState([]);
    const [deletedFiles, setDeletedFiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchMachineData = async () => {
            try {
                const machineResponse = await axios.get(`http://localhost:8082/machines/${id}`);
                const { date, tipo, marca, modelo } = machineResponse.data;
                setFormData({
                    date: new Date(date).toISOString().split('T')[0], // Formatar a data corretamente
                    tipo,
                    marca,
                    modelo,
                    file: null
                });

                const filesResponse = await axios.get(`http://localhost:8082/machines/${id}/files`);
                setFiles(filesResponse.data);
                setLoading(false);
            } catch (error) {
                setError('Erro ao buscar os dados da máquina');
                setLoading(false);
            }
        };

        fetchMachineData();
    }, [id]);

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: files ? files[0] : value
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        const data = new FormData();
        data.append('date', formData.date);
        data.append('tipo', formData.tipo);
        data.append('marca', formData.marca);
        data.append('modelo', formData.modelo);
        if (formData.file) {
            data.append('file', formData.file);
        }

        try {
            // Delete old files if any
            for (const deletedFile of deletedFiles) {
                await axios.delete(`http://localhost:8082/files/${deletedFile.id}`);
            }

            const response = await axios.put(`http://localhost:8082/machines/${id}`, data, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            alert(response.data.message);
            navigate('/');
        } catch (error) {
            setError('Erro ao atualizar a máquina');
        }
    };

    const handleDeleteFile = (fileId) => {
        const fileToDelete = files.find(file => file.id === fileId);
        setDeletedFiles([...deletedFiles, fileToDelete]);
        setFiles(files.filter(file => file.id !== fileId));
    };

    if (loading) {
        return <div>Carregando...</div>;
    }

    if (error) {
        return <div>{error}</div>;
    }

    return (
        <div className="container mt-4">
            <h2>Editar Máquina</h2>
            <form onSubmit={handleSubmit} className="shadow p-4 rounded bg-white">
                <div className="form-group">
                    <label htmlFor="date" className="form-label">Data</label>
                    <input type="date" id="date" name="date" className="form-control" value={formData.date} onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label htmlFor="tipo" className="form-label">Tipo</label>
                    <input type="text" id="tipo" name="tipo" className="form-control" value={formData.tipo} onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label htmlFor="marca" className="form-label">Marca</label>
                    <input type="text" id="marca" name="marca" className="form-control" value={formData.marca} onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label htmlFor="modelo" className="form-label">Modelo</label>
                    <input type="text" id="modelo" name="modelo" className="form-control" value={formData.modelo} onChange={handleChange} />
                </div>
                <div className="form-group">
                    <label htmlFor="file" className="form-label">Guia de Montagem</label>
                    <input type="file" id="file" name="file" className="form-control" onChange={handleChange} />
                </div>
                <button type="submit" className="btn btn-primary btn-block">Atualizar</button>
            </form>
            <h3 className="mt-4">Arquivos</h3>
            <ul className="list-group">
                {files.map(file => (
                    <li key={file.id} className="list-group-item d-flex justify-content-between align-items-center">
                        <a href={`http://localhost:8082/uploads/${file.nome}`} target="_blank" rel="noopener noreferrer">{file.nome}</a>
                        <button onClick={() => handleDeleteFile(file.id)} className="btn btn-danger btn-sm">Excluir</button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default EditMaquinas;