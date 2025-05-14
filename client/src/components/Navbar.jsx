import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../services/authService";
import { toast } from "react-toastify";

const Navbar = () => {
  const navigate = useNavigate();
  const user = authService.getUserData();
  const isAuthenticated = authService.isTokenValid();

  const handleLogout = () => {
    authService.logout();
    toast.success("Déconnexion réussie");
    navigate("/login");
  };

  const renderNavLinks = () => {
    if (!isAuthenticated || !user) return null;

    switch (user.role) {
      case "recruteur":
        return (
          <>
            <Link
              to="/recruteur/dashboard"
              className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              Tableau de bord
            </Link>
            <Link
              to="/recruteur/candidates"
              className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              Candidats
            </Link>
            <Link
              to="/recruteur/offres"
              className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              Offres
            </Link>
            <Link
              to="/recruteur/entretiens"
              className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              Entretiens
            </Link>
          </>
        );
      case "candidat":
        return (
          <>
            <Link
              to="/candidat/dashboard"
              className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              Tableau de bord
            </Link>
            <Link
              to="/candidat/candidatures"
              className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              Mes candidatures
            </Link>
          </>
        );
      case "admin":
        return (
          <>
            <Link
              to="/admin/dashboard"
              className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              Tableau de bord
            </Link>
            <Link
              to="/admin/users"
              className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              Utilisateurs
            </Link>
            <Link
              to="/admin/roles"
              className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
            >
              Rôles
            </Link>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-xl font-bold text-indigo-600">
                InterviewAI
              </Link>
            </div>
            {isAuthenticated && (
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {renderNavLinks()}
              </div>
            )}
          </div>
          <div className="flex items-center">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                <Link
                  to={`/${user.role}/profile`}
                  className="text-gray-700 hover:text-gray-900"
                >
                  {user.prenom} {user.nom}
                </Link>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Déconnexion
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Connexion
                </Link>
                <Link
                  to="/register"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Inscription
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
