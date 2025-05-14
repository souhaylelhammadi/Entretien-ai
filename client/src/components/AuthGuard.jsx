import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";

const AuthGuard = ({ children }) => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Vérifier d'abord si le token est valide localement
        if (!authService.isTokenValid()) {
          throw new Error("Token invalide");
        }

        // Vérifier l'authentification avec le serveur
        const isAuthenticated = await authService.checkAuth();
        if (!isAuthenticated) {
          throw new Error("Non authentifié");
        }
      } catch (error) {
        console.error("Erreur d'authentification:", error);
        authService.logout();
        navigate("/login");
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();
  }, [navigate]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return children;
};

export default AuthGuard;
