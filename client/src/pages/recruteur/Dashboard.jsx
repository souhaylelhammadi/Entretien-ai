import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_URL } from "../../config";
import { authService } from "../../services/authService";
import { toast } from "react-toastify";

const DashboardGraphs = ({ data }) => {
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [],
  });

  useEffect(() => {
    if (data) {
      // Créer une copie des données pour éviter de modifier l'objet original
      const newChartData = {
        labels: data.labels || [],
        datasets: data.datasets
          ? data.datasets.map((dataset) => ({
              ...dataset,
              data: [...dataset.data],
            }))
          : [],
      };
      setChartData(newChartData);
    }
  }, [data]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Statistiques générales */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Candidatures</h3>
        <div className="space-y-2">
          <p>Total: {data?.totalCandidatures || 0}</p>
          <p>En attente: {data?.candidaturesEnAttente || 0}</p>
          <p>Acceptées: {data?.candidaturesAcceptees || 0}</p>
          <p>Refusées: {data?.candidaturesRefusees || 0}</p>
        </div>
      </div>

      {/* Offres actives */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Offres</h3>
        <div className="space-y-2">
          <p>Total: {data?.totalOffres || 0}</p>
          <p>Actives: {data?.offresActives || 0}</p>
          <p>Clôturées: {data?.offresCloturees || 0}</p>
        </div>
      </div>

      {/* Entretiens */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Entretiens</h3>
        <div className="space-y-2">
          <p>Planifiés: {data?.entretiensPlanifies || 0}</p>
          <p>Effectués: {data?.entretiensEffectues || 0}</p>
          <p>À venir: {data?.entretiensAVenir || 0}</p>
        </div>
      </div>
    </div>
  );
};

const RecruteurDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await axios.get(`${API_URL}/recruteur/dashboard`, {
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
          <h3 className="text-lg font-semibold mb-2">
            Candidatures aujourd'hui
          </h3>
          <p className="text-3xl font-bold text-indigo-600">
            {dashboardData?.candidaturesAujourdhui || 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Entretiens aujourd'hui</h3>
          <p className="text-3xl font-bold text-indigo-600">
            {dashboardData?.entretiensAujourdhui || 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Offres actives</h3>
          <p className="text-3xl font-bold text-indigo-600">
            {dashboardData?.offresActives || 0}
          </p>
        </div>
      </div>

      {/* Graphiques et statistiques détaillées */}
      <DashboardGraphs data={dashboardData} />
    </div>
  );
};

export default RecruteurDashboard;
