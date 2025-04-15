import React, { useEffect } from "react";
import {
  Building,
  MapPin,
  Calendar,
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

const statusIcons = {
  pending_interview: <Clock className="h-4 w-4 text-yellow-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  cancelled: <XCircle className="h-4 w-4 text-red-500" />,
};

const statusLabels = {
  pending_interview: "En attente",
  completed: "Terminé",
  cancelled: "Annulé",
};

const MesInterview = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { offers, loading, error } = useSelector(
    (state) => state.acceptedOffers
  );

  useEffect(() => {
    // Fetch all accepted offers without user context
    dispatch(fetchAcceptedOffers());
  }, [dispatch]);

  const handleStartInterview = (offerId) => {
    navigate(`/interview`);
  };

  const handleStatusChange = (offerId, newStatus) => {
    dispatch(updateOfferStatus({ offerId, status: newStatus }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => dispatch(clearOffersError())}
          className="ml-2 text-blue-500"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-gray-800">Mes Entretiens</h1>
        <p className="text-gray-600 mt-1">
          {offers.length} offre(s) acceptée(s)
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
                Compétences
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
            {offers.map((offer) => (
              <tr key={offer._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Building className="h-5 w-5 text-gray-400 mr-2" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {offer.jobDetails?.title || "N/A"}
                      </div>
                      <div className="text-sm text-gray-500">
                        {offer.jobDetails?.department || "N/A"}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {offer.jobDetails?.company || "N/A"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                    <span>{offer.jobDetails?.location || "N/A"}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    {(offer.jobDetails?.requirements || []).map((skill, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {statusIcons[offer.status]}
                    <span className="ml-2">{statusLabels[offer.status]}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex justify-end space-x-2">
                    {offer.status === "pending_interview" && (
                      <button
                        onClick={() => handleStartInterview(offer._id)}
                        className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                      >
                        <PlayCircle className="h-4 w-4 mr-1" />
                        Démarrer
                      </button>
                    )}
                    
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {offers.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 className="h-12 w-12 text-gray-400 mx-auto" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            Aucune offre acceptée
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Aucune offre acceptée n'est disponible pour le moment.
          </p>
        </div>
      )}
    </div>
  );
};

export default MesInterview;
