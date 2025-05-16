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
  const { token, isAuthenticated, loading, user } = useSelector(
    (state) => state.auth
  );

  const [formErrors, setFormErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    mot_de_passe: "",
  });

  useEffect(() => {
    dispatch(clearForm());
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated && user) {
      console.log("État de connexion:", { isAuthenticated, user });
      // Redirection en fonction du rôle
      if (user.role === "recruteur") {
        console.log("Redirection vers le dashboard recruteur");
        navigate("/recrutement");
      } else if (user.role === "candidat") {
        console.log("Redirection vers la page d'accueil");
        navigate("/");
      } else {
        console.error("Rôle non reconnu:", user.role);
        toast.error("Rôle utilisateur non reconnu");
      }
    }
  }, [isAuthenticated, user, navigate]);

  const validateForm = () => {
    const errors = {};
    if (!formData.email.trim()) {
      errors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "L'email est invalide";
    }
    if (!formData.mot_de_passe) {
      errors.mot_de_passe = "Le mot de passe est requis";
    } else if (formData.mot_de_passe.length < 8) {
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
      const result = await dispatch(
        loginUser({
          email: formData.email,
          mot_de_passe: formData.mot_de_passe,
        })
      ).unwrap();

      console.log("Résultat de la connexion:", result);

      if (result.user) {
        toast.success("Connexion réussie !");
      }
    } catch (error) {
      console.error("Erreur de connexion:", error);
      toast.error(error || "Erreur lors de la connexion");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Connexion
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email"
                value={formData.email}
                onChange={handleChange}
              />
              {formErrors.email && (
                <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>
              )}
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Mot de passe
              </label>
              <input
                id="password"
                name="mot_de_passe"
                type={showPassword ? "text" : "password"}
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Mot de passe"
                value={formData.mot_de_passe}
                onChange={handleChange}
              />
              {formErrors.mot_de_passe && (
                <p className="text-red-500 text-xs mt-1">
                  {formErrors.mot_de_passe}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="show-password"
                name="show-password"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
              />
              <label
                htmlFor="show-password"
                className="ml-2 block text-sm text-gray-900"
              >
                Afficher le mot de passe
              </label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              {loading ? "Connexion en cours..." : "Se connecter"}
            </button>
          </div>

          <div className="text-sm text-center">
            <Link
              to="/register"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Pas encore de compte ? S'inscrire
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
