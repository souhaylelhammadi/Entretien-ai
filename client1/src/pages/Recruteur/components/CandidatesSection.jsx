import React, { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Building,
  Mail,
  Download,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  fetchCandidates,
  downloadCV,
  setCandidatesPage,
} from "../../store/recruteur/dashboardSlice";

const CandidatesSection = () => {
  const dispatch = useDispatch();
  const initialFetchDone = useRef(false);

  const {
    candidates = [],
    loading,
    error,
  } = useSelector((state) => ({
    candidates: state.dashboard.data?.candidates || [],
    loading: state.dashboard.loading,
    error: state.dashboard.error,
  }));

  const pagination = useSelector(
    (state) =>
      state.dashboard.candidatesPagination || {
        page: 1,
        per_page: 10,
        total: 0,
        pages: 0,
      }
  );

  useEffect(() => {
    // Charger les données une seule fois au montage du composant
    // ou lorsque la page de pagination change explicitement
    if (!initialFetchDone.current || pagination?.page !== 1) {
      dispatch(
        fetchCandidates({
          page: pagination?.page || 1,
          per_page: pagination?.per_page || 10,
        })
      );
      initialFetchDone.current = true;
    }
  }, [dispatch, pagination?.page]);

  const handleDownloadCV = async (candidatureId, candidateName) => {
    try {
      await dispatch(downloadCV({ candidatureId })).unwrap();
    } catch (error) {
      console.error("Erreur lors du téléchargement du CV:", error);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= (pagination?.pages || 1)) {
      dispatch(setCandidatesPage(newPage));
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 flex items-center">
        <Building className="w-6 h-6 mr-2 text-blue-600" />
        Gestion des candidats
      </h2>

      {error && (
        <div className="bg-red-100 text-red-800 p-4 rounded-lg border border-red-200">
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center">
          <span className="inline-block h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
        </div>
      ) : !Array.isArray(candidates) || candidates.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl shadow-md border border-gray-200">
          <Building className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-lg">Aucun candidat disponible</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Offre
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
              {candidates.map((candidate) => (
                <tr
                  key={candidate.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">
                      {candidate.nom} {candidate.prenom}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 text-blue-500 mr-2" />
                      <span className="text-sm text-gray-600">
                        {candidate.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-green-500 mr-2" />
                      <span className="text-sm text-gray-600">
                        {candidate.offre_titre}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        candidate.status === "accepté"
                          ? "bg-green-100 text-green-800"
                          : candidate.status === "refusé"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {candidate.status || "En attente"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() =>
                        handleDownloadCV(
                          candidate.id,
                          `${candidate.nom}_${candidate.prenom}`
                        )
                      }
                      className="text-blue-600 hover:text-blue-800 bg-blue-50 p-2 rounded-lg transition-colors"
                      title="Télécharger le CV"
                    >
                      <Download className="h-5 w-5" />
                    </button>
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
                  <span className="font-medium">{candidates.length}</span>{" "}
                  candidats sur{" "}
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
        </div>
      )}
    </div>
  );
};

export default CandidatesSection;
