import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import Login from './Login';
import Register from './Registro';
import ProtectedRoute from './ProtectedRoute';
import CashRegister from './CashRegister';
import NavigationBar from './NavigationBar';
import 'bootstrap/dist/css/bootstrap.min.css';
import './Estilos/App.css';
import DetalhesMes from './DetalhesMes/DetalhesMes';
import EditDetalhesMes from './DetalhesMes/EditDetalhesMes';
import Home from './Home';
import Pendentes from './Pendentes';

function App() {
  const location = useLocation();
  const hideNavBar = location.pathname === '/login' || location.pathname === '/registro';

  return (
    <>
      {!hideNavBar && <NavigationBar />}
      <Routes>
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/Registro" element={<Register />} />
        <Route path="/Home" element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        } />
        <Route path="/cash_register" element={
          <ProtectedRoute>
            <CashRegister />
          </ProtectedRoute>
        } />
        <Route path="/detalhes_mes/:month" element={
          <ProtectedRoute>
            <DetalhesMes />
          </ProtectedRoute>
        } />
        <Route path="/pendentes" element={
          <ProtectedRoute>
            <Pendentes />
          </ProtectedRoute>
        } />
        <Route path="/edit_detalhes_mes/:id" element={
          <ProtectedRoute>
            <EditDetalhesMes />
          </ProtectedRoute>
        } />
      </Routes>
    </>
  );
}

function AppWrapper() {
  return (
    <Router>
      <App />
    </Router>
  )
}

export default AppWrapper;