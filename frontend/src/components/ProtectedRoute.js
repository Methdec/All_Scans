import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { API_BASE_URL } from '../utils/api';

function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
          method: "GET",
          credentials: "include",
        });
        setIsAuthenticated(response.ok);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (loading) return <div>Chargement...</div>;

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default ProtectedRoute;
