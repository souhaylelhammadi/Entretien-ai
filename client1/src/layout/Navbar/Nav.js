import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../pages/store/auth/authSlice"; // Adjust path to your authSlice

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate("/");
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="bg-white shadow-md fixed w-full top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <span className="text-2xl font-bold bg-gradient-to-r from-teal-500 to-blue-500 bg-clip-text text-transparent">
              Interview AI
            </span>
          </Link>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMenu}
              className="text-gray-600 hover:text-teal-500 focus:outline-none"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center">
            <div className="flex space-x-4">
              <Link
                to="/"
                className="px-3 py-2 text-gray-700 hover:text-teal-500 transition duration-200"
              >
                Home
              </Link>
              <Link
                to="/offres"
                className="px-3 py-2 text-gray-700 hover:text-teal-500 transition duration-200"
              >
                Offres
              </Link>
              <Link
                to="/recrutement"
                className="px-3 py-2 text-gray-700 hover:text-teal-500 transition duration-200"
              >
                Recruteur
              </Link>
              <Link
                to="/mesinterview"
                className="px-3 py-2 text-gray-700 hover:text-teal-500 transition duration-200"
              >
                Mes Interviews
              </Link>
            </div>
          </div>

          {/* Auth Buttons Desktop */}
          <div className="hidden md:block">
            {isAuthenticated ? (
              <div className="flex items-center space-x-4">
                {user && (
                  <span className="text-gray-700 font-medium">
                    Bienvenue, {user.firstName || user.email || "Utilisateur"}
                  </span>
                )}
                <button
                  onClick={handleLogout}
                  className="bg-gradient-to-r from-teal-500 to-blue-500 text-white px-4 py-2 rounded-lg font-medium shadow hover:shadow-lg transition duration-300"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-gradient-to-r from-teal-500 to-blue-500 text-white px-4 py-2 rounded-lg font-medium shadow hover:shadow-lg transition duration-300"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              to="/"
              className="block px-3 py-2 text-gray-700 hover:bg-gradient-to-r hover:from-teal-500 hover:to-blue-500 hover:text-white rounded-lg transition duration-200"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            <Link
              to="/offres"
              className="block px-3 py-2 text-gray-700 hover:bg-gradient-to-r hover:from-teal-500 hover:to-blue-500 hover:text-white rounded-lg transition duration-200"
              onClick={() => setIsMenuOpen(false)}
            >
              Offres
            </Link>
            <Link
              to="/recrutement"
              className="block px-3 py-2 text-gray-700 hover:bg-gradient-to-r hover:from-teal-500 hover:to-blue-500 hover:text-white rounded-lg transition duration-200"
              onClick={() => setIsMenuOpen(false)}
            >
              Recruteur
            </Link>
            <Link
              to="/mesinterview"
              className="block px-3 py-2 text-gray-700 hover:bg-gradient-to-r hover:from-teal-500 hover:to-blue-500 hover:text-white rounded-lg transition duration-200"
              onClick={() => setIsMenuOpen(false)}
            >
              Mes Interviews
            </Link>

            {/* Auth Mobile */}
            <div className="pt-4 pb-2">
              {isAuthenticated ? (
                <div className="space-y-2">
                  {user && (
                    <p className="px-3 text-gray-700 font-medium">
                      Bienvenue, {user.firstName || user.email || "Utilisateur"}
                    </p>
                  )}
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-white bg-gradient-to-r from-teal-500 to-blue-500 rounded-lg font-medium"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="block px-3 py-2 text-white bg-gradient-to-r from-teal-500 to-blue-500 rounded-lg font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
