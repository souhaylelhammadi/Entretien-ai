import React, { useEffect } from "react";
import {
  Building,
  MapPin,
  CheckCircle2,
  PlayCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAcceptedOffers,
  updateOfferStatus,
  clearOffersError,
} from "../pages/store/acceptedOffersSlice";
import { toast } from "react-toastify";

const statusIcons = {
  accepted: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  pending_interview: <Clock className="h-4 w-4 text-yellow-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
  cancelled: <XCircle className="h-4 w-4 text-red-500" />,
};

const statusLabels = {
  accepted: "Acceptée",
  pending_interview: "En attente d'entretien",
  completed: "Terminée",
  cancelled: "Annulée",
};

const MesInterview = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { candidatures, loading, error } = useSelector(
    (state) => state.acceptedOffers
  );

  useEffect(() => {
    dispatch(fetchAcceptedOffers());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearOffersError());
    }
  }, [error, dispatch]);

  const handleStartInterview = (applicationId) => {
    navigate(`/interview/${applicationId}`);
  };

  const handleStatusChange = (applicationId, newStatus) => {
    dispatch(updateOfferStatus({ applicationId, status: newStatus }))
      .unwrap()
      .then(() => toast.success("Statut mis à jour avec succès !"))
      .catch((err) => toast.error(err));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-blue-600" viewBox="0 0 24 24">
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
            d="M4 12a8 8 0 018-8v8h8a8 8 0 01-16 0z"
          ></path>
        </svg>
        <p className="ml-2 text-gray-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-gray-800">Mes Entretiens</h1>
        <p className="text-gray-600 mt-1">
          {candidatures.length} candidature(s) acceptée(s)
        </p>
      </div>

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
                description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
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
                        {candidature.jobDetails?.departement || "N/A"}
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
                    <span>{candidature.jobDetails?.location || "N/A"}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    {candidature.jobDetails?.description || "N/A"}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {statusIcons[candidature.status] || statusIcons.accepted}
                    <span className="ml-2">
                      {statusLabels[candidature.status] || "N/A"}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex justify-end space-x-2">
                    {candidature.status === "pending_interview" && (
                      <button
                        onClick={() => handleStartInterview(candidature._id)}
                        className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                      >
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Démarrer
                      </button>
                    )}
                    {candidature.status !== "pending_interview" && (
                      <button
                        onClick={() =>
                          handleStatusChange(
                            candidature._id,
                            "pending_interview"
                          )
                        }
                        className="flex items-center px-3 py-1 bg-yellow-500 text-white rounded-md text-sm hover:bg-yellow-600"
                      >
                        <Clock className="h-4 w-4 mr-1" />
                        Planifier Entretien
                      </button>
                    )}

                    {candidature.status !== "cancelled" && (
                      <button
                        onClick={() =>
                          handleStatusChange(candidature._id, "cancelled")
                        }
                        className="flex items-center px-3 py-1 bg-red-500 text-white rounded-md text-sm hover:bg-red-600"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Annuler
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {candidatures.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            Aucune candidature acceptée
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Aucune candidature acceptée n'est disponible pour le moment.
          </p>
        </div>
      )}
    </div>
  );
};

export default MesInterview;
