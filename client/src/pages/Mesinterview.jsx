import React, { useEffect } from "react";
import {
  Building,
  MapPin,
  CheckCircle2,
  PlayCircle,
  Clock,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAcceptedOffers,
  generateInterview,
  clearError,
} from "./store/acceptedOffersSlice";
import { toast } from "react-toastify";

const statusIcons = {
  Accepté: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  "En cours": <Clock className="h-4 w-4 text-yellow-500" />,
  Terminé: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
  Annulé: <CheckCircle2 className="h-4 w-4 text-red-500" />,
};

const statusLabels = {
  Accepté: "Acceptée",
  "En cours": "En cours",
  Terminé: "Terminée",
};

const MesInterview = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { candidatures, loading, error, generatingInterview } = useSelector(
    (state) => state.acceptedOffers
  );
  const { isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }
    dispatch(fetchAcceptedOffers());
  }, [dispatch, isAuthenticated, navigate]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleInterviewAction = async (candidature) => {
    try {
      console.log(
        "Début de handleInterviewAction avec candidature:",
        candidature
      );

      if (candidature.entretien_id) {
        console.log(
          "Navigation vers l'entretien existant:",
          candidature.entretien_id
        );
        navigate(`/interview/${candidature.entretien_id}`);
      } else {
        console.log(
          "Génération d'un nouvel entretien pour la candidature:",
          candidature._id
        );
        const result = await dispatch(
          generateInterview(candidature._id)
        ).unwrap();

        console.log("Résultat de la génération:", result);

        if (result && result.entretien_id) {
          console.log(
            "Navigation vers le nouvel entretien:",
            result.entretien_id
          );
          navigate(`/interview/${result.entretien_id}`);
        } else {
          console.error("Erreur: Pas d'ID d'entretien dans le résultat");
          toast.error("Erreur lors de la génération de l'entretien");
        }
      }
    } catch (error) {
      console.error("Erreur lors de l'action d'entretien:", error);
      toast.error(error.message || "Une erreur est survenue");
    }
  };

  // Afficher l'état de chargement uniquement lors du chargement initial
  if (loading && !generatingInterview) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
          <span className="text-gray-600">Chargement des candidatures...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <CheckCircle2 className="h-12 w-12 text-red-500 mx-auto" />
          <p className="mt-2 text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b">
            <h1 className="text-2xl font-bold text-gray-800">Mes Entretiens</h1>
            <p className="text-gray-600 mt-1">
              {candidatures.length} candidature(s) acceptée(s)
            </p>
          </div>

          {candidatures.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Aucune candidature acceptée
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Aucune candidature acceptée n'est disponible pour le moment.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Poste
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entreprise
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Localisation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {candidatures.map((candidature) => (
                    <tr key={candidature._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Building className="h-5 w-5 text-gray-400 mr-2" />
                          <div>
                            <div className="font-medium text-gray-900">
                              {candidature.jobDetails?.title || "N/A"}
                            </div>
                            <div className="text-sm text-gray-500">
                              {candidature.jobDetails?.department || "N/A"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {candidature.jobDetails?.company || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                          <span>
                            {candidature.jobDetails?.location || "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-xs truncate">
                          {candidature.jobDetails?.description || "N/A"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {statusIcons[candidature.statut] ||
                            statusIcons["Accepté"]}
                          <span className="ml-2">
                            {statusLabels[candidature.statut] || "N/A"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleInterviewAction(candidature)}
                          disabled={generatingInterview}
                          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                            candidature.statut === "Accepté"
                              ? "bg-blue-600 hover:bg-blue-700"
                              : candidature.statut === "En cours"
                              ? "bg-green-600 hover:bg-green-700"
                              : "bg-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {generatingInterview ? (
                            <>
                              <Loader2 className="animate-spin h-4 w-4 mr-2" />
                              Génération...
                            </>
                          ) : (
                            <>
                              <PlayCircle className="h-4 w-4 mr-2" />
                              {candidature.statut === "Accepté"
                                ? "Passer l'entretien"
                                : "Entretien terminé"}
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MesInterview;
