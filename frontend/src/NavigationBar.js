import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';

// Configuração da API (Idealmente mover para um arquivo .env)
const API_URL = "http://localhost:8082/alarmes/resumo";

// --- Hook Personalizado para Gerir Alarmes ---
const useAlarmes = () => {
    const [total, setTotal] = useState(0);

    const fetchAlarmes = useCallback(async () => {
        try {
            const response = await fetch(API_URL);
            if (response.ok) {
                const data = await response.json();
                setTotal(data.total || 0);
            }
        } catch (err) {
            console.error("Erro ao buscar alarmes:", err);
            // Não zeramos o total em caso de erro de rede momentâneo para evitar "piscar"
        }
    }, []);

    useEffect(() => {
        fetchAlarmes();
        const interval = setInterval(fetchAlarmes, 120000); // 2 minutos
        return () => clearInterval(interval);
    }, [fetchAlarmes]);

    return total;
};

// --- Sub-componente para Links da Navbar ---
const NavItem = ({ to, children, isActive }) => (
    <li className={`nav-item ${isActive ? 'active fw-bold' : ''}`}>
        <Link className="nav-link" to={to}>
            {children}
        </Link>
    </li>
);

const NavigationBar = () => {
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Usa o hook personalizado
    const totalAlarmes = useAlarmes();

    const badgeRef = useRef(null);
    const prevTotalRef = useRef(totalAlarmes);

    // Lógica de Animação
    useEffect(() => {
        // Só anima se o valor mudou e se o novo valor é maior que 0
        if (prevTotalRef.current !== totalAlarmes && totalAlarmes > 0 && badgeRef.current) {
            import('animejs').then((mod) => {
                const anime = mod.default || mod;
                anime({
                    targets: badgeRef.current,
                    scale: [1, 1.5, 1], // Efeito de "pulso"
                    duration: 600,
                    easing: 'easeOutElastic(1, .5)',
                });
            }).catch(e => console.warn("AnimeJS não carregou", e));
        }
        prevTotalRef.current = totalAlarmes;
    }, [totalAlarmes]);

    // Rotas onde a navbar não deve aparecer
    const hideNavBar = ['/login', '/registro'].includes(location.pathname);
    if (hideNavBar) return null;

    return (
        <nav className="navbar navbar-expand-lg navbar-light bg-white fixed-top shadow-sm py-3">
            <div className="container">
                <Link className="navbar-brand fw-bold text-primary" to="/" style={{ letterSpacing: '-0.5px' }}>
                    <i className="bi bi-grid-3x3-gap-fill me-2"></i>
                    MaqManager
                </Link>

                <button
                    className="navbar-toggler border-0 focus-ring focus-ring-light"
                    type="button"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-expanded={isMenuOpen}
                    aria-label="Alternar navegação"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>

                <div className={`collapse navbar-collapse ${isMenuOpen ? 'show' : ''}`}>
                    <ul className="navbar-nav ms-auto align-items-center gap-lg-3">

                        <NavItem to="/reparacoes" isActive={location.pathname.startsWith('/reparacoes')}>
                            Reparações
                        </NavItem>

                        <NavItem to="/clientes" isActive={location.pathname.startsWith('/clientes')}>
                            Clientes
                        </NavItem>

                        {/* Item de Alarmes com Badge */}
                        <li className={`nav-item position-relative ${location.pathname.startsWith('/alarmes') ? 'active fw-bold' : ''}`}>
                            <Link className="nav-link d-flex align-items-center" to="/alarmes">
                                Alarmes
                                {totalAlarmes > 0 && (
                                    <span
                                        ref={badgeRef}
                                        className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-white"
                                        style={{ fontSize: '0.65rem', padding: '0.35em 0.6em' }}
                                    >
                                        {totalAlarmes > 99 ? '99+' : totalAlarmes}
                                        <span className="visually-hidden">novos alarmes</span>
                                    </span>
                                )}
                            </Link>
                        </li>

                    </ul>
                </div>
            </div>
        </nav>
    );
};

export default NavigationBar;