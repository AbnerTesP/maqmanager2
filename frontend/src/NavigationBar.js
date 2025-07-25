import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const NavigationBar = () => {
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [totalAlarmes, setTotalAlarmes] = useState(0);

    useEffect(() => {
        const carregarTotalAlarmes = async () => {
            try {
                const response = await fetch("http://localhost:8082/alarmes/resumo");
                if (response.ok) {
                    const data = await response.json();
                    setTotalAlarmes(data.total || 0);
                }
            } catch (err) {
                setTotalAlarmes(0);
            }
        };
        carregarTotalAlarmes();
        const interval = setInterval(carregarTotalAlarmes, 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

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
                        <li className={`nav-item${location.pathname.startsWith('/alarmes') ? ' active' : ''} position-relative`}>
                            {totalAlarmes > 0 && (
                                <span
                                    style={{
                                        position: "absolute",
                                        top: "-10px",
                                        left: "90%",
                                        transform: "translateX(-50%)",
                                        background: "#dc3545",
                                        color: "#fff",
                                        borderRadius: "10px",
                                        padding: "1px 6px",
                                        fontSize: "0.60em",
                                        fontWeight: "bold",
                                        zIndex: 2,
                                        minWidth: "24px",
                                        textAlign: "center",
                                        marginTop: "5px",
                                    }}
                                >
                                    {totalAlarmes > 99 ? "99+" : totalAlarmes}
                                </span>
                            )}
                            <Link className="nav-link" to="/alarmes">Alarmes</Link>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    );
};

export default NavigationBar;