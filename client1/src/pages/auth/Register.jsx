import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  registerUser,
  setRole,
  setFirstName,
  setLastName,
  setEmail,
  setPassword,
  setConfirmPassword,
  setCompanyName,
  setAcceptTerms,
  clearForm,
  resetAuthState,
} from "../store/auth/authSlice";
import { toast } from "react-toastify";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const Register = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    role,
    firstName,
    lastName,
    email,
    password,
    confirmPassword,
    companyName,
    acceptTerms,
    loading,
    authError,
    isAuthenticated,
    user,
  } = useSelector((state) => state.auth);

  const [formErrors, setFormErrors] = useState({});

  // Reset auth state when component mounts
  useEffect(() => {
    dispatch(resetAuthState());
  }, [dispatch]);

  // Redirect if authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.role === "recruteur" ? "/recrutement" : "/");
    }
  }, [isAuthenticated, user, navigate]);

  const validateForm = () => {
    const errors = {};
    let isValid = true;

    if (!firstName.trim()) {
      errors.firstName = "Le prénom est requis";
      isValid = false;
    }

    if (!lastName.trim()) {
      errors.lastName = "Le nom est requis";
      isValid = false;
    }

    if (!email.trim()) {
      errors.email = "L'email est requis";
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "L'email est invalide";
      isValid = false;
    }

    if (!password) {
      errors.password = "Le mot de passe est requis";
      isValid = false;
    } else if (password.length < 8) {
      errors.password = "Le mot de passe doit contenir au moins 8 caractères";
      isValid = false;
    } else if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      errors.password =
        "Le mot de passe doit inclure une majuscule et un chiffre";
      isValid = false;
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "Les mots de passe ne correspondent pas";
      isValid = false;
    }

    if (role === "recruteur" && !companyName.trim()) {
      errors.companyName = "Le nom de l'entreprise est requis";
      isValid = false;
    }

    if (!acceptTerms) {
      errors.acceptTerms = "Vous devez accepter les conditions";
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    let entreprise_id;
    if (role === "recruteur") {
      try {
        const response = await axios.post(`${API_URL}/api/auth/entreprise`, {
          name: companyName,
        });
        entreprise_id = response.data.entreprise_id;
        console.log("Entreprise created with ID:", entreprise_id);
      } catch (err) {
        const errorMsg =
          err.response?.data?.message || "Échec de la création de l'entreprise";
        console.error("Entreprise creation error:", errorMsg);
        setFormErrors({ server: errorMsg });
        toast.error(errorMsg);
        return;
      }
    }

    const payload = {
      firstName,
      lastName,
      email,
      password,
      acceptTerms,
      role,
      ...(role === "recruteur" && { entreprise_id }),
    };

    console.log("Registration payload:", payload);

    try {
      const result = await dispatch(registerUser(payload));
      if (result.meta.requestStatus === "fulfilled") {
        toast.success("Inscription réussie !");
        dispatch(clearForm());
      } else if (result.meta.requestStatus === "rejected") {
        const errorMsg = result.payload || "Échec de l'inscription";
        console.error("Registration error:", errorMsg);
        setFormErrors({ server: errorMsg });
        toast.error(errorMsg);
      }
    } catch (err) {
      const errorMsg =
        err.message || "Échec de l'inscription. Veuillez réessayer.";
      console.error("Registration error:", errorMsg);
      setFormErrors({ server: errorMsg });
      toast.error(errorMsg);
    }
  };

  return (
    <section className="bg-gray-50 min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-lg shadow border border-gray-200">
        <div className="p-4 space-y-4 md:p-6 md:space-y-6">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-gray-900 md:text-2xl text-center">
            Créer un compte
          </h1>

          {formErrors.server && (
            <p className="text-sm text-red-600 text-center">
              {formErrors.server}
            </p>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-900">
                Je m'inscris en tant que :
              </label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => dispatch(setRole("candidat"))}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium ${
                    role === "candidat"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                  }`}
                >
                  Candidat
                </button>
                <button
                  type="button"
                  onClick={() => dispatch(setRole("recruteur"))}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium ${
                    role === "recruteur"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                  }`}
                >
                  Recruteur
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="firstName"
                  className="block mb-2 text-sm font-medium text-gray-900"
                >
                  Prénom
                </label>
                <input
                  type="text"
                  name="firstName"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => dispatch(setFirstName(e.target.value))}
                  className={`bg-gray-50 border ${
                    formErrors.firstName ? "border-red-500" : "border-gray-300"
                  } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                  placeholder="Jean"
                  required
                  aria-invalid={formErrors.firstName ? "true" : "false"}
                  aria-describedby={
                    formErrors.firstName ? "firstName-error" : undefined
                  }
                />
                {formErrors.firstName && (
                  <p id="firstName-error" className="mt-1 text-sm text-red-600">
                    {formErrors.firstName}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="lastName"
                  className="block mb-2 text-sm font-medium text-gray-900"
                >
                  Nom
                </label>
                <input
                  type="text"
                  name="lastName"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => dispatch(setLastName(e.target.value))}
                  className={`bg-gray-50 border ${
                    formErrors.lastName ? "border-red-500" : "border-gray-300"
                  } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                  placeholder="Dupont"
                  required
                  aria-invalid={formErrors.lastName ? "true" : "false"}
                  aria-describedby={
                    formErrors.lastName ? "lastName-error" : undefined
                  }
                />
                {formErrors.lastName && (
                  <p id="lastName-error" className="mt-1 text-sm text-red-600">
                    {formErrors.lastName}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="email"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                value={email}
                onChange={(e) => dispatch(setEmail(e.target.value))}
                className={`bg-gray-50 border ${
                  formErrors.email ? "border-red-500" : "border-gray-300"
                } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                placeholder={
                  role === "recruteur"
                    ? "jean.dupont@entreprise.com"
                    : "jean.dupont@exemple.com"
                }
                required
                aria-invalid={formErrors.email ? "true" : "false"}
                aria-describedby={formErrors.email ? "email-error" : undefined}
              />
              {formErrors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600">
                  {formErrors.email}
                </p>
              )}
            </div>

            {role === "recruteur" && (
              <div>
                <label
                  htmlFor="companyName"
                  className="block mb-2 text-sm font-medium text-gray-900"
                >
                  Nom de l'entreprise
                </label>
                <input
                  type="text"
                  name="companyName"
                  id="companyName"
                  value={companyName}
                  onChange={(e) => dispatch(setCompanyName(e.target.value))}
                  className={`bg-gray-50 border ${
                    formErrors.companyName
                      ? "border-red-500"
                      : "border-gray-300"
                  } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                  placeholder="Tech Corp"
                  required
                  aria-invalid={formErrors.companyName ? "true" : "false"}
                  aria-describedby={
                    formErrors.companyName ? "companyName-error" : undefined
                  }
                />
                {formErrors.companyName && (
                  <p
                    id="companyName-error"
                    className="mt-1 text-sm text-red-600"
                  >
                    {formErrors.companyName}
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Mot de passe
              </label>
              <input
                type="password"
                name="password"
                id="password"
                value={password}
                onChange={(e) => dispatch(setPassword(e.target.value))}
                className={`bg-gray-50 border ${
                  formErrors.password ? "border-red-500" : "border-gray-300"
                } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                placeholder="••••••••"
                required
                aria-invalid={formErrors.password ? "true" : "false"}
                aria-describedby={
                  formErrors.password ? "password-error" : undefined
                }
              />
              {formErrors.password && (
                <p id="password-error" className="mt-1 text-sm text-red-600">
                  {formErrors.password}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Doit inclure une majuscule et un chiffre
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                name="confirmPassword"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => dispatch(setConfirmPassword(e.target.value))}
                className={`bg-gray-50 border ${
                  formErrors.confirmPassword
                    ? "border-red-500"
                    : "border-gray-300"
                } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                placeholder="••••••••"
                required
                aria-invalid={formErrors.confirmPassword ? "true" : "false"}
                aria-describedby={
                  formErrors.confirmPassword
                    ? "confirmPassword-error"
                    : undefined
                }
              />
              {formErrors.confirmPassword && (
                <p
                  id="confirmPassword-error"
                  className="mt-1 text-sm text-red-600"
                >
                  {formErrors.confirmPassword}
                </p>
              )}
            </div>

            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="terms"
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => dispatch(setAcceptTerms(e.target.checked))}
                  className={`w-4 h-4 rounded ${
                    formErrors.acceptTerms
                      ? "border-red-500"
                      : "border-gray-300"
                  } text-blue-600 focus:ring-blue-500`}
                  required
                  aria-invalid={formErrors.acceptTerms ? "true" : "false"}
                  aria-describedby={
                    formErrors.acceptTerms ? "terms-error" : undefined
                  }
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="terms" className="text-gray-500">
                  J'accepte les{" "}
                  <Link
                    to="/terms"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Conditions d'utilisation
                  </Link>{" "}
                  et la{" "}
                  <Link
                    to="/privacy"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    Politique de confidentialité
                  </Link>
                </label>
                {formErrors.acceptTerms && (
                  <p id="terms-error" className="mt-1 text-sm text-red-600">
                    {formErrors.acceptTerms}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center ${
                loading ? "opacity-75 cursor-not-allowed" : ""
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Création du compte...
                </span>
              ) : (
                `Créer un compte ${
                  role === "recruteur" ? "Recruteur" : "Candidat"
                }`
              )}
            </button>

            <p className="text-sm font-light text-gray-500 text-center">
              Vous avez déjà un compte ?{" "}
              <Link
                to="/login"
                className="font-medium text-blue-600 hover:underline"
              >
                Se connecter
              </Link>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Register;
