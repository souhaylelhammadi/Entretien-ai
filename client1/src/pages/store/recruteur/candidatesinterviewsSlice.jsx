import React, { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Video,
  Download,
  Check,
  X,
  Edit,
  FileText,
  User,
  Calendar,
  Eye,
  Star,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  setSelectedInterview,
  closeCard,
} from "../../store/recruteur/interviewsSlice";
import {
  fetchInterviews,
  setInterviewsPage,
} from "../../store/recruteur/dashboardSlice";

const InterviewsSection = () => {
  const dispatch = useDispatch();
  const initialFetchDone = useRef(false);

  const {
    interviews = [],
    loading,
    error,
    interviewsPagination: pagination,
  } = useSelector((state) => ({
    interviews: state.dashboard.data?.interviews || [],
    loading: state.dashboard.loading,
    error: state.dashboard.error,
    interviewsPagination: state.dashboard.interviewsPagination || {
      page: 1,
      per_page: 10,
      total: 0,
      pages: 0,
    },
  }));

  const { selectedInterview, showCard } = useSelector(
    (state) => state.interviews || { selectedInterview: null, showCard: false }
  );

  useEffect(() => {
    if (!initialFetchDone.current) {
      dispatch(
        fetchInterviews({
          page: pagination.page,
          per_page: pagination.per_page,
        })
      );
      initialFetchDone.current = true;
    }
  }, [dispatch, pagination.page, pagination.per_page]);

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= pagination.pages) {
      dispatch(setInterviewsPage(newPage));
      dispatch(fetchInterviews({ page: newPage, per_page: pagination.per_page }));
    }
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
          }`}
        />
      );
    }
    return stars;
  };

  if (loading) {
    return (
      <div className="text-center py-10">
        <span className="inline-block h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 text-red-800 p-4 rounded-lg border border-red-200">
        <span>{error}</span>
      </div>
    );
  }

  if (!Array.isArray(interviews) || interviews.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl shadow-md border border-gray-200">
        <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-lg">Aucun entretien programmé</p>
      </div>
    );
  }

  return (
    <div className="relative bg-white rounded-lg shadow-sm border">
      <div className="p-5 flex justify-between items-center border-b">
        <h2 className="text-lg font-semibold">Entretiens</h2>
      </div>

      <table className="w-full divide-y">
        <thead className="bg-gray-50">
          <tr>
            {["Candidat", "Poste", "Date", "Statut", "Actions"].map(
              (header) => (
                <th
                  key={header}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {header}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y">
          {interviews.map((interview) => (
            <tr key={interview.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm font-medium">
                <div className="flex items-center">
                  <User className="h-4 w-4 mr-2" />
                  {interview.candidateName || "Inconnu"}
                </div>
              </td>
              <td className="px-6 py-4 text-sm">{interview.position}</td>
              <td className="px-6 py-4 text-sm">
                {interview.date
                  ? new Date(interview.date).toLocaleString()
                  : "Non définie"}
              </td>
              <td className="px-6 py-4">
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    interview.status === "Terminé"
                      ? "bg-green-100 text-green-800"
                      : interview.status === "Annulé"
                      ? "bg-red-100 text-red-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {interview.status || "En attente"}
                </span>
              </td>
              <td className="px-6 py-4">
                <div className="flex space-x-2">
                  <button
                    className="flex items-center text-blue-600 hover:text-blue-800"
                    title="Voir les détails"
                    onClick={() => dispatch(setSelectedInterview(interview))}
                  >
                    <Eye className="h-5 w-5 mr-1" />
                    <span className="text-xs">Détails</span>
                  </button>
                  {interview.status !== "Terminé" && interview.status !== "Annulé" && (
                    <button
                      className="flex items-center text-red-600 hover:text-red-800"
                      title="Annuler l'entretien"
                      onClick={() => console.log("Annuler entretien", interview.id)}
                    >
                      <X className="h-5 w-5 mr-1" />
                      <span className="text-xs">Annuler</span>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="px-6 py-3 flex items-center justify-between border-t border-gray-200">
          <div>
            <p className="text-sm text-gray-700">
              Affichage de{" "}
              <span className="font-medium">{interviews.length}</span>{" "}
              entretiens sur{" "}
              <span className="font-medium">{pagination.total}</span>
            </p>
          </div>
          <div className="flex-1 flex justify-end">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 ${
                pagination.page === 1 ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Précédent
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 ${
                pagination.page === pagination.pages
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
            >
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          </div>
        </div>
      )}

      {showCard && selectedInterview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-auto py-10">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-full overflow-y-auto">
            <div className="sticky top-0 bg-white border-b z-10">
              <div className="flex justify-between items-center p-4">
                <div className="flex items-center">
                  <span className="text-xs text-blue-600">
                    Résumé de l'entretien
                  </span>
                </div>
                <button
                  onClick={() => dispatch(closeCard())}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <h3 className="font-semibold text-lg mb-4">
                Informations sur l'entretien
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Candidat</p>
                  <p className="font-medium">
                    {selectedInterview.candidateName || "Non défini"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Email</p>
                  <p className="font-medium">
                    {selectedInterview.candidateEmail || "Non défini"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Poste</p>
                  <p className="font-medium">
                    {selectedInterview.position || "Non défini"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Date</p>
                  <p className="font-medium">
                    {selectedInterview.date
                      ? new Date(selectedInterview.date).toLocaleString()
                      : "Non définie"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Statut</p>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      selectedInterview.status === "Terminé"
                        ? "bg-green-100 text-green-800"
                        : selectedInterview.status === "Annulé"
                        ? "bg-red-100 text-red-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {selectedInterview.status || "En attente"}
                  </span>
                </div>
              </div>

              {selectedInterview.feedback && (
                <div className="mb-6">
                  <h4 className="font-medium text-md mb-2">Feedback</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm">{selectedInterview.feedback}</p>
                  </div>
                </div>
              )}

              {selectedInterview.rating > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-md mb-2">Évaluation</h4>
                  <div className="flex">
                    {renderStars(selectedInterview.rating)}
                  </div>
                </div>
              )}

              {selectedInterview.recording_url && (
                <div className="mb-6">
                  <h4 className="font-medium text-md mb-2">Enregistrement</h4>
                  <div className="relative bg-gray-800 rounded-lg overflow-hidden">
                    <div className="aspect-w-16 aspect-h-9">
                      <img
                        src="/api/placeholder/400/300"
                        alt="Interview recording preview"
                        className="w-full h-64 object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <a
                          href={selectedInterview.recording_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-3"
                        >
                          <Video className="h-6 w-6 text-blue-600" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t flex justify-end">
              <button
                onClick={() => dispatch(closeCard())}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewsSection;