import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Estilos/Login.css';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    function handleSubmit(event) {
        event.preventDefault();
        axios.post('http://localhost:8081/Login', { email, password })
            .then(res => {
                if (res.data.message === "Login Realizado") {
                    localStorage.setItem('token', res.data.token);
                    navigate('/Home');
                } else {
                    alert(res.data.message);
                }
            })
            .catch(err => console.log(err));
    }

    return (
        <div>
            <header className='login-header'>
                <h1>Bem-vindo</h1>
            </header>
            <div className='login-container'>
                <div className='login-form-container'>
                    <form onSubmit={handleSubmit}>
                        <div className='form-group'>
                            <label htmlFor='email'>Email</label>
                            <input type='email' id='email' placeholder='Enter Email' className='form-control'
                                onChange={e => setEmail(e.target.value)} />
                        </div>
                        <div className='form-group'>
                            <label htmlFor='password'>Password</label>
                            <input type='password' id='password' placeholder='Enter Password' className='form-control'
                                onChange={e => setPassword(e.target.value)} />
                        </div>
                        <button className='login-button'>Login</button>
                    </form>
                    {/* <div className='register-link'>
                        <p>Não tem uma conta? <Link to="/Registro">Registre-se aqui</Link></p>
                    </div>*/}
                </div>
            </div>
        </div>
    );
}

export default Login;