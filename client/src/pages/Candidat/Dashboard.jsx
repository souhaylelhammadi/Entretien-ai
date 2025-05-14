import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../../config";
import { authService } from "../../services/authService";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";

const CandidatDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await axios.get(`${API_URL}/candidat/dashboard`, {
          headers: { Authorization: `Bearer ${authService.getToken()}` },
        });
        setDashboardData(response.data);
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
        toast.error("Erreur lors du chargement des données du tableau de bord");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Candidatures en cours</h3>
          <p className="text-3xl font-bold text-indigo-600">
            {dashboardData?.candidaturesEnCours || 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Entretiens à venir</h3>
          <p className="text-3xl font-bold text-indigo-600">
            {dashboardData?.entretiensAVenir || 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Offres correspondantes</h3>
          <p className="text-3xl font-bold text-indigo-600">
            {dashboardData?.offresCorrespondantes || 0}
          </p>
        </div>
      </div>

      {/* Dernières candidatures */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Dernières candidatures</h2>
            <Link
              to="/candidat/candidatures"
              className="text-indigo-600 hover:text-indigo-800"
            >
              Voir tout
            </Link>
          </div>
          <div className="space-y-4">
            {dashboardData?.dernieresCandidatures?.map((candidature) => (
              <div
                key={candidature.id}
                className="border-b border-gray-200 pb-4 last:border-0 last:pb-0"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{candidature.offre.titre}</h3>
                    <p className="text-sm text-gray-600">
                      {candidature.offre.entreprise}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      candidature.statut === "en_attente"
                        ? "bg-yellow-100 text-yellow-800"
                        : candidature.statut === "acceptee"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {candidature.statut === "en_attente"
                      ? "En attente"
                      : candidature.statut === "acceptee"
                      ? "Acceptée"
                      : "Refusée"}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  Postulée le{" "}
                  {new Date(candidature.date_candidature).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Prochain entretien */}
      {dashboardData?.prochainEntretien && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Prochain entretien</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">
                  {dashboardData.prochainEntretien.offre.titre}
                </h3>
                <p className="text-sm text-gray-600">
                  {dashboardData.prochainEntretien.offre.entreprise}
                </p>
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {new Date(
                  dashboardData.prochainEntretien.date
                ).toLocaleString()}
              </div>
              <div className="flex items-center text-sm text-gray-500">
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {dashboardData.prochainEntretien.lieu}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidatDashboard;
