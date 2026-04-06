import React from 'react';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './components/theme-provider';
import { Toaster } from 'sonner';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Reparacoes from './Reparacoes/Reparacoes';
import ReparacoesRegisto from './Reparacoes/ReparacoesRegisto';
import ReparacoesEdit from './Reparacoes/ReparacoesEdit';
import ReparacoesView from './Reparacoes/ReparacoesView';
import ClientesList from "./components/ClientesList";
import AlarmesSistema from "./components/AlarmesSistema";
import CopiarArtigos from "./Reparacoes/CopiarArtigos";
import './index.css';

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="maqmanager-theme">
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/reparacoes" element={<Reparacoes />} />
          <Route path="/reparacoes/registo" element={<ReparacoesRegisto />} />
          <Route path="/reparacoes/edit/:id" element={<ReparacoesEdit />} />
          <Route path="/reparacoes/view/:id" element={<ReparacoesView />} />
          <Route path="/reparacoes/copiar" element={<CopiarArtigos />} />
          <Route path="/reparacoes/copiar/:id" element={<CopiarArtigos />} />
          <Route path="/clientes" element={<ClientesList />} />
          <Route path="/alarmes" element={<AlarmesSistema />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
      <Toaster 
        position="top-right" 
        richColors 
        closeButton
        toastOptions={{
          className: 'font-body',
        }}
      />
    </ThemeProvider>
  );
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center" data-testid="not-found">
      <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-4">
        <span className="text-3xl">404</span>
      </div>
      <h2 className="text-2xl font-heading font-bold text-foreground mb-2">Página não encontrada</h2>
      <p className="text-muted-foreground mb-6">A página que procura não existe.</p>
      <a 
        href="/" 
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
        data-testid="back-home"
      >
        Voltar ao Início
      </a>
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
