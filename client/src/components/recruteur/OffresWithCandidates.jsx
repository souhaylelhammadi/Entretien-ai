import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchOffresWithCandidates } from "../../store/slices/candidatesSlice";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const OffresWithCandidates = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { offres, loading, error } = useSelector((state) => state.candidates);

  useEffect(() => {
    const loadOffres = async () => {
      try {
        const resultAction = await dispatch(fetchOffresWithCandidates());
        if (fetchOffresWithCandidates.rejected.match(resultAction)) {
          const error = resultAction.payload;
          if (
            error === "Token d'authentification manquant" ||
            error.includes("Token invalide")
          ) {
            toast.error("Session expirée. Veuillez vous reconnecter.");
            navigate("/login");
          } else {
            toast.error(error || "Une erreur est survenue");
          }
        }
      } catch (err) {
        toast.error("Une erreur est survenue lors du chargement des offres");
      }
    };

    loadOffres();
  }, [dispatch, navigate]);

  if (loading) {
    return <div>Chargement...</div>;
  }

  if (error) {
    return <div>Erreur: {error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Offres avec candidatures</h1>
      {offres && offres.length > 0 ? (
        <div className="grid gap-6">
          {offres.map((offre) => (
            <div key={offre.id} className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">{offre.titre}</h2>
              <div className="mb-4">
                <p className="text-gray-600">{offre.description}</p>
                <p className="text-gray-500 mt-2">
                  {offre.localisation} - {offre.departement}
                </p>
              </div>
              <div className="mt-4">
                <h3 className="font-semibold mb-2">
                  Candidatures ({offre.candidats.length})
                </h3>
                {offre.candidats.length > 0 ? (
                  <div className="grid gap-4">
                    {offre.candidats.map((candidat) => (
                      <div
                        key={candidat.id}
                        className="border rounded-lg p-4 bg-gray-50"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">
                              {candidat.prenom} {candidat.nom}
                            </h4>
                            <p className="text-gray-600">{candidat.email}</p>
                            <p className="text-sm text-gray-500 mt-1">
                              Candidature reçue le:{" "}
                              {new Date(
                                candidat.date_candidature
                              ).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span
                              className={`px-3 py-1 rounded-full text-sm ${
                                candidat.status === "En attente"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : candidat.status === "Acceptée"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {candidat.status}
                            </span>
                            {candidat.cv_url && (
                              <a
                                href={candidat.cv_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                Voir CV
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">
                    Aucune candidature pour cette offre
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">Aucune offre trouvée</p>
      )}
    </div>
  );
};

export default OffresWithCandidates;
