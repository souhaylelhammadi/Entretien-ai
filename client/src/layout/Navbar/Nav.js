import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  logoutUser,
  checkAuthStatus,
  resetAuthState,
} from "../../pages/store/auth/authSlice";
import { toast } from "react-toastify";
import { Menu, X, ChevronDown, User, LogOut } from "lucide-react";
import axios from "axios";
import { BASE_URL } from "../../config";

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  // State for dropdown and mobile menu
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Vérifier la session au chargement et après rafraîchissement
  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          // Vérifier la validité du token avec le backend
          const response = await axios.get(
            `${BASE_URL}/api/auth/verify-token`,
            {
              headers: {
                Authorization: token, // Envoyer le token sans le préfixe "Bearer"
              },
            }
          );

          if (response.data.success) {
            // Utiliser l'action checkAuthStatus pour mettre à jour l'état
            dispatch(
              checkAuthStatus({
                user: response.data.user,
                token,
                isAuthenticated: true,
              })
            );
          } else {
            // Si le token n'est pas valide, réinitialiser l'état d'authentification
            dispatch(resetAuthState());
            localStorage.removeItem("token");
          }
        } catch (error) {
          console.error("Erreur de vérification du token:", error);
          dispatch(resetAuthState());
          localStorage.removeItem("token");
        }
      }
    };

    verifyToken();
  }, [dispatch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen && !event.target.closest(".profile-dropdown")) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Close dropdown and mobile menu on route change
  useEffect(() => {
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Handle logout
  const handleLogout = async () => {
    try {
      const result = await dispatch(logoutUser());
      if (logoutUser.fulfilled.match(result)) {
        // Supprimer le token du localStorage
        localStorage.removeItem("token");
        toast.success("Déconnexion réussie");
        navigate("/");
      } else {
        toast.error(result.payload || "Échec de la déconnexion");
      }
    } catch (err) {
      toast.error("Erreur lors de la déconnexion");
    }
    setIsDropdownOpen(false);
  };

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
    } else if (user?.firstName) {
      return user.firstName.charAt(0);
    } else if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  // Check if route is active
  const isRouteActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-white/80 backdrop-blur-md shadow-sm sticky w-full top-0 z-50">
      <div className="container mx-auto px-4 md:px-8 py-3">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center group">
            <span className="text-2xl font-extrabold bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent transition-all duration-300 group-hover:scale-105">
              Interview AI
            </span>
          </Link>
          

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={toggleMobileMenu}
              className="text-gray-600 hover:text-teal-600 focus:outline-none transition-all duration-200"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            {/* Accueil - visible pour tous */}
            <Link
              to="/"
              className={`relative text-base font-medium transition-all duration-200 group ${
                isRouteActive("/")
                  ? "text-teal-600"
                  : "text-gray-600 hover:text-teal-600"
              }`}
            >
              Accueil
              <span
                className={`absolute bottom-0 left-0 h-0.5 bg-teal-600 transition-all duration-300 ${
                  isRouteActive("/") ? "w-full" : "w-0 group-hover:w-full"
                }`}
              ></span>
            </Link>

            {/* Offres - visible pour les visiteurs et candidats */}
            {(!isAuthenticated || user?.role === "candidat") && (
              <Link
                to="/offres"
                className={`relative text-base font-medium transition-all duration-200 group ${
                  isRouteActive("/offres")
                    ? "text-teal-600"
                    : "text-gray-600 hover:text-teal-600"
                }`}
              >
                Offres
                <span
                  className={`absolute bottom-0 left-0 h-0.5 bg-teal-600 transition-all duration-300 ${
                    isRouteActive("/offres")
                      ? "w-full"
                      : "w-0 group-hover:w-full"
                  }`}
                ></span>
              </Link>
            )}

            {/* Mes Interviews - visible uniquement pour les candidats */}
            {isAuthenticated && user?.role === "candidat" && (
              <Link
                to="/mesinterview"
                className={`relative text-base font-medium transition-all duration-200 group ${
                  isRouteActive("/mesinterview")
                    ? "text-teal-600"
                    : "text-gray-600 hover:text-teal-600"
                }`}
              >
                Mes Interviews
                <span
                  className={`absolute bottom-0 left-0 h-0.5 bg-teal-600 transition-all duration-300 ${
                    isRouteActive("/mesinterview")
                      ? "w-full"
                      : "w-0 group-hover:w-full"
                  }`}
                ></span>
              </Link>
            )}

            {/* Dashboard - visible uniquement pour les recruteurs */}
            {isAuthenticated && user?.role === "recruteur" && (
              <Link
                to="/recrutement"
                className={`relative text-base font-medium transition-all duration-200 group ${
                  isRouteActive("/recrutement")
                    ? "text-teal-600"
                    : "text-gray-600 hover:text-teal-600"
                }`}
              >
                Dashboard
                <span
                  className={`absolute bottom-0 left-0 h-0.5 bg-teal-600 transition-all duration-300 ${
                    isRouteActive("/recrutement")
                      ? "w-full"
                      : "w-0 group-hover:w-full"
                  }`}
                ></span>
              </Link>
            )}
          </div>

          {/* Auth Section - Desktop */}
          <div className="hidden md:block">
            {isAuthenticated ? (
              <div className="relative profile-dropdown">
                <button
                  onClick={toggleDropdown}
                  className="flex items-center space-x-3 text-gray-600 hover:text-teal-600 focus:outline-none transition-all duration-200 group"
                >
                  {user?.photoUrl ? (
                    <img
                      src={user.photoUrl}
                      alt="Profile"
                      className="w-8 h-8 rounded-full object-cover border border-gray-200 group-hover:border-teal-400 transition-all"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center text-white text-sm font-medium group-hover:shadow-md transition-all">
                      {getUserInitials()}
                    </div>
                  )}
                  <span className="text-base font-medium">
                    {user?.firstName || "Profil"}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-300 ${
                      isDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-3 w-56 bg-white/95 backdrop-blur-md border border-gray-100 rounded-xl shadow-lg z-50 animate-fadeIn overflow-hidden">
                    <div className="p-3 border-b border-gray-100">
                      <div className="flex items-center space-x-3">
                        {user?.photoUrl ? (
                          <img
                            src={user.photoUrl}
                            alt="Profile"
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center text-white text-sm font-medium">
                            {getUserInitials()}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-800">
                            {user?.firstName
                              ? `${user.firstName} ${user.lastName || ""}`
                              : "Utilisateur"}
                          </p>
                          <p className="text-xs text-gray-500 truncate max-w-32">
                            {user?.email || ""}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="py-1">
                      {user?.role === "candidat" && (
                        <Link
                          to="/profile"
                          className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-teal-600 transition-all duration-200"
                        >
                          <User size={16} className="mr-2" />
                          Mon Profil
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-teal-600 transition-all duration-200"
                      >
                        <LogOut size={16} className="mr-2" />
                        Déconnexion
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-gradient-to-r from-teal-600 to-blue-600 text-white px-5 py-2 rounded-full text-base font-medium shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                Se connecter
              </Link>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 py-3 border-t border-gray-100 animate-fadeIn">
            <div className="flex flex-col space-y-2">
              {/* Accueil - visible pour tous */}
              <Link
                to="/"
                className={`py-2 text-base font-medium ${
                  isRouteActive("/") ? "text-teal-600" : "text-gray-700"
                }`}
              >
                Accueil
              </Link>

              {/* Offres - visible pour les visiteurs et candidats */}
              {(!isAuthenticated || user?.role === "candidat") && (
                <Link
                  to="/offres"
                  className={`py-2 text-base font-medium ${
                    isRouteActive("/offres") ? "text-teal-600" : "text-gray-700"
                  }`}
                >
                  Offres
                </Link>
              )}

              {/* Mes Interviews - visible uniquement pour les candidats */}
              {isAuthenticated && user?.role === "candidat" && (
                <Link
                  to="/mesinterview"
                  className={`py-2 text-base font-medium ${
                    isRouteActive("/mesinterview")
                      ? "text-teal-600"
                      : "text-gray-700"
                  }`}
                >
                  Mes Interviews
                </Link>
              )}

              {/* Dashboard - visible uniquement pour les recruteurs */}
              {isAuthenticated && user?.role === "recruteur" && (
                <Link
                  to="/recrutement"
                  className={`py-2 text-base font-medium ${
                    isRouteActive("/recrutement")
                      ? "text-teal-600"
                      : "text-gray-700"
                  }`}
                >
                  Dashboard
                </Link>
              )}

              {/* Auth options for mobile */}
              {isAuthenticated ? (
                <>
                  <div className="w-full h-px bg-gray-100 my-2"></div>
                  <div className="flex items-center space-x-3 py-2">
                    {user?.photoUrl ? (
                      <img
                        src={user.photoUrl}
                        alt="Profile"
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-500 to-blue-500 flex items-center justify-center text-white text-sm font-medium">
                        {getUserInitials()}
                      </div>
                    )}
                    <span className="text-base font-medium text-gray-800">
                      {user?.firstName
                        ? `${user.firstName} ${user.lastName || ""}`
                        : "Utilisateur"}
                    </span>
                  </div>
                  {user?.role === "candidat" && (
                    <Link
                      to="/profile"
                      className="flex items-center py-2 text-base font-medium text-gray-700"
                    >
                      <User size={16} className="mr-2" />
                      Mon Profil
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="flex items-center py-2 text-base font-medium text-gray-700"
                  >
                    <LogOut size={16} className="mr-2" />
                    Déconnexion
                  </button>
                </>
              ) : (
                <div className="pt-2">
                  <Link
                    to="/login"
                    className="inline-block bg-gradient-to-r from-teal-600 to-blue-600 text-white px-5 py-2 rounded-full text-base font-medium shadow-md transition-all duration-300"
                  >
                    Se connecter
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
