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
  const { candidates, jobs, pagination, viewDocument, loading, error } =
    useSelector((state) => ({
      candidates: state.candidates.candidates || [],
      jobs: state.dashboard.jobs || [],
      pagination: state.candidates.pagination,
      viewDocument: state.candidates.viewDocument,
      loading: state.candidates.loading,
      error: state.candidates.error,
    }));
  const { token, user } = useSelector((state) => state.auth);

  const [expandedOffers, setExpandedOffers] = useState({});
  const [filters, setFilters] = useState({
    searchTerm: "",
    status: "all",
    jobId: "all",
  });

  useEffect(() => {
    console.log("Chargement des candidats liés au recruteur...");
    dispatch(fetchCandidates())
      .unwrap()
      .then(() => console.log("Candidats chargés avec succès"))
      .catch((error) =>
        console.error("Erreur lors du chargement des candidats:", error)
      );
  }, [dispatch]);

  // Afficher des messages toast en cas d'erreur
  useEffect(() => {
    if (error) {
      toast.error(`Erreur: ${error}`);
    }
  }, [error]);

  const handleEvaluate = async (candidateId, status) => {
    console.log(
      `Évaluation du candidat ${candidateId}, nouveau statut: ${status}`
    );
    try {
      await dispatch(updateCandidateStatus({ candidateId, status })).unwrap();
      toast.success(`Statut mis à jour avec succès: ${status}`);
    } catch (error) {
      toast.error(`Erreur lors de la mise à jour du statut: ${error}`);
    }
  };

  const handleViewDocument = (type, cv_path, content, candidateName) => {
    console.log("Viewing document:", { type, cv_path, content, candidateName });

    if (type === "cv") {
      // Pour le CV, on utilise toujours l'iframe avec le PDF
      console.log(
        "Opening CV with path:",
        `${BASE_URL}${cv_path || `/api/candidates/cv/unavailable`}`
      );

      // Vérifier si le chemin est un chemin Windows absolu
      const formattedPath =
        cv_path && cv_path.startsWith("C:\\")
          ? `/api/candidates/cv/${cv_path.split("\\").pop()}` // Extraire juste le nom du fichier
          : cv_path || `/api/candidates/cv/unavailable`;

      dispatch(
        setViewDocument({
          isOpen: true,
          type,
          cv_path: formattedPath,
          content: null,
          candidateName,
        })
      );
    } else if (type === "lettre") {
      // Pour la lettre, on garde le contenu texte brut
      console.log("Opening letter content:", content);
      console.log("Type de content:", typeof content);
      console.log("Longueur content:", content ? content.length : 0);
      console.log("Nom du candidat:", candidateName);

      // Vérifier et nettoyer le contenu
      let cleanedContent = content;

      // Si le contenu est un objet, essayer de l'extraire correctement
      if (content && typeof content === "object") {
        console.log("Content is an object, trying to extract:", content);
        cleanedContent = JSON.stringify(content);
      }

      // Gérer le cas où le contenu est vide ou trop court
      if (
        !cleanedContent ||
        (typeof cleanedContent === "string" && cleanedContent.trim().length < 3)
      ) {
        console.warn("Letter content is empty or too short:", cleanedContent);
        toast.error("La lettre de motivation est vide ou trop courte", {
          duration: 3000,
          icon: "📝❌",
        });
        // Continuer quand même avec le contenu disponible
      }

      dispatch(
        setViewDocument({
          isOpen: true,
          type,
          cv_path: null,
          content:
            cleanedContent ||
            "Aucun contenu de lettre de motivation disponible.", // Texte par défaut
          candidateName: candidateName || "Candidat", // Valeur par défaut pour le nom
        })
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

    // Ajouter des logs détaillés pour examiner le premier candidat
    if (candidates && candidates.length > 0) {
      console.log("DÉTAIL DU PREMIER CANDIDAT:");
      console.log("- ID:", candidates[0].id);
      console.log("- Nom:", candidates[0].candidat?.nom);
      console.log("- CV:", candidates[0].candidat?.cv);
      console.log(
        "- Lettre motivation:",
        candidates[0].candidat?.lettre_motivation
      );
      console.log(
        "- Lettre motivation text:",
        candidates[0].candidat?.lettre_motivation_text
      );
      console.log("Candidat objet complet:", candidates[0].candidat);
    }

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
                <iframe
                  title="Document viewer - CV"
                  src={`${BASE_URL}${viewDocument.cv_path}`}
                  className="w-full h-[70vh]"
                  style={{ border: "none" }}
                  onLoad={() => console.log("CV iframe loaded successfully")}
                  onError={(e) => console.error("Error loading CV iframe:", e)}
                ></iframe>
              ) : viewDocument.type === "lettre" && viewDocument.content ? (
                <div className="prose max-w-none">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4">
                    Lettre de motivation -{" "}
                    {viewDocument.candidateName || "Candidat"}
                  </h2>
                  <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    {viewDocument.content &&
                    typeof viewDocument.content === "string" &&
                    viewDocument.content.trim().length > 3 ? (
                      viewDocument.content.split("\n").map((paragraph, idx) =>
                        paragraph.trim() ? (
                          <p
                            key={idx}
                            className="mb-4 text-gray-700 whitespace-pre-line"
                          >
                            {paragraph}
                          </p>
                        ) : (
                          <br key={idx} />
                        )
                      )
                    ) : (
                      <p className="text-orange-500 italic">
                        Lettre de motivation :{" "}
                        {viewDocument.content
                          ? `"${viewDocument.content}"`
                          : "Non disponible"}
                      </p>
                    )}
                  </div>
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
              ) : viewDocument.type === "lettre" ? (
                <div className="flex flex-col items-center justify-center h-[60vh]">
                  <AlertCircle className="h-16 w-16 text-red-400 mb-4" />
                  <p className="text-red-500 text-lg font-medium">
                    La lettre de motivation n'est pas disponible
                  </p>
                  <p className="text-gray-500 mt-2">
                    Le candidat n'a pas fourni de lettre de motivation.
                  </p>
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

                              {/* Bouton lettre toujours visible */}
                              <button
                                onClick={() => {
                                  console.log(
                                    "Lettre button clicked for:",
                                    candidate
                                  );
                                  // Vérifier les données disponibles
                                  console.log("Candidate data:", {
                                    id: candidate.id,
                                    nom:
                                      candidate.candidat?.nom ||
                                      candidate.nom ||
                                      "Candidat",
                                    lettre:
                                      candidate.candidat?.lettre_motivation ||
                                      candidate.lettre_motivation ||
                                      "Aucun contenu disponible",
                                  });

                                  handleViewDocument(
                                    "lettre",
                                    null,
                                    // Essayer différentes structures possibles pour la lettre
                                    candidate.candidat?.lettre_motivation ||
                                      candidate.lettre_motivation ||
                                      "",
                                    // Essayer différentes structures possibles pour le nom
                                    candidate.candidat?.nom ||
                                      candidate.nom ||
                                      "Candidat"
                                  );
                                }}
                                className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100"
                              >
                                <FileText className="h-4 w-4 mr-1" /> Lettre
                              </button>
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
