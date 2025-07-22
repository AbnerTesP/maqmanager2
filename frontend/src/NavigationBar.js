import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const NavigationBar = () => {
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Esconder navbar em login/registro
    const hideNavBar = location.pathname === '/login' || location.pathname === '/registro';
    if (hideNavBar) return null;

    return (
        <nav className="navbar navbar-expand-lg navbar-light bg-white fixed-top shadow-sm">
            <div className="container">
                <Link className="navbar-brand fw-bold" to="/">
                    MaqManager
                </Link>
                <button
                    className="navbar-toggler"
                    type="button"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-controls="navbarSupportedContent"
                    aria-expanded={isMenuOpen}
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>

                <div className={`collapse navbar-collapse${isMenuOpen ? ' show' : ''}`} id="navbarSupportedContent">
                    <ul className="navbar-nav ms-auto">
                        <li className={`nav-item${location.pathname.startsWith('/reparacoes') ? ' active' : ''}`}>
                            <Link className="nav-link" to="/reparacoes">Reparações</Link>
                        </li>
                        <li className={`nav-item${location.pathname.startsWith('/clientes') ? ' active' : ''}`}>
                            <Link className="nav-link" to="/clientes">Clientes</Link>
                        </li>
                        <li className={`nav-item${location.pathname.startsWith('/alarmes') ? ' active' : ''}`}>
                            <Link className="nav-link" to="/alarmes">Alarmes</Link>
                        </li>
                        <li className={`nav-item${location.pathname.startsWith('/notificacoes') ? ' active' : ''}`}>
                            <Link className="nav-link" to="/notificacoes">Notificações</Link>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    );
};

export default NavigationBar;