import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import {
  loginUser,
  setEmail,
  setMotDePasse,
  clearForm,
} from "../store/auth/authSlice";
import { toast } from "react-toastify";

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token, isAuthenticated, loading } = useSelector((state) => state.auth);

  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    dispatch(clearForm());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated && token) {
      const redirectPath = localStorage.getItem('redirectAfterLogin');
      if (redirectPath) {
        localStorage.removeItem('redirectAfterLogin');
        navigate(redirectPath);
      } else {
        navigate(token.role === "recruteur" ? "/recrutement" : "/");
      }
    }
  }, [isAuthenticated, token, navigate]);

  const validateForm = () => {
    const errors = {};
    if (!token.email.trim()) {
      errors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(token.email)) {
      errors.email = "L'email est invalide";
    }
    if (!token.mot_de_passe) {
      errors.mot_de_passe = "Le mot de passe est requis";
    } else if (token.mot_de_passe.length < 8) {
      errors.mot_de_passe =
        "Le mot de passe doit contenir au moins 8 caractères";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Veuillez corriger les erreurs dans le formulaire");
      return;
    }

    try {
      console.log("Tentative de connexion avec:", { token: token.email });
      const result = await dispatch(loginUser({ email: token.email, mot_de_passe: token.mot_de_passe }));
      console.log("Résultat de la connexion:", result);

      if (result.meta.requestStatus === "fulfilled") {
        console.log("Connexion réussie, données reçues:", result.payload);
        toast.success("Connexion réussie");
        dispatch(clearForm());
      } else {
        console.error("Échec de la connexion:", result.payload);
        toast.error(result.payload || "Échec de la connexion");
      }
    } catch (err) {
      console.error("Erreur lors de la connexion:", err);
      toast.error("Échec de la connexion. Veuillez réessayer.");
    }
  };

  return (
    <section className="bg-gray-50 min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-lg shadow border border-gray-200">
        <div className="p-4 space-y-4 md:p-6 md:space-y-6">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-gray-900 md:text-2xl text-center">
            Connexion à votre compte
          </h1>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block mb-2 text-sm font-medium text-gray-900"
              >
                Adresse email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                value={token.email}
                onChange={(e) => dispatch(setEmail(e.target.value))}
                className={`bg-gray-50 border ${
                  formErrors.email ? "border-red-500" : "border-gray-300"
                } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                placeholder="nom@entreprise.com"
                required
                aria-invalid={formErrors.email ? "true" : "false"}
                aria-describedby={
                  formErrors.email ? "email-error" : undefined
                }
              />
              {formErrors.email && (
                <p id="email-error" className="mt-1 text-sm text-red-600">
                  {formErrors.email}
                </p>
              )}
            </div>

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
                  value={token.mot_de_passe}
                  onChange={(e) => dispatch(setMotDePasse(e.target.value))}
                  className={`bg-gray-50 border ${
                    formErrors.mot_de_passe ? "border-red-500" : "border-gray-300"
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
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  aria-describedby="remember-me-desc"
                />
                <label
                  htmlFor="remember-me"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Se souvenir de moi
                </label>
              </div>

              <div className="text-sm">
                <Link
                  to="/forgot-password"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Mot de passe oublié ?
                </Link>
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
                  Connexion en cours...
                </span>
              ) : (
                "Se connecter"
              )}
            </button>

            <p className="text-sm font-light text-gray-500 text-center">
              Vous n'avez pas de compte ?{" "}
              <Link
                to="/register"
                className="font-medium text-blue-600 hover:underline"
              >
                S'inscrire
              </Link>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
};

export default Login;
