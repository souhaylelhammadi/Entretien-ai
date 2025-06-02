import React, { useEffect, useState } from "react";
import {
  Building,
  MapPin,
  CheckCircle2,
  PlayCircle,
  Clock,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchAcceptedOffers,
  generateInterview,
  clearError,
} from "./store/acceptedOffersSlice";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
} from "@mui/material";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const statusIcons = {
  Accepté: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  "En attente": <Clock className="h-4 w-4 text-yellow-500" />,
  Terminé: <CheckCircle2 className="h-4 w-4 text-blue-500" />,
  Annulé: <CheckCircle2 className="h-4 w-4 text-red-500" />,
};

const statusLabels = {
  Accepté: "Acceptée",
  "En attente": "En attente",
  Terminé: "Terminée",
};

const MesInterview = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { candidatures, loading, error } = useSelector(
    (state) => state.acceptedOffers
  );
  const { isAuthenticated, token } = useSelector((state) => state.auth);
  const [messages, setMessages] = useState({});
  const [loadingMessages, setLoadingMessages] = useState({});
  const [openMessageDialog, setOpenMessageDialog] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState(null);

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

  const fetchMessages = async (entretienId) => {
    if (!entretienId) return;

    setLoadingMessages((prev) => ({ ...prev, [entretienId]: true }));
    try {
      console.log("Fetching messages for interview:", entretienId);
      console.log("Using token:", token);

      // Extraire le token correctement
      let tokenValue;
      if (typeof token === "object" && token !== null) {
        tokenValue = token.value || token;
      } else {
        tokenValue = token;
      }

      // Supprimer le préfixe "Bearer " s'il existe
      if (tokenValue && tokenValue.startsWith("Bearer ")) {
        tokenValue = tokenValue.substring(7);
      }

      console.log("Token value after processing:", tokenValue);

      const response = await fetch(
        `${BASE_URL}/api/accepted-offers/entretiens/${entretienId}/messages`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${tokenValue}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          mode: "cors",
          credentials: "include",
        }
      );

      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Response data:", data);

      if (!response.ok) {
        throw new Error(
          data.error || "Erreur lors de la récupération des messages"
        );
      }

      if (data.success) {
        setMessages((prev) => ({ ...prev, [entretienId]: data.messages }));
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des messages:", error);
      toast.error("Erreur lors de la récupération des messages");
    } finally {
      setLoadingMessages((prev) => ({ ...prev, [entretienId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
          <span className="text-gray-600">Chargement des candidatures...</span>
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
                      Statut
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {candidatures.map((candidature) => (
                    <tr
                      key={`${candidature._id}-${
                        candidature.entretien?.id || "no-interview"
                      }`}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <Building className="h-5 w-5 text-gray-400 mr-2" />
                          <div>
                            <div className="font-medium text-gray-900">
                              {candidature.jobDetails?.title}
                            </div>
                            <div className="text-sm text-gray-500">
                              {candidature.jobDetails?.department}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {candidature.jobDetails?.company}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                          <span>{candidature.jobDetails?.location}</span>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {statusIcons[candidature.entretien.statut]}
                          <span className="ml-2">
                            {statusLabels[candidature.entretien?.statut] ||
                              candidature.entretien?.statut}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end space-x-2">
                          {candidature.entretien?.id && (
                            <button
                              onClick={() => {
                                setSelectedInterview(candidature.entretien);
                                setOpenMessageDialog(true);
                                fetchMessages(candidature.entretien.id);
                              }}
                              className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200"
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Messages
                              {messages[candidature.entretien.id]?.some(
                                (m) => !m.lu
                              ) && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Nouveau
                                </span>
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (candidature.entretien?.id) {
                                navigate(
                                  `/entretienpourc/${candidature.entretien.id}`
                                );
                              } else {
                                toast.error(
                                  "Aucun entretien disponible pour cette candidature"
                                );
                              }
                            }}
                            disabled={candidature.statut !== "Accepté"}
                            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                              candidature.entretien?.statut === "planifie" &&
                              candidature.entretien?.id
                                ? "bg-blue-600 hover:bg-blue-700"
                                : "bg-gray-400 cursor-not-allowed"
                            }`}
                          >
                            <PlayCircle className="h-4 w-4 mr-2" />
                            {candidature.entretien?.statut === "planifie"
                              ? "Passer l'entretien"
                              : candidature.statut === "Accepté"
                              ? "terminer "
                              : ""}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dialog pour afficher les messages */}
      <Dialog
        open={openMessageDialog}
        onClose={() => {
          setOpenMessageDialog(false);
          setSelectedInterview(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Messages pour l'entretien
          {selectedInterview && (
            <Typography variant="subtitle2" color="textSecondary">
              {selectedInterview.offre?.titre}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {loadingMessages[selectedInterview?.id] ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
            </div>
          ) : messages[selectedInterview?.id]?.length > 0 ? (
            <div className="space-y-4 py-4">
              {messages[selectedInterview?.id].map((message) => (
                <div
                  key={message.id}
                  className={`p-4 rounded-lg ${
                    message.lu ? "bg-gray-50" : "bg-blue-50"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <Typography variant="subtitle2" className="font-medium">
                      {message.recruteur?.nom || "Recruteur"}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {new Date(message.date_creation).toLocaleString()}
                    </Typography>
                  </div>
                  <Typography variant="body1">{message.message}</Typography>
                </div>
              ))}
            </div>
          ) : (
            <Typography className="text-center py-8 text-gray-500">
              Aucun message pour cet entretien
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setOpenMessageDialog(false);
              setSelectedInterview(null);
            }}
          >
            Fermer
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default MesInterview;
