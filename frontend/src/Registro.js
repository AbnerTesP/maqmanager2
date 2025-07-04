import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Estilos/Registro.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Register() {
    const [nome, setNome] = useState("");
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    function handleSubmit(event) {
        event.preventDefault();
        axios.post('http://localhost:8081/Register', { nome, email, password })
            .then(res => {
                if (res.data.message === "Usuário registrado com sucesso") {
                    navigate('/login');
                } else {
                    alert(res.data.message);
                }
            })
            .catch(err => console.log(err));
    }

    return (
        <div>
            <header className='register-header'>
                <h1>Registrar</h1>
            </header>
            <div className='register-container'>
                <div className='register-form-container'>
                    <form onSubmit={handleSubmit}>
                        <div className='form-group'>
                            <label htmlFor='text'>Nome</label>
                            <input type='text' id='nome' placeholder='Introduza o nome' className='form-control'
                                onChange={e => setNome(e.target.value)} />
                        </div>
                        <div className='form-group'>
                            <label htmlFor='email'>Email</label>
                            <input type='email' id='email' placeholder='Introduza o Email' className='form-control'
                                onChange={e => setEmail(e.target.value)} />
                        </div>
                        <div className='form-group'>
                            <label htmlFor='password'>Password</label>
                            <input type='password' id='password' placeholder='Introduza a Password' className='form-control'
                                onChange={e => setPassword(e.target.value)} />
                        </div>
                        <button className='register-button'>Registrar</button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Register;