import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  registerUser,
  setRole,
  setNom,
  setEmail,
  setMotDePasse,
  setConfirmMotDePasse,
  setTelephone,
  setNomEntreprise,
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
    nom,
    email,
    mot_de_passe,
    confirmMotDePasse,
    telephone,
    nomEntreprise,
    acceptTerms,
    loading,
    isAuthenticated,
    user,
  } = useSelector((state) => state.auth);

  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    dispatch(resetAuthState());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "recruteur") {
        navigate("/recrutement");
      } else if (user.role === "candidat") {
        navigate("/");
      }
    }
  }, [isAuthenticated, user, navigate]);

  const validateForm = () => {
    const errors = {};
    let isValid = true;

    if (!nom.trim()) {
      errors.nom = "Le nom est requis";
      isValid = false;
    }

    if (!email.trim()) {
      errors.email = "L'email est requis";
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "L'email est invalide";
      isValid = false;
    }

    if (!telephone.trim()) {
      errors.telephone = "Le téléphone est requis";
      isValid = false;
    } else if (!/^\d{10}$/.test(telephone)) {
      errors.telephone = "Le numéro de téléphone doit contenir 10 chiffres";
      isValid = false;
    }

    if (!mot_de_passe) {
      errors.mot_de_passe = "Le mot de passe est requis";
      isValid = false;
    } else if (mot_de_passe.length < 8) {
      errors.mot_de_passe =
        "Le mot de passe doit contenir au moins 8 caractères";
      isValid = false;
    } else if (!/[A-Z]/.test(mot_de_passe) || !/[0-9]/.test(mot_de_passe)) {
      errors.mot_de_passe =
        "Le mot de passe doit inclure une majuscule et un chiffre";
      isValid = false;
    }

    if (mot_de_passe !== confirmMotDePasse) {
      errors.confirmMotDePasse = "Les mots de passe ne correspondent pas";
      isValid = false;
    }

    if (role === "recruteur" && !nomEntreprise.trim()) {
      errors.nomEntreprise =
        "Le nom de l'entreprise est requis pour les recruteurs";
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
      toast.error("Veuillez corriger les erreurs dans le formulaire");
      return;
    }

    const payload = {
      nom,
      email,
      mot_de_passe,
      telephone,
      acceptTerms,
      role,
      ...(role === "recruteur" && { nomEntreprise }),
    };

    console.log("Payload d'inscription:", payload);

    try {
      const result = await dispatch(registerUser(payload));
      if (result.meta.requestStatus === "fulfilled") {
        toast.success("Inscription réussie !");
        dispatch(clearForm());
      } else {
        const errorMsg = result.payload || "Échec de l'inscription";
        console.error("Erreur d'inscription:", errorMsg);
        setFormErrors({ server: errorMsg });
        toast.error(errorMsg);
      }
    } catch (err) {
      const errorMsg =
        err.message || "Échec de l'inscription. Veuillez réessayer.";
      console.error("Erreur d'inscription:", errorMsg);
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
              {role === "recruteur" && (
                <p className="mt-2 text-xs text-blue-600">
                  En tant que recruteur, vous devez fournir les informations de
                  votre entreprise.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="nom"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Nom complet
              </label>
              <input
                type="text"
                name="nom"
                id="nom"
                value={nom}
                onChange={(e) => dispatch(setNom(e.target.value))}
                className={`bg-gray-50 border ${
                  formErrors.nom ? "border-red-500" : "border-gray-300"
                } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                placeholder="Jean Dupont"
                required
                aria-invalid={formErrors.nom ? "true" : "false"}
                aria-describedby={formErrors.nom ? "nom-error" : undefined}
              />
              {formErrors.nom && (
                <p id="nom-error" className="mt-1 text-sm text-red-600">
                  {formErrors.nom}
                </p>
              )}
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

            <div>
              <label
                htmlFor="telephone"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Téléphone
              </label>
              <input
                type="tel"
                name="telephone"
                id="telephone"
                value={telephone}
                onChange={(e) => dispatch(setTelephone(e.target.value))}
                className={`bg-gray-50 border ${
                  formErrors.telephone ? "border-red-500" : "border-gray-300"
                } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                placeholder="0123456789"
                required
                aria-invalid={formErrors.telephone ? "true" : "false"}
                aria-describedby={
                  formErrors.telephone ? "telephone-error" : undefined
                }
              />
              {formErrors.telephone && (
                <p id="telephone-error" className="mt-1 text-sm text-red-600">
                  {formErrors.telephone}
                </p>
              )}
            </div>

            {role === "recruteur" && (
              <div>
                <label
                  htmlFor="nomEntreprise"
                  className="block mb-2 text-sm font-medium text-gray-900"
                >
                  Nom de l'entreprise <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nomEntreprise"
                  id="nomEntreprise"
                  value={nomEntreprise}
                  onChange={(e) => dispatch(setNomEntreprise(e.target.value))}
                  className={`bg-gray-50 border ${
                    formErrors.nomEntreprise
                      ? "border-red-500"
                      : "border-gray-300"
                  } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                  placeholder="Nom de votre entreprise"
                  required
                  aria-invalid={formErrors.nomEntreprise ? "true" : "false"}
                  aria-describedby={
                    formErrors.nomEntreprise ? "nomEntreprise-error" : undefined
                  }
                />
                {formErrors.nomEntreprise && (
                  <p
                    id="nomEntreprise-error"
                    className="mt-1 text-sm text-red-600"
                  >
                    {formErrors.nomEntreprise}
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="mot_de_passe"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="mot_de_passe"
                  id="mot_de_passe"
                  value={mot_de_passe}
                  onChange={(e) => dispatch(setMotDePasse(e.target.value))}
                  className={`bg-gray-50 border ${
                    formErrors.mot_de_passe
                      ? "border-red-500"
                      : "border-gray-300"
                  } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                  placeholder="••••••••"
                  required
                  aria-invalid={formErrors.mot_de_passe ? "true" : "false"}
                  aria-describedby={
                    formErrors.mot_de_passe ? "mot_de_passe-error" : undefined
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  {showPassword ? (
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {formErrors.mot_de_passe && (
                <p
                  id="mot_de_passe-error"
                  className="mt-1 text-sm text-red-600"
                >
                  {formErrors.mot_de_passe}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Doit inclure une majuscule et un chiffre
              </p>
            </div>

            <div>
              <label
                htmlFor="confirmMotDePasse"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmMotDePasse"
                  id="confirmMotDePasse"
                  value={confirmMotDePasse}
                  onChange={(e) =>
                    dispatch(setConfirmMotDePasse(e.target.value))
                  }
                  className={`bg-gray-50 border ${
                    formErrors.confirmMotDePasse
                      ? "border-red-500"
                      : "border-gray-300"
                  } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                  placeholder="••••••••"
                  required
                  aria-invalid={formErrors.confirmMotDePasse ? "true" : "false"}
                  aria-describedby={
                    formErrors.confirmMotDePasse
                      ? "confirmMotDePasse-error"
                      : undefined
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  {showConfirmPassword ? (
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-5 w-5 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
              {formErrors.confirmMotDePasse && (
                <p
                  id="confirmMotDePasse-error"
                  className="mt-1 text-sm text-red-600"
                >
                  {formErrors.confirmMotDePasse}
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
