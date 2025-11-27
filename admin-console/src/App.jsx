import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Terminal from './pages/Terminal';
import Logs from './pages/Logs';
import Login from './pages/Login';

import Signup from './pages/Signup';
import Users from './pages/Users';
import Runs from './pages/Runs';
import Actors from './pages/Actors';

const ProtectedRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    if (!token) {
        return <Navigate to="/login" replace />;
    }
    return <Layout>{children}</Layout>;
};

const App = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                <Route path="/" element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                } />

                <Route path="/users" element={
                    <ProtectedRoute>
                        <Users />
                    </ProtectedRoute>
                } />

                <Route path="/runs" element={
                    <ProtectedRoute>
                        <Runs />
                    </ProtectedRoute>
                } />

                <Route path="/actors" element={
                    <ProtectedRoute>
                        <Actors />
                    </ProtectedRoute>
                } />

                <Route path="/terminal" element={
                    <ProtectedRoute>
                        <Terminal />
                    </ProtectedRoute>
                } />

                <Route path="/logs" element={
                    <ProtectedRoute>
                        <Logs />
                    </ProtectedRoute>
                } />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
};

export default App;
