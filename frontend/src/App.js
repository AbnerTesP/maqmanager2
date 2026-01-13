import React from 'react';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import NavigationBar from './NavigationBar';
import 'bootstrap/dist/css/bootstrap.min.css';
import Reparacoes from './Reparacoes/Reparacoes';
import ReparacoesRegisto from './Reparacoes/ReparacoesRegisto';
import ReparacoesEdit from './Reparacoes/ReparacoesEdit';
import ReparacoesView from './Reparacoes/ReparacoesView';
import ClientesList from "./components/ClientesList";
import AlarmesSistema from "./components/AlarmesSistema";
import NotificacaoAlarmes from "./components/NotificacaoAlarmes";
import './Estilos/App.css';

function App() {

  return (
    <>
      <NavigationBar />

      <Routes>
        <Route path="/" element={<Reparacoes />} />
        {/* <Route path="Home" element={<Home />} />
        <Route path="/machines" element={<RegistoMaquinas />} />
        <Route path="/pecas" element={<PecasView />} />
        <Route path="/pecas/edit/:id" element={<PecasEdit />} />
        <Route path="/festool" element={<FestoolView />} />
        <Route path="/machines/edit/:id" element={<EditMaquinas />} />*/}
        <Route path="/reparacoes" element={<Reparacoes />} />
        <Route path="/reparacoes/registo" element={<ReparacoesRegisto />} />
        <Route path="/reparacoes/edit/:id" element={<ReparacoesEdit />} />
        <Route path="/reparacoes/view/:id" element={<ReparacoesView />} />
        <Route path="/clientes" element={<ClientesList />} />
        <Route path="/alarmes" element={<AlarmesSistema />} />
        <Route path="/notificacoes" element={<NotificacaoAlarmes />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

// Componente para página não encontrada
function NotFound() {
  return (
    <div className="container mt-5 text-center">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <i className="bi bi-exclamation-triangle display-1 text-warning"></i>
              <h2 className="mt-3">Página não encontrada</h2>
              <p className="text-muted">A página que você está procurando não existe.</p>
              <a href="/" className="btn btn-primary">
                <i className="bi bi-house-door me-1"></i>
                Voltar ao Início
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  )
}

export default AppWrapper;