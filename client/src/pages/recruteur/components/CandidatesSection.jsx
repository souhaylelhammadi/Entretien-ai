import React, {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useState,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Building,
  Mail,
  Download,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  AlertTriangle,
  XCircle,
  LogIn,
  FileText,
  CheckCircle2,
  Clock,
  UserCheck,
  UserX,
  Eye,
  X,
  ChevronUp,
  ChevronLeft,
  Phone,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  getOffresWithCandidates,
  downloadCV,
  clearError,
  toggleOffer,
  updateCandidateStatus,
  getLettreMotivation,
  clearLettreMotivation,
  setStatusUpdateState,
  clearSelectedCV,
} from "../../store/candidatesSlice";
import { BASE_URL } from "../../../config";
const CandidatesSection = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const loadAttempted = useRef(false);
  const [localError, setLocalError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const fetchTimeoutRef = useRef(null);
  const [selectedCandidature, setSelectedCandidature] = useState(null);
  const [showCVModal, setShowCVModal] = useState(false);
  const [selectedCV, setSelectedCV] = useState(null);
  const [filters, setFilters] = useState({
    status: "all",
    searchTerm: "",
  });
  const [showLettreModal, setShowLettreModal] = useState(false);
  const [selectedLettreMotivation, setSelectedLettreMotivation] =
    useState(null);
  const [statusUpdateStates, setStatusUpdateStates] = useState({});

  // Get auth state through useSelector
  const authState = useSelector((state) => state.auth);
  const { isAuthenticated, user, token } = authState;

  // Get candidates state through useSelector
  const candidatesState = useSelector((state) => state.candidates);

  // Get offers state through useSelector and memoize
  const { offres, loading, error, expandedOffers, downloadProgress } = useMemo(
    () => ({
      offres: candidatesState.offres || [],
      loading: candidatesState.loading,
      error: candidatesState.error,
      expandedOffers: candidatesState.expandedOffers || {},
      downloadProgress: candidatesState.downloadProgress || 0,
    }),
    [candidatesState]
  );

  // Set isInitialLoad to false when loading completes
  useEffect(() => {
    if (!loading) {
      setIsInitialLoad(false);
    }
  }, [loading]);

  // Fetch offers with candidates on component mount
  useEffect(() => {
    if (isAuthenticated && user?.role === "recruteur" && token) {
      dispatch(getOffresWithCandidates());
    } else if (!token) {
      setLocalError("Token d'authentification manquant");
    }
  }, [dispatch, isAuthenticated, user, token]);

  // Memoize the fetch function
  const fetchOffers = useCallback(async () => {
    if (!isAuthenticated || !user?._id || !token) {
      setLocalError("Non authentifié ou informations utilisateur manquantes");
      return;
    }

    try {
      setLocalError(null);
      dispatch(clearError());
      const result = await dispatch(getOffresWithCandidates()).unwrap();
      console.log("Candidatures chargées avec succès:", result);
    } catch (error) {
      console.error("Erreur lors du chargement des candidatures:", error);
      setLocalError(
        error.message || "Erreur lors du chargement des candidatures"
      );
    }
  }, [dispatch, isAuthenticated, user?._id, token]);

  // Effect for initial data fetch
  useEffect(() => {
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(fetchOffers, 100);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [fetchOffers]);

  // Effect to clear error when component unmounts
  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  // Memoize handlers
  const handleViewCV = useCallback(
    async (candidatureId) => {
      try {
        setLocalError(null);
        dispatch(clearError());

        // Vérifier si le CV est déjà chargé
        if (selectedCV && selectedCV.id === candidatureId) {
          setShowCVModal(true);
          return;
        }

        const blob = await dispatch(downloadCV(candidatureId)).unwrap();
        const url = URL.createObjectURL(blob);
        setSelectedCV({ id: candidatureId, url });
        setShowCVModal(true);
      } catch (error) {
        console.error("Error viewing CV:", error);
        setLocalError(error.message || "Erreur lors de l'affichage du CV");
        setShowCVModal(false);
      }
    },
    [dispatch, selectedCV]
  );

  const handleCloseCVModal = useCallback(() => {
    setShowCVModal(false);
    if (selectedCV?.url) {
      URL.revokeObjectURL(selectedCV.url);
    }
    setSelectedCV(null);
    dispatch(clearSelectedCV());
  }, [selectedCV, dispatch]);

  const handleToggleOffer = useCallback(
    (offerId) => {
      dispatch(toggleOffer(offerId));
    },
    [dispatch]
  );

  const handleStatusChange = useCallback(
    async (candidatureId, newStatus) => {
      setStatusUpdateStates((prev) => ({ ...prev, [candidatureId]: true }));
      try {
        await dispatch(
          updateCandidateStatus({ candidatureId, status: newStatus })
        ).unwrap();
        // Rafraîchir les données après la mise à jour
        dispatch(getOffresWithCandidates());
      } catch (error) {
        console.error("Erreur lors de la mise à jour du statut:", error);
      } finally {
        setStatusUpdateStates((prev) => ({ ...prev, [candidatureId]: false }));
      }
    },
    [dispatch]
  );

  const handleViewCandidature = useCallback((candidature) => {
    if (!candidature) {
      console.error("Candidature data is undefined");
      return;
    }
    setSelectedCandidature({
      id: candidature.id || candidature._id,
      nom: candidature.nom || "Non spécifié",
      prenom: candidature.prenom || "Non spécifié",
      email: candidature.email || "Non spécifié",
      status: candidature.status || "En attente",
      lettre_motivation: candidature.lettre_motivation || "",
      cv_path: candidature.cv_path || "",
      date_creation: candidature.date_creation || new Date().toISOString(),
      offre_id: candidature.offre_id || "",
      offre_titre: candidature.offre_titre || "Offre non spécifiée",
    });
  }, []);

  const handleCloseCandidatureDetails = useCallback(() => {
    setSelectedCandidature(null);
  }, []);

  const handleViewLettre = useCallback(
    async (candidatureId) => {
      if (!candidatureId) {
        console.error("Candidature ID is undefined");
        return;
      }
      try {
        setLocalError(null);
        dispatch(clearError());
        const result = await dispatch(
          getLettreMotivation(candidatureId)
        ).unwrap();
        setSelectedLettreMotivation(result);
        setShowLettreModal(true);
      } catch (error) {
        console.error("Error viewing lettre:", error);
        setLocalError(
          error.message || "Erreur lors de l'affichage de la lettre"
        );
        setShowLettreModal(false);
      }
    },
    [dispatch]
  );

  const handleCloseLettreModal = useCallback(() => {
    setShowLettreModal(false);
    setSelectedLettreMotivation(null);
    dispatch(clearLettreMotivation());
  }, [dispatch]);

  const getStatusIcon = (status) => {
    switch (status) {
      case "En attente":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "En cours":
        return <UserCheck className="w-4 h-4 text-blue-500" />;
      case "Accepté":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "Refusé":
        return <UserX className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "En attente":
        return "bg-yellow-100 text-yellow-800";
      case "En cours":
        return "bg-blue-100 text-blue-800";
      case "Accepté":
        return "bg-green-100 text-green-800";
      case "Refusé":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getFilteredCandidates = (candidats) => {
    if (!Array.isArray(candidats)) {
      console.error("candidats is not an array:", candidats);
      return [];
    }
    return candidats.filter((candidat) => {
      if (!candidat) return false;
      const matchesSearch =
        !filters.searchTerm ||
        (candidat.nom &&
          candidat.nom
            .toLowerCase()
            .includes(filters.searchTerm.toLowerCase())) ||
        (candidat.prenom &&
          candidat.prenom
            .toLowerCase()
            .includes(filters.searchTerm.toLowerCase())) ||
        (candidat.email &&
          candidat.email
            .toLowerCase()
            .includes(filters.searchTerm.toLowerCase()));

      const matchesStatus =
        filters.status === "all" || candidat.status === filters.status;

      return matchesSearch && matchesStatus;
    });
  };

  if (!isAuthenticated || !token) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Building className="w-6 h-6 mr-2 text-blue-600" />
          Candidats par offre
        </h2>
        <div className="bg-yellow-100 text-yellow-800 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-center">
            <LogIn className="h-5 w-5 mr-2" />
            <p>Veuillez vous connecter pour accéder à cette page</p>
          </div>
          <button
            onClick={() => navigate("/login")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "recruteur") {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Building className="w-6 h-6 mr-2 text-blue-600" />
          Candidats par offre
        </h2>
        <div className="bg-yellow-100 text-yellow-800 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <p>
              Accès non autorisé. Cette section est réservée aux recruteurs.
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retour à l'accueil
          </button>
        </div>
      </div>
    );
  }

  if (loading || isInitialLoad) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || localError) {
    return (
      <div className="p-4">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error || localError}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Building className="w-6 h-6 mr-2 text-blue-600" />
          Candidats par offre
        </h2>
        <div className="flex space-x-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="text-sm border border-gray-300 rounded-md px-3 py-1"
          >
            <option value="all">Tous les statuts</option>
            <option value="En attente">En attente</option>
            <option value="En cours">En cours</option>
            <option value="Accepté">Accepté</option>
            <option value="Refusé">Refusé</option>
          </select>
          <input
            type="text"
            placeholder="Rechercher..."
            value={filters.searchTerm}
            onChange={(e) =>
              setFilters({ ...filters, searchTerm: e.target.value })
            }
            className="text-sm border border-gray-300 rounded-md px-3 py-1"
          />
        </div>
      </div>

      {!Array.isArray(offres) || offres.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl shadow-md border border-gray-200">
          <p className="text-gray-500 text-lg">Aucune candidature disponible</p>
        </div>
      ) : (
        <div className="space-y-4">
          {offres.map((offre) => (
            <div
              key={offre.id}
              className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden"
            >
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                onClick={() => handleToggleOffer(offre.id)}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <Building className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {offre.titre}
                    </h3>
                    <p className="text-sm text-gray-500">{offre.entreprise}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    {Array.isArray(offre.candidats) ? offre.candidats.length : 0} candidat(s)
                  </span>
                  {expandedOffers[offre.id] ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {expandedOffers[offre.id] && (
                <div className="border-t border-gray-200">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Candidat
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Contact
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Documents
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Statut
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {Array.isArray(offre.candidats) && getFilteredCandidates(offre.candidats).map(
                        (candidat) => (
                          <tr key={candidat.id} className="hover:bg-blue-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                                  {candidat.nom?.charAt(0)?.toUpperCase() ||
                                    "?"}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {candidat.prenom} {candidat.nom}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    Postulé le{" "}
                                    {new Date(
                                      candidat.date_candidature
                                    ).toLocaleDateString("fr-FR")}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Mail className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm text-gray-600">
                                  {candidat.email}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex space-x-3">
                                <button
                                  onClick={() => handleViewCV(candidat.id)}
                                  className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
                                >
                                  <Eye className="h-4 w-4 mr-1" /> CV
                                </button>
                                <button
                                  onClick={() => handleViewLettre(candidat.id)}
                                  className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100"
                                >
                                  <FileText className="h-4 w-4 mr-1" /> Lettre
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span
                                className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                                  candidat.status
                                )}`}
                              >
                                {candidat.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="flex justify-center space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(candidat.id, "Accepté");
                                  }}
                                  className={`px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 ${
                                    statusUpdateStates[candidat.id]
                                      ? "opacity-50 cursor-not-allowed"
                                      : ""
                                  }`}
                                  disabled={
                                    candidat.status === "Accepté" ||
                                    statusUpdateStates[candidat.id]
                                  }
                                >
                                  {statusUpdateStates[candidat.id] ? (
                                    <div className="flex items-center">
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                      Mise à jour...
                                    </div>
                                  ) : (
                                    "Accepter"
                                  )}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusChange(candidat.id, "Refusé");
                                  }}
                                  className={`px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 ${
                                    statusUpdateStates[candidat.id]
                                      ? "opacity-50 cursor-not-allowed"
                                      : ""
                                  }`}
                                  disabled={
                                    candidat.status === "Refusé" ||
                                    statusUpdateStates[candidat.id]
                                  }
                                >
                                  {statusUpdateStates[candidat.id] ? (
                                    <div className="flex items-center">
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                      Mise à jour...
                                    </div>
                                  ) : (
                                    "Refuser"
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal pour les détails de la candidature */}
      {selectedCandidature && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Détails de la candidature
                </h3>
                <button
                  onClick={handleCloseCandidatureDetails}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">
                    Candidat
                  </h4>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedCandidature.prenom} {selectedCandidature.nom}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedCandidature.email}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">
                    Lettre de motivation
                  </h4>
                  <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                    {selectedCandidature.lettre_motivation || "Non fournie"}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">
                    Date de candidature
                  </h4>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(
                      selectedCandidature.date_candidature
                    ).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Statut</h4>
                  <select
                    value={selectedCandidature.status}
                    onChange={(e) =>
                      handleStatusChange(selectedCandidature.id, e.target.value)
                    }
                    className={`mt-1 text-sm border border-gray-300 rounded-md px-2 py-1 ${getStatusColor(
                      selectedCandidature.status
                    )}`}
                  >
                    <option value="En attente">En attente</option>
                    <option value="En cours">En cours</option>
                    <option value="Accepté">Accepté</option>
                    <option value="Refusé">Refusé</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal pour le CV */}
      {showCVModal && selectedCV && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                CV du candidat
              </h3>
              <button
                onClick={handleCloseCVModal}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden relative">
              {candidatesState.cvLoadingStates[selectedCV.id] ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : (
                <object
                  data={selectedCV.url}
                  type="application/pdf"
                  className="w-full h-full"
                >
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">
                      Impossible d'afficher le PDF.
                      <a
                        href={selectedCV.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:text-blue-700 ml-2"
                      >
                        Ouvrir dans un nouvel onglet
                      </a>
                    </p>
                  </div>
                </object>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal pour la lettre de motivation */}
      {showLettreModal && selectedLettreMotivation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-gray-900">
                  Lettre de motivation
                </h3>
                <button
                  onClick={handleCloseLettreModal}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              {localError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Erreur
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        {localError}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                    <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700">
                      {selectedLettreMotivation.lettre_motivation}
                      </pre>
                    </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidatesSection;
