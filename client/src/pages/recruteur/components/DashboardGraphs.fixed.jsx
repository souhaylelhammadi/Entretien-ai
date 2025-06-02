import React, { useMemo, useEffect, useState } from "react";
import { Bar, Line, Pie, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  RadialLinearScale,
} from "chart.js";
import axios from "axios";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  RadialLinearScale
);

// Définir des couleurs comme chaînes directes au lieu d'utiliser des tableaux
const colors = {
  primaryBg: "rgba(59, 130, 246, 0.7)",
  primaryBorder: "rgba(59, 130, 246, 1)",
  secondaryBg: "rgba(233, 88, 125, 0.7)",
  secondaryBorder: "rgba(233, 88, 125, 1)",
  tertiaryBg: "rgba(16, 185, 129, 0.7)",
  tertiaryBorder: "rgba(16, 185, 129, 1)",
  accent1Bg: "rgba(245, 158, 11, 0.7)",
  accent1Border: "rgba(245, 158, 11, 1)",
  accent2Bg: "rgba(139, 92, 246, 0.7)",
  accent2Border: "rgba(139, 92, 246, 1)",
  accent3Bg: "rgba(236, 72, 153, 0.7)",
  accent3Border: "rgba(236, 72, 153, 1)",
};

const generateRandomData = (min, max, count) => {
  return Array.from(
    { length: count },
    () => Math.floor(Math.random() * (max - min + 1)) + min
  );
};

// Fonction pour générer des dates à partir d'aujourd'hui
const generateDateRange = (daysBack, format = "court") => {
  const dates = [];
  const labels = [];

  for (let i = daysBack; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    // ISO format pour les dates complètes
    dates.push(date.toISOString().split("T")[0]);

    // Format plus lisible pour les labels
    if (format === "court") {
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      labels.push(`${day}/${month}`);
    } else {
      labels.push(date.toLocaleDateString());
    }
  }

  return { dates, labels };
};

const DashboardGraphs = ({ data = {}, period = "week" }) => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        if (!token) {
          setError("Token d'authentification manquant");
          return;
        }

        // S'assurer que le token n'a pas déjà le préfixe Bearer
        const authToken = token.startsWith("Bearer ")
          ? token
          : `Bearer ${token}`;

        const response = await axios.get("/api/recruteur/candidates", {
          headers: {
            Authorization: authToken,
          },
        });

        if (response.data && response.data.candidates) {
          setCandidates(response.data.candidates);
          setError(null);
        } else {
          setError("Format de réponse invalide");
        }
      } catch (err) {
        console.error("Erreur lors de la récupération des candidats:", err);
        if (err.response) {
          if (err.response.status === 401) {
            setError("Session expirée. Veuillez vous reconnecter.");
          } else {
            setError(`Erreur serveur: ${err.response.status}`);
          }
        } else {
          setError("Erreur lors de la récupération des candidats");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCandidates();
  }, []);

  // Extraire graphData de data de façon sécurisée
  const graphData = data?.graphData || {};
  const daysToShow = period === "week" ? 7 : period === "month" ? 30 : 12;

  
  

  // Utiliser useMemo pour éviter de recalculer les données à chaque rendu
  const activityData = useMemo(() => {
    // Générer des dates pour l'axe X
    const { dates, labels } = generateDateRange(daysToShow - 1);

    // Calculer les données d'activité basées sur le total des candidats
    const totalCandidates = data?.totalCandidates || 0;
    const totalInterviews = data?.upcomingInterviews || 0;

    // Générer des données progressives pour les jours
    const candidatesData = dates.map((_, index) => {
      const progress = (index + 1) / daysToShow;
      return Math.floor(totalCandidates * progress);
    });

    const interviewsData = dates.map((_, index) => {
      const progress = (index + 1) / daysToShow;
      return Math.floor(totalInterviews * progress);
    });

    // Créer un nouvel objet sans référence à des objets potentiellement en lecture seule
    return {
      labels: [...labels],
      datasets: [
        {
          label: "Candidats",
          data: [...candidatesData],
          backgroundColor: colors.primaryBg,
          borderColor: colors.primaryBorder,
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: colors.primaryBorder,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
        {
          label: "Entretiens",
          data: [...interviewsData],
          backgroundColor: colors.secondaryBg,
          borderColor: colors.secondaryBorder,
          tension: 0.4,
          fill: true, 
          pointRadius: 3,
          pointBackgroundColor: colors.secondaryBorder,
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
      ],
    };
  }, [daysToShow, data?.totalCandidates, data?.upcomingInterviews]);

  // Préparer les données pour le graphique de distribution des statuts
  const statusData = useMemo(() => {
    // Créer un objet de distribution basé sur les statuts réels des candidats
    const statusDistribution = {};

    // Si nous avons des candidats, compter leurs statuts
    if (candidates && candidates.length > 0) {
      candidates.forEach((candidate) => {
        const status = candidate.status || "En attente";
        statusDistribution[status] = (statusDistribution[status] || 0) + 1;
      });
    }
    // Si aucune donnée n'est disponible, utiliser une distribution vide
    else {
      statusDistribution["Aucune candidature"] = 1;
    }

    // Tableau de couleurs sûres
    const backgroundColors = [
      colors.primaryBg,
      colors.tertiaryBg,
      colors.secondaryBg,
      colors.accent1Bg,
      colors.accent2Bg
    ];
    
    const borderColors = [
      colors.primaryBorder,
      colors.tertiaryBorder,
      colors.secondaryBorder,
      colors.accent1Border,
      colors.accent2Border
    ];

    return {
      labels: Object.keys(statusDistribution),
      datasets: [
        {
          data: Object.values(statusDistribution),
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
          hoverOffset: 10,
        },
      ],
    };
  }, [candidates]);

  // Préparer les données pour le graphique des entretiens
  const interviewStatusData = useMemo(() => {
    // Données par défaut pour la démonstration
    const defaultDistribution = {
      
    };

    // Utiliser les données réelles ou les données par défaut (faire une copie)
    const interviewStatusDistribution =
      graphData?.interviewStatusDistribution
        ? {...graphData.interviewStatusDistribution}
        : {...defaultDistribution};

    // S'assurer que toutes les valeurs sont des nombres
    const processedDistribution = Object.entries(
      interviewStatusDistribution
    ).reduce((acc, [key, value]) => {
      acc[key] = Number(value) || 0;
      return acc;
    }, {});

    const backgroundColors = [
      colors.accent1Bg, 
      colors.tertiaryBg,
      colors.secondaryBg,
      colors.accent2Bg
    ];
    
    const borderColors = [
      colors.accent1Border,
      colors.tertiaryBorder,
      colors.secondaryBorder,
      colors.accent2Border
    ];

    return {
      labels: Object.keys(processedDistribution),
      datasets: [
        {
          data: Object.values(processedDistribution),
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
          hoverOffset: 10,
        },
      ],
    };
  }, [graphData]);

  // Données pour le graphique d'offres par département
  const jobsByDepartment = useMemo(() => {
  
   

    let departmentData = {};

    // Essayer d'abord d'utiliser les données du graphData
    if (
      graphData?.offresByDepartment &&
      Object.keys(graphData.offresByDepartment).length > 0
    ) {
      departmentData = {...graphData.offresByDepartment};
    }
    // Sinon, calculer à partir des offres
    else if (data?.offres && data.offres.length > 0) {
      departmentData = data.offres.reduce((acc, offre) => {
        const dept = offre.departement || offre.localisation || "Non spécifié";
        acc[dept] = (acc[dept] || 0) + 1;
        return acc;
      }, {});
    }
    // Si aucune donnée n'est disponible, utiliser les données par défaut
    else {
      departmentData = {};
    }

    // Ajuster la somme pour qu'elle corresponde au nombre d'offres actives
    const total = data?.activeJobs || 0;
    const currentSum = Object.values(departmentData).reduce((a, b) => a + b, 0);
    if (total > 0 && currentSum !== total) {
      const diff = total - currentSum;
      const firstDept = Object.keys(departmentData)[0];
      if (firstDept) {
        departmentData = {
          ...departmentData,
          [firstDept]: (departmentData[firstDept] || 0) + diff
        };
      }
    }

    // Créer des tableaux de couleurs en utilisant les couleurs directes
    const backgroundColors = [
      colors.primaryBg,
      colors.secondaryBg,
      colors.tertiaryBg,
      colors.accent1Bg,
      colors.accent2Bg,
      colors.accent3Bg
    ];
    
    const borderColors = [
      colors.primaryBorder,
      colors.secondaryBorder,
      colors.tertiaryBorder,
      colors.accent1Border,
      colors.accent2Border,
      colors.accent3Border
    ];

    return {
      labels: Object.keys(departmentData),
      datasets: [
        {
          label: "Offres par département",
          data: Object.values(departmentData),
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
        },
      ],
    };
  }, [graphData, data?.offres, data?.activeJobs]);

  // Options communes pour les graphiques
  const lineChartOptions = {
    responsive: true,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        position: "top",
        labels: {
          usePointStyle: true,
          boxWidth: 10,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        usePointStyle: true,
        callbacks: {
          label: function (context) {
            return `${context.dataset.label}: ${context.parsed.y}`;
          },
        },
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          precision: 0,
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
    animations: {
      tension: {
        duration: 1000,
        easing: "linear",
      },
    },
    maintainAspectRatio: false,
  };

  const pieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "right",
        labels: {
          usePointStyle: true,
          font: {
            size: 11,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const value = context.parsed;
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
    animation: {
      animateRotate: true,
      animateScale: true,
    },
    maintainAspectRatio: false,
  };

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
        ticks: {
          precision: 0,
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
    animation: {
      duration: 1000,
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="space-y-6">
      {/* En-tête du tableau de bord - Utiliser les données réelles */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg shadow border border-blue-100">
          <h3 className="text-sm font-semibold text-blue-700 mb-1">
            Candidatures
          </h3>
          <p className="text-2xl font-bold text-blue-800">
            {candidates.length || 0}
          </p>
          <p className="text-xs text-blue-600 mt-1">Total des candidatures</p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg shadow border border-green-100">
          <h3 className="text-sm font-semibold text-green-700 mb-1">
            Offres actives
          </h3>
          <p className="text-2xl font-bold text-green-800">
            {data?.activeJobs || 0}
          </p>
          <p className="text-xs text-green-600 mt-1">Offres en cours</p>
        </div>

        <div className="bg-amber-50 p-4 rounded-lg shadow border border-amber-100">
          <h3 className="text-sm font-semibold text-amber-700 mb-1">
            Entretiens
          </h3>
          <p className="text-2xl font-bold text-amber-800">
            {data?.upcomingInterviews || 0}
          </p>
          <p className="text-xs text-amber-600 mt-1">Prochains entretiens</p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg shadow border border-purple-100">
          <h3 className="text-sm font-semibold text-purple-700 mb-1">
            Taux de conversion
          </h3>
          <p className="text-2xl font-bold text-purple-800">
            {(data?.conversionRate || 0).toFixed(1)}%
          </p>
          <p className="text-xs text-purple-600 mt-1">Candidats embauchés</p>
        </div>
      </div>

      {/* Graphiques avec données réelles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Graphique d'activité */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Activité récente
          </h3>
          <div className="h-64">
            <Line data={activityData} options={lineChartOptions} />
          </div>
        </div>

        {/* Graphique de distribution des statuts */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Distribution des candidatures
          </h3>
          <div className="h-64">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-red-500">
                {error}
              </div>
            ) : (
              <Doughnut data={statusData} options={pieChartOptions} />
            )}
          </div>
        </div>

        {/* Graphique des offres par département */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Offres par département
          </h3>
          <div className="h-64">
            <Bar data={jobsByDepartment} options={barChartOptions} />
          </div>
        </div>

        {/* Graphique des entretiens */}
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Statut des entretiens
          </h3>
          <div className="h-64">
            <Pie data={interviewStatusData} options={pieChartOptions} />
          </div>
        </div>
      </div>

    
      
    </div>
  );
};

export default DashboardGraphs; 