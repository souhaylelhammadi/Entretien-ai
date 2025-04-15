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
} from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchOffreById,
  submitCandidature,
  resetCandidatureStatus,
} from "../store/offresEmploiSlice";

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
  const [cv, setCv] = useState(null);
  const [lettreMotivation, setLettreMotivation] = useState("");
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  useEffect(() => {
    dispatch(fetchOffreById(id));
    return () => {
      dispatch(resetCandidatureStatus());
    };
  }, [dispatch, id]);

  useEffect(() => {
    if (candidatureStatus === "success") {
      navigate("/offres", {
        state: { message: "Candidature envoyée avec succès !" },
      });
    }
  }, [candidatureStatus, navigate]);

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
      if (file.size > 5 * 1024 * 1024) {
        alert("Le fichier CV ne doit pas dépasser 5 Mo.");
        return;
      }
      setCv(file);
    } else {
      alert("Veuillez sélectionner un fichier PDF, DOC ou DOCX.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cv || !lettreMotivation.trim()) {
      alert(
        "Veuillez remplir tous les champs obligatoires (CV, lettre de motivation)."
      );
      return;
    }

    dispatch(
      submitCandidature({
        offreId: id,
        cv,
        lettreMotivation,
      })
    );
  };

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
            onClick={() => navigate("/offres-emploi")}
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
      <div className="max-w-6xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate("/offres-emploi")}
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
                      {new Date(offre.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-3 border-l-4 border-indigo-500 pl-3">
                      Description du poste
                    </h2>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {offre.description}
                    </p>
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
                        onChange={(e) => setLettreMotivation(e.target.value)}
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
