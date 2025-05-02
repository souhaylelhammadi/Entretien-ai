import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Building, Mail, Download } from "lucide-react";

const CandidatesSection = () => {
  const { token } = useSelector((state) => state.auth);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCandidates = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          "http://localhost:5000/api/candidates?page=1&limit=10",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Candidates reçus:", data);
        setCandidates(data.candidates || []);
      } catch (error) {
        console.error("Erreur lors du chargement des candidats:", {
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
        setError("Échec du chargement des candidats. Veuillez réessayer.");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchCandidates();
    } else {
      setError("Veuillez vous reconnecter, session expirée.");
    }
  }, [token]);

  const handleDownloadCV = async (candidateId, candidateName) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/cv/${candidateId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Échec du téléchargement du CV");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cv_${candidateName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Erreur lors du téléchargement du CV:", error);
      setError("Échec du téléchargement du CV. Veuillez réessayer.");
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
      ) : candidates.length === 0 ? (
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {candidates.map((candidate) => (
                <tr
                  key={candidate._id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">
                      {candidate.nom}
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
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() =>
                        handleDownloadCV(candidate._id, candidate.nom)
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
        </div>
      )}
    </div>
  );
};

export default CandidatesSection;
