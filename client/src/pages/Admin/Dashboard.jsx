import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../../config";
import { authService } from "../../services/authService";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";

const AdminDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await axios.get(`${API_URL}/admin/dashboard`, {
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
      <h1 className="text-2xl font-bold text-gray-900">
        Tableau de bord administrateur
      </h1>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Utilisateurs</h3>
          <p className="text-3xl font-bold text-indigo-600">
            {dashboardData?.totalUtilisateurs || 0}
          </p>
          <div className="mt-2 text-sm text-gray-600">
            <p>Recruteurs: {dashboardData?.totalRecruteurs || 0}</p>
            <p>Candidats: {dashboardData?.totalCandidats || 0}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Offres</h3>
          <p className="text-3xl font-bold text-indigo-600">
            {dashboardData?.totalOffres || 0}
          </p>
          <div className="mt-2 text-sm text-gray-600">
            <p>Actives: {dashboardData?.offresActives || 0}</p>
            <p>Clôturées: {dashboardData?.offresCloturees || 0}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Candidatures</h3>
          <p className="text-3xl font-bold text-indigo-600">
            {dashboardData?.totalCandidatures || 0}
          </p>
          <div className="mt-2 text-sm text-gray-600">
            <p>En attente: {dashboardData?.candidaturesEnAttente || 0}</p>
            <p>Traitées: {dashboardData?.candidaturesTraitees || 0}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Entretiens</h3>
          <p className="text-3xl font-bold text-indigo-600">
            {dashboardData?.totalEntretiens || 0}
          </p>
          <div className="mt-2 text-sm text-gray-600">
            <p>Planifiés: {dashboardData?.entretiensPlanifies || 0}</p>
            <p>Effectués: {dashboardData?.entretiensEffectues || 0}</p>
          </div>
        </div>
      </div>

      {/* Activité récente */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Activité récente</h2>
          </div>
          <div className="space-y-4">
            {dashboardData?.activiteRecente?.map((activite) => (
              <div
                key={activite.id}
                className="border-b border-gray-200 pb-4 last:border-0 last:pb-0"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{activite.description}</p>
                    <p className="text-sm text-gray-600">
                      {activite.utilisateur?.nom} {activite.utilisateur?.prenom}
                    </p>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(activite.date).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Liens rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/admin/users"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold mb-2">
            Gestion des utilisateurs
          </h3>
          <p className="text-gray-600">
            Gérer les comptes utilisateurs et les permissions
          </p>
        </Link>
        <Link
          to="/admin/roles"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold mb-2">Gestion des rôles</h3>
          <p className="text-gray-600">
            Configurer les rôles et les permissions
          </p>
        </Link>
        <Link
          to="/admin/logs"
          className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold mb-2">Logs système</h3>
          <p className="text-gray-600">
            Consulter les logs et l'activité système
          </p>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;
