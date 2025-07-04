import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Estilos/NavigationBar.css';

function NavigationBar() {
    const location = useLocation();
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    // Verifica se a rota atual é a página de login ou registro
    const hideNavBar = location.pathname === '/login' || location.pathname === '/registro';

    if (hideNavBar) {
        return null;
    }

    return (
        <nav className="navbar navbar-expand-lg navbar-light bg-light fixed-top">
            <Link className="navbar-brand" to="/home">Registo de Caixa</Link>
            <button className="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span className="navbar-toggler-icon"></span>
            </button>
            <div className="collapse navbar-collapse" id="navbarNav">
                <ul className="navbar-nav mr-auto">
                    <li className="nav-item">
                        <Link className="nav-link nav-link-1" to="/home">Home</Link>
                    </li>
                    <li className="nav-item">
                        <Link className="nav-link nav-link-2" to="/pendentes">Pendentes</Link>
                    </li>
                    <li className="nav-item">
                        <Link className="nav-link nav-link-3" to="/cash_register">Registo de Caixa</Link>
                    </li>
                </ul>
                <ul className="navbar-nav">
                    <li className="nav-item logout">
                        <button className="nav-link btn btn-link logout-btn" onClick={handleLogout}>Logout</button>
                    </li>
                </ul>
            </div>
        </nav>
    );
}

export default NavigationBar;