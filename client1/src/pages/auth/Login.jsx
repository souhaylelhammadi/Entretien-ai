import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  loginUser,
  setEmail,
  setPassword,
  clearForm,
} from "../store/auth/authSlice";
import { toast } from "react-toastify";

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { email, password, loading, authError, isAuthenticated, user } =
    useSelector((state) => state.auth);

  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    dispatch(clearForm());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated && user) {
      const redirectTo =
        location.state?.from?.pathname ||
        (user.role === "recruteur" ? "/recrutement" : "/");
      console.log("Redirecting to:", redirectTo, "Role:", user.role);
      navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, user, navigate, location]);

  const validateForm = () => {
    const errors = {};
    if (!email.trim()) {
      errors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = "L'email est invalide";
    }
    if (!password) {
      errors.password = "Le mot de passe est requis";
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
      console.log("Attempting login with:", { email });
      const result = await dispatch(loginUser({ email, password }));
      console.log("Login result:", result);
      if (loginUser.fulfilled.match(result)) {
        toast.success("Connexion réussie");
        dispatch(clearForm());
      } else if (loginUser.rejected.match(result)) {
        toast.error(result.payload || "Échec de la connexion");
      }
    } catch (err) {
      console.error("Login error:", err);
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

          {authError && (
            <p className="text-sm text-red-600 text-center">{authError}</p>
          )}

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
                value={email}
                onChange={(e) => dispatch(setEmail(e.target.value))}
                className={`bg-gray-50 border ${
                  formErrors.email || authError
                    ? "border-red-500"
                    : "border-gray-300"
                } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                placeholder="nom@entreprise.com"
                required
                aria-invalid={formErrors.email || authError ? "true" : "false"}
                aria-describedby={
                  formErrors.email
                    ? "email-error"
                    : authError
                    ? "server-error"
                    : undefined
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
                  formErrors.password || authError
                    ? "border-red-500"
                    : "border-gray-300"
                } text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5`}
                placeholder="••••••••"
                required
                aria-invalid={
                  formErrors.password || authError ? "true" : "false"
                }
                aria-describedby={
                  formErrors.password
                    ? "password-error"
                    : authError
                    ? "server-error"
                    : undefined
                }
              />
              {formErrors.password && (
                <p id="password-error" className="mt-1 text-sm text-red-600">
                  {formErrors.password}
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
