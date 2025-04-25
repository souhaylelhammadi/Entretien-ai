import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Users,
  Eye,
  FileText,
  Mail,
  Phone,
  X,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import {
  fetchCandidates,
  updateCandidateStatus,
  setPagination,
  setViewDocument,
  closeDocumentView,
} from "../../store/recruteur/dashcandidatesSlice";
import { toast } from "react-hot-toast";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const CandidatesSection = () => {
  const dispatch = useDispatch();
  const { candidates, jobs, pagination, viewDocument } = useSelector(
    (state) => ({
      candidates: state.candidates.candidates || [],
      jobs: state.dashboard.jobs || [],
      pagination: state.candidates.pagination,
      viewDocument: state.candidates.viewDocument,
    })
  );

  const [expandedOffers, setExpandedOffers] = useState({});
  const [filters, setFilters] = useState({
    searchTerm: "",
    status: "all",
    jobId: "all",
  });

  useEffect(() => {
    console.log("Fetching candidates...");
    dispatch(fetchCandidates());
  }, [dispatch]);

  const handleEvaluate = async (candidateId, status) => {
    console.log(`Evaluating candidate ${candidateId} to ${status}`);
    dispatch(updateCandidateStatus({ candidateId, status }));
  };

  const handleViewDocument = (type, cv_path, content, candidateName) => {
    console.log("Viewing document:", { type, cv_path, content, candidateName });

    if (type === "cv") {
      // Même si cv_path est vide ou null, on peut quand même essayer d'afficher le CV
      // car notre backend va renvoyer un PDF "CV non disponible"
      console.log(
        "Opening CV with path:",
        `${BASE_URL}${cv_path || `/api/candidates/cv/unavailable`}`
      );

      const path = cv_path || `/api/candidates/cv/unavailable`;
      dispatch(
        setViewDocument({
          isOpen: true,
          type,
          cv_path: path,
          content,
          candidateName,
        })
      );
    } else if (type === "lettre") {
      // Vérification pour les lettres de motivation
      if (!content || content.trim() === "") {
        console.warn("No content provided for cover letter view");
        toast.error(
          "La lettre de motivation n'est pas disponible pour ce candidat",
          {
            duration: 3000,
            icon: "📝❌",
          }
        );
        return;
      }

      dispatch(
        setViewDocument({ isOpen: true, type, cv_path, content, candidateName })
      );
    } else {
      console.warn("Invalid document type or missing content:", type);
      toast.error("Ce document n'est pas disponible", {
        duration: 3000,
        icon: "❌",
      });
    }
  };

  const toggleOffer = (offerId) => {
    setExpandedOffers((prev) => ({
      ...prev,
      [offerId]: !prev[offerId],
    }));
  };

  const getFilteredCandidates = () => {
    console.log("Raw candidates:", candidates);
    console.log("Jobs:", jobs);
    const filtered = candidates.filter((candidate) => {
      if (!candidate.id) {
        console.log("Skipping candidate: missing id", candidate);
        return false;
      }
      const matchesSearch = candidate.candidat?.nom
        ? candidate.candidat.nom
            .toLowerCase()
            .includes(filters.searchTerm.toLowerCase())
        : true;
      const matchesStatus =
        filters.status === "all" || candidate.statut === filters.status;
      const matchesJob =
        filters.jobId === "all" || candidate.offreEmploiId === filters.jobId;
      const result = matchesSearch && matchesStatus && matchesJob;
      if (!result) {
        console.log("Filtered out candidate:", candidate, {
          matchesSearch,
          matchesStatus,
          matchesJob,
        });
      }
      return result;
    });
    console.log("Filtered candidates:", filtered);
    return filtered;
  };

  const groupCandidatesByOffer = () => {
    const filtered = getFilteredCandidates();
    const grouped = {};

    filtered.forEach((candidate) => {
      const offerId = candidate.offreEmploiId || "unknown";
      if (!grouped[offerId]) {
        grouped[offerId] = {
          job: {
            id: offerId,
            titre:
              candidate.offreEmploi?.titre ||
              candidate.offreEmploi?.title ||
              `Offre ${offerId}`,
          },
          candidates: [],
        };
      }
      grouped[offerId].candidates.push(candidate);
    });

    jobs.forEach((job) => {
      const jobId = String(job.id);
      if (grouped[jobId]) {
        grouped[jobId].job.titre =
          job.titre || job.title || grouped[jobId].job.titre;
      }
    });

    console.log("Grouped candidates:", grouped);
    return grouped;
  };

  const getPaginatedOffers = () => {
    const grouped = groupCandidatesByOffer();
    const offerIds = Object.keys(grouped).filter(
      (id) => grouped[id].candidates.length > 0
    );
    console.log("Offer IDs with candidates:", offerIds);
    const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const endIndex = startIndex + pagination.itemsPerPage;
    return offerIds.slice(startIndex, endIndex).map((id) => grouped[id]);
  };

  const getTotalPages = () => {
    const offerIds = Object.keys(groupCandidatesByOffer()).filter(
      (id) => groupCandidatesByOffer()[id].candidates.length > 0
    );
    return Math.ceil(offerIds.length / pagination.itemsPerPage);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Users className="w-6 h-6 mr-2" /> Candidats par Offre
        </h2>
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Rechercher un candidat..."
            value={filters.searchTerm}
            onChange={(e) =>
              setFilters({ ...filters, searchTerm: e.target.value })
            }
            className="px-3 py-2 border rounded-lg"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="all">Tous les statuts</option>
            <option value="en_attente">En attente</option>
            <option value="acceptee">Acceptée</option>
            <option value="refusee">Refusée</option>
          </select>
          <select
            value={filters.jobId}
            onChange={(e) => setFilters({ ...filters, jobId: e.target.value })}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="all">Toutes les offres</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.titre || job.title || "Offre inconnue"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {viewDocument.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-10 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-screen overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800">
                {viewDocument.type === "cv" ? "CV" : "Lettre de motivation"} -{" "}
                {viewDocument.candidateName || "Inconnu"}
              </h3>
              <button
                onClick={() => dispatch(closeDocumentView())}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(100vh-140px)]">
              {viewDocument.type === "cv" && viewDocument.cv_path ? (
                <div className="relative">
                  <iframe
                    src={`${BASE_URL}${viewDocument.cv_path}#toolbar=0&navpanes=0&scrollbar=0`}
                    className="w-full h-[60vh] border-0"
                    title="CV"
                    onLoad={(e) => {
                      console.log("CV iframe loaded successfully");
                    }}
                    onError={(e) => {
                      console.error("Error loading PDF:", e);
                      toast.error(
                        "Impossible de charger le CV. Le fichier est peut-être inaccessible ou corrompu.",
                        {
                          duration: 5000,
                          icon: "❌",
                        }
                      );
                    }}
                  />
                </div>
              ) : viewDocument.type === "cv" ? (
                <div className="flex flex-col items-center justify-center h-[60vh]">
                  <AlertCircle className="h-16 w-16 text-red-400 mb-4" />
                  <p className="text-red-500 text-lg font-medium">
                    Le CV n'est pas disponible
                  </p>
                  <p className="text-gray-500 mt-2">
                    Le candidat n'a pas fourni de CV ou le fichier est
                    inaccessible.
                  </p>
                  <p className="text-gray-500 mt-2 text-sm">
                    URL attendue:{" "}
                    {viewDocument.cv_path
                      ? `${BASE_URL}${viewDocument.cv_path}`
                      : "Non définie"}
                  </p>
                </div>
              ) : viewDocument.type === "lettre" && viewDocument.content ? (
                <div className="prose max-w-none">
                  {viewDocument.content.split("\n").map((p, idx) => (
                    <p key={idx} className="mb-4 text-gray-700">
                      {p}
                    </p>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[60vh]">
                  <FileText className="h-16 w-16 text-gray-400 mb-4" />
                  <p className="text-gray-500 text-lg font-medium">
                    Aucun document disponible
                  </p>
                  <p className="text-gray-400 mt-2">
                    Le document demandé n'est pas disponible pour l'affichage.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {candidates.length === 0 ? (
          <div className="p-6 text-gray-500 text-center">
            <Users className="h-12 w-12 mx-auto text-gray-300" />
            <p className="text-lg font-medium mt-2">
              Aucune candidature chargée
            </p>
          </div>
        ) : getFilteredCandidates().length === 0 ? (
          <div className="p-6 text-gray-500 text-center">
            <Users className="h-12 w-12 mx-auto text-gray-300" />
            <p className="text-lg font-medium mt-2">
              Aucune candidature correspondant aux filtres
            </p>
          </div>
        ) : getPaginatedOffers().length === 0 ? (
          <div className="p-6 text-gray-500 text-center">
            <Users className="h-12 w-12 mx-auto text-gray-300" />
            <p className="text-lg font-medium mt-2">
              Aucune offre avec des candidatures
            </p>
          </div>
        ) : (
          <>
            {getPaginatedOffers().map(({ job, candidates }) => (
              <div key={job.id} className="border-b border-gray-100">
                <div
                  className="flex items-center justify-between px-6 py-4 bg-gray-50 cursor-pointer"
                  onClick={() => toggleOffer(job.id)}
                >
                  <h3 className="text-lg font-semibold text-gray-900">
                    {job.titre || job.title || "Offre inconnue"} (
                    {candidates.length} candidats)
                  </h3>
                  {expandedOffers[job.id] ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </div>
                {expandedOffers[job.id] && (
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
                      {candidates.map((candidate) => (
                        <tr key={candidate.id} className="hover:bg-blue-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                                {candidate.candidat?.nom
                                  ?.charAt(0)
                                  ?.toUpperCase() || "?"}
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {candidate.candidat?.nom || "Inconnu"}
                                </div>
                                <div className="text-sm text-gray-500">
                                  Postulé le{" "}
                                  {candidate.date_postulation
                                    ? new Date(
                                        candidate.date_postulation
                                      ).toLocaleDateString("fr-FR")
                                    : "Inconnu"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <Mail className="h-4 w-4 text-gray-400 mr-2" />
                              <span className="text-sm text-gray-600">
                                {candidate.candidat?.email || "Non fourni"}
                              </span>
                            </div>
                            <div className="flex items-center mt-1">
                              <Phone className="h-4 w-4 text-gray-400 mr-2" />
                              <span className="text-sm text-gray-600">
                                {candidate.candidat?.telephone || "Non fourni"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex space-x-3">
                              <button
                                onClick={() =>
                                  handleViewDocument(
                                    "cv",
                                    candidate.candidat?.cv,
                                    null,
                                    candidate.candidat?.nom || "Inconnu"
                                  )
                                }
                                className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100"
                              >
                                <Eye className="h-4 w-4 mr-1" /> CV
                              </button>
                              {candidate.candidat?.lettre_motivation && (
                                <button
                                  onClick={() =>
                                    handleViewDocument(
                                      "lettre",
                                      null,
                                      candidate.candidat.lettre_motivation,
                                      candidate.candidat.nom || "Inconnu"
                                    )
                                  }
                                  className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100"
                                >
                                  <FileText className="h-4 w-4 mr-1" /> Lettre
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span
                              className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                                candidate.statut === "acceptee"
                                  ? "bg-green-100 text-green-800"
                                  : candidate.statut === "refusee"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {candidate.statut === "acceptee"
                                ? "Acceptée"
                                : candidate.statut === "refusee"
                                ? "Refusée"
                                : "En attente"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex justify-center space-x-2">
                              <button
                                onClick={() =>
                                  handleEvaluate(candidate.id, "acceptee")
                                }
                                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                                disabled={candidate.statut === "acceptee"}
                              >
                                Accepter
                              </button>
                              <button
                                onClick={() =>
                                  handleEvaluate(candidate.id, "refusee")
                                }
                                className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                                disabled={candidate.statut === "refusee"}
                              >
                                Refuser
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
            {getTotalPages() > 1 && (
              <div className="flex justify-between px-6 py-4 bg-white border-t border-gray-100">
                <div className="text-sm text-gray-500">
                  Affichage de{" "}
                  {(pagination.currentPage - 1) * pagination.itemsPerPage + 1} à{" "}
                  {Math.min(
                    pagination.currentPage * pagination.itemsPerPage,
                    Object.keys(groupCandidatesByOffer()).filter(
                      (id) => groupCandidatesByOffer()[id].candidates.length > 0
                    ).length
                  )}{" "}
                  sur{" "}
                  {
                    Object.keys(groupCandidatesByOffer()).filter(
                      (id) => groupCandidatesByOffer()[id].candidates.length > 0
                    ).length
                  }{" "}
                  offres
                </div>
                <div className="flex space-x-1">
                  <button
                    disabled={pagination.currentPage === 1}
                    onClick={() =>
                      dispatch(
                        setPagination({
                          currentPage: pagination.currentPage - 1,
                        })
                      )
                    }
                    className="px-2 py-1 rounded border border-gray-300 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {[...Array(getTotalPages())].map((_, i) => (
                    <button
                      key={i}
                      onClick={() =>
                        dispatch(setPagination({ currentPage: i + 1 }))
                      }
                      className={`px-3 py-1 rounded ${
                        pagination.currentPage === i + 1
                          ? "bg-blue-600 text-white"
                          : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    disabled={pagination.currentPage === getTotalPages()}
                    onClick={() =>
                      dispatch(
                        setPagination({
                          currentPage: pagination.currentPage + 1,
                        })
                      )
                    }
                    className="px-2 py-1 rounded border border-gray-300 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CandidatesSection;
