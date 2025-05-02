import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Building,
  MapPin,
  Briefcase,
  Clock,
  ArrowLeft,
  Upload,
  Send,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  LogIn,
  X,
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchOffreById,
  submitCandidature,
  resetCandidatureStatus,
} from "../store/offresEmploiSlice";
import { loginUser, registerUser } from "../store/auth/authSlice";
import { toast } from "react-toastify";

function DetailsOffreEmploi() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const {
    selectedOffre: offre,
    loading,
    error,
    candidatureStatus,
    candidatureError,
  } = useSelector((state) => state.offresEmploi);
  const { token, loading: authLoading } = useSelector((state) => state.auth);
  const [cv, setCv] = useState(null);
  const [lettreMotivation, setLettreMotivation] = useState("");
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [authData, setAuthData] = useState({
    email: "",
    mot_de_passe: "",
    nom: "",
    telephone: "",
    role: "candidat",
    acceptTerms: false,
  });

  useEffect(() => {
    console.log("Fetching offer with ID:", id);
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
      console.error("Invalid ObjectId:", id);
      toast.error("Format d'ID d'offre invalide");
      dispatch({
        type: "offresEmploi/fetchOffreById/rejected",
        payload: "Format d'ID d'offre invalide",
      });
      return;
    }
    dispatch(fetchOffreById(id));
    return () => {
      dispatch(resetCandidatureStatus());
    };
  }, [dispatch, id]);

  useEffect(() => {
    console.log("Redux state:", {
      offre,
      loading,
      error,
      candidatureStatus,
      candidatureError,
    });
    if (candidatureStatus === "success") {
      toast.success("Candidature envoyée avec succès !");
      setSubmissionSuccess(true);
      const timer = setTimeout(() => {
        navigate("/offres", {
          state: { message: "Candidature envoyée avec succès !" },
        });
      }, 2000);
      return () => clearTimeout(timer);
    } else if (candidatureStatus === "failed") {
      toast.error(candidatureError || "Échec de l'envoi de la candidature");
    }
  }, [candidatureStatus, candidatureError, navigate, error, loading, offre]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (
      file &&
      [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].includes(file.type)
    ) {
      if (file.size > 5 * 1024 * 1024 || file.size === 0) {
        toast.error(
          "Le fichier CV est invalide ou dépasse la taille maximale de 5 Mo."
        );
        return;
      }
      setCv(file);
    } else {
      toast.error("Veuillez sélectionner un fichier PDF, DOC ou DOCX.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cv || !lettreMotivation.trim()) {
      toast.error(
        "Veuillez remplir tous les champs obligatoires (CV, lettre de motivation)."
      );
      return;
    }

    console.log("Submitting candidature:", {
      offreId: id,
      cv: cv.name,
      lettreMotivation: lettreMotivation.substring(0, 50) + "...",
    });

    dispatch(
      submitCandidature({
        offreId: id,
        cv,
        lettreMotivation,
      })
    );
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await dispatch(
          loginUser({
            email: authData.email,
            mot_de_passe: authData.mot_de_passe,
          })
        );
      } else {
        await dispatch(registerUser(authData));
      }
      setShowAuthModal(false);
    } catch (error) {
      toast.error(error.message || "Une erreur est survenue");
    }
  };

  const AuthModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {isLogin ? "Connexion" : "Inscription"}
          </h2>
          <button
            onClick={() => setShowAuthModal(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleAuthSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nom complet
                </label>
                <input
                  type="text"
                  value={authData.nom}
                  onChange={(e) =>
                    setAuthData({ ...authData, nom: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={authData.telephone}
                  onChange={(e) =>
                    setAuthData({ ...authData, telephone: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={authData.email}
              onChange={(e) =>
                setAuthData({ ...authData, email: e.target.value })
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Mot de passe
            </label>
            <input
              type="password"
              value={authData.mot_de_passe}
              onChange={(e) =>
                setAuthData({ ...authData, mot_de_passe: e.target.value })
              }
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              required
            />
          </div>

          {!isLogin && (
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={authData.acceptTerms}
                onChange={(e) =>
                  setAuthData({ ...authData, acceptTerms: e.target.checked })
                }
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                required
              />
              <label className="ml-2 block text-sm text-gray-700">
                J'accepte les conditions d'utilisation
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {authLoading ? (
              <Loader2 className="animate-spin mx-auto" />
            ) : isLogin ? (
              "Se connecter"
            ) : (
              "S'inscrire"
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-indigo-600 hover:text-indigo-500"
          >
            {isLogin
              ? "Pas encore de compte ? S'inscrire"
              : "Déjà un compte ? Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white p-6 rounded-2xl shadow-lg flex items-center">
          <Loader2 className="animate-spin h-8 w-8 text-indigo-600" />
          <p className="ml-4 text-lg font-medium text-gray-800">
            Chargement de l'offre...
          </p>
        </div>
      </div>
    );
  }

  if (error || !offre) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="bg-white p-8 rounded-2xl shadow-lg text-center max-w-md">
          <AlertCircle className="text-red-500 h-16 w-16 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            {error || "Offre introuvable"}
          </h2>
          <button
            onClick={() => navigate("/offres")}
            className="bg-indigo-600 text-white py-3 px-6 rounded-xl hover:bg-indigo-700 transition-colors shadow-md"
          >
            Retour aux offres
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 to-indigo-50 min-h-screen mt-16">
      {showAuthModal && <AuthModal />}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate("/offres")}
          className="inline-flex items-center text-indigo-600 mb-4 hover:text-indigo-800 transition-colors font-medium"
        >
          <ArrowLeft className="mr-1 h-5 w-5" /> Retour aux offres
        </button>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
              <div className="bg-gradient-to-r from-indigo-600 to-blue-500 px-6 py-6 text-white">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-3 rounded-xl shadow-md">
                    <Building className="h-8 w-8 text-indigo-600" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">{offre.titre}</h1>
                    <p className="text-indigo-100">{offre.entreprise}</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-3 gap-4 mb-6 text-gray-600 bg-gray-50 p-4 rounded-xl">
                  <div className="flex flex-col items-center text-center gap-1">
                    <MapPin className="h-6 w-6 text-indigo-500" />
                    <span className="text-sm font-medium">
                      {offre.localisation}
                    </span>
                  </div>
                  <div className="flex flex-col items-center text-center gap-1">
                    <Briefcase className="h-6 w-6 text-indigo-500" />
                    <span className="text-sm font-medium">
                      {offre.valide ? "Ouverte" : "Fermée"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center text-center gap-1">
                    <Clock className="h-6 w-6 text-indigo-500" />
                    <span className="text-sm font-medium">
                      {new Date(offre.date_creation).toLocaleDateString(
                        "fr-FR"
                      )}
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-3 border-l-4 border-indigo-500 pl-3">
                      Description du poste
                    </h2>
                    <pre className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {offre.description}
                    </pre>
                  </div>

                  {offre.competences_requises?.length > 0 && (
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-3 border-l-4 border-indigo-500 pl-3">
                        Compétences requises
                      </h2>
                      <ul className="list-disc pl-6 text-gray-600 space-y-1 text-sm">
                        {offre.competences_requises.map((req, index) => (
                          <li key={index}>{req}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden sticky top-6">
              <div className="bg-gradient-to-r from-indigo-600 to-blue-500 px-6 py-4 text-white">
                <h2 className="text-xl font-semibold">
                  Postuler à cette offre
                </h2>
              </div>

              <div className="p-6">
                <button
                  className="md:hidden w-full flex items-center justify-between bg-indigo-100 text-indigo-700 p-3 rounded-xl mb-4 font-medium"
                  onClick={() => setShowApplicationForm(!showApplicationForm)}
                >
                  {showApplicationForm
                    ? "Masquer le formulaire"
                    : "Afficher le formulaire"}
                  {showApplicationForm ? <ChevronUp /> : <ChevronDown />}
                </button>

                <div
                  className={`${
                    showApplicationForm ? "block" : "hidden"
                  } md:block`}
                >
                  {!token ? (
                    <div className="text-center">
                      <LogIn className="h-10 w-10 text-indigo-500 mx-auto mb-4" />
                      <p className="text-gray-700 mb-4">
                        Vous devez être connecté pour postuler à cette offre.
                      </p>
                      <button
                        onClick={() => setShowAuthModal(true)}
                        className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-md"
                      >
                        <LogIn className="mr-2 h-5 w-5" />
                        Se connecter
                      </button>
                    </div>
                  ) : submissionSuccess ? (
                    <div className="text-center">
                      <svg
                        className="h-10 w-10 text-green-500 mx-auto mb-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <p className="text-gray-700 mb-4">
                        Candidature envoyée avec succès !
                      </p>
                      <button
                        onClick={() => navigate("/offres")}
                        className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl hover:bg-indigo-700 transition-colors shadow-md"
                      >
                        Retour aux offres
                      </button>
                    </div>
                  ) : (
                    <>
                      {candidatureError && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 flex items-center text-sm gap-2">
                          <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          <span>{candidatureError}</span>
                        </div>
                      )}

                      <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                          <label
                            htmlFor="cv-upload"
                            className="block text-sm font-medium text-gray-700 mb-2"
                          >
                            CV <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="file"
                            id="cv-upload"
                            accept=".pdf,.doc,.docx"
                            onChange={handleFileChange}
                            className="hidden"
                            required
                          />
                          <label
                            htmlFor="cv-upload"
                            className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-indigo-200 rounded-xl cursor-pointer text-gray-600 hover:bg-indigo-50 transition-colors text-sm"
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            {cv ? cv.name : "Télécharger votre CV"}
                          </label>
                          <p className="text-xs text-gray-500 mt-1">
                            Formats acceptés: PDF, DOC, DOCX (max 5 Mo)
                          </p>
                        </div>

                        <div className="mb-4">
                          <label
                            htmlFor="lettre-motivation"
                            className="block text-sm font-medium text-gray-700 mb-2"
                          >
                            Lettre de motivation{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            id="lettre-motivation"
                            value={lettreMotivation}
                            onChange={(e) =>
                              setLettreMotivation(e.target.value)
                            }
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            rows="5"
                            required
                            placeholder="Présentez-vous et expliquez votre motivation..."
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-indigo-600 text-white py-3 px-4 rounded-xl flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-md"
                          disabled={candidatureStatus === "pending"}
                        >
                          {candidatureStatus === "pending" ? (
                            <Loader2 className="animate-spin h-5 w-5 mr-2" />
                          ) : (
                            <Send className="mr-2 h-5 w-5" />
                          )}
                          {candidatureStatus === "pending"
                            ? "Envoi..."
                            : "Postuler"}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DetailsOffreEmploi;
