import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout, updateUser } from "../../pages/store/auth/authSlice"; // Adjust path to authSlice
import { toast } from "react-toastify";

const Navbar = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user, loading } = useSelector((state) => state.auth);

  // State for dropdown and modal
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State for edit profile form
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
  });
  const [formErrors, setFormErrors] = useState({});

  // Handle logout
  const handleLogout = () => {
    dispatch(logout());
    toast.success("Déconnexion réussie");
    navigate("/");
  };

  // Toggle dropdown
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  // Open/close modal
  const openModal = () => {
    setFormData({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
    });
    setFormErrors({});
    setIsModalOpen(true);
    setIsDropdownOpen(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    if (!formData.firstName.trim()) {
      errors.firstName = "Le prénom est requis";
    }
    if (!formData.lastName.trim()) {
      errors.lastName = "Le nom est requis";
    }
    if (!formData.email.trim()) {
      errors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "L'email est invalide";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    try {
      const result = await dispatch(
        updateUser({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
        })
      );
      if (updateUser.fulfilled.match(result)) {
        toast.success("Profil mis à jour avec succès");
        closeModal();
      } else if (updateUser.rejected.match(result)) {
        toast.error(result.payload || "Échec de la mise à jour du profil");
      }
    } catch (err) {
      toast.error("Erreur lors de la mise à jour du profil");
    }
  };

  return (
    <nav className="bg-white shadow-md fixed w-full top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <span className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-teal-500 to-blue-500 bg-clip-text text-transparent">
              Interview AI
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link
              to="/"
              className="px-2 sm:px-3 py-2 text-gray-700 hover:text-teal-500 text-sm sm:text-base transition duration-200"
            >
              Home
            </Link>
            <Link
              to="/offres"
              className="px-2 sm:px-3 py-2 text-gray-700 hover:text-teal-500 text-sm sm:text-base transition duration-200"
            >
              Offres
            </Link>
            <Link
              to="/recrutement"
              className="px-2 sm:px-3 py-2 text-gray-700 hover:text-teal-500 text-sm sm:text-base transition duration-200"
            >
              Recruteur
            </Link>
            {isAuthenticated && (
              <Link
                to="/mesinterview"
                className="px-2 sm:px-3 py-2 text-gray-700 hover:text-teal-500 text-sm sm:text-base transition duration-200"
              >
                Mes Interviews
              </Link>
            )}
          </div>

          {/* Auth Section */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={toggleDropdown}
                  className="flex items-center space-x-2 text-gray-700 hover:text-teal-500 focus:outline-none"
                >
                  <span className="text-sm sm:text-base font-medium">
                    {user?.firstName || "Profil"}
                  </span>
                  <svg
                    className="h-4 w-4 sm:h-5 sm:w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                    <div className="py-1">
                      <button
                        onClick={openModal}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Modifier le profil
                      </button>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Déconnexion
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                className="bg-gradient-to-r from-teal-500 to-blue-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium shadow hover:shadow-lg transition duration-300"
              >
                Se connecter
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                Modifier le profil
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-600 hover:text-gray-800"
              >
                <svg
                  className="h-5 w-5 sm:h-6 sm:w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="firstName"
                  className="block mb-1 text-sm font-medium text-gray-900"
                >
                  Prénom
                </label>
                <input
                  type="text"
                  name="firstName"
                  id="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className={`w-full p-2.5 border rounded-lg text-sm sm:text-base ${
                    formErrors.firstName ? "border-red-500" : "border-gray-300"
                  } focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="Jean"
                />
                {formErrors.firstName && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.firstName}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block mb-1 text-sm font-medium text-gray-900"
                >
                  Nom
                </label>
                <input
                  type="text"
                  name="lastName"
                  id="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className={`w-full p-2.5 border rounded-lg text-sm sm:text-base ${
                    formErrors.lastName ? "border-red-500" : "border-gray-300"
                  } focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="Dupont"
                />
                {formErrors.lastName && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.lastName}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block mb-1 text-sm font-medium text-gray-900"
                >
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  id="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className={`w-full p-2.5 border rounded-lg text-sm sm:text-base ${
                    formErrors.email ? "border-red-500" : "border-gray-300"
                  } focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="jean.dupont@exemple.com"
                />
                {formErrors.email && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.email}
                  </p>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base text-white bg-gradient-to-r from-teal-500 to-blue-500 rounded-lg hover:shadow-lg transition duration-300 ${
                    loading ? "opacity-75 cursor-not-allowed" : ""
                  }`}
                >
                  {loading ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
