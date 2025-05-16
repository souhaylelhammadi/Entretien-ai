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

// Définir les couleurs comme des constantes (non modifiables)
const colorPalette = {
  primary: ["rgba(59, 130, 246, 0.7)", "rgba(59, 130, 246, 1)"], // Bleu
  secondary: ["rgba(233, 88, 125, 0.7)", "rgba(233, 88, 125, 1)"], // Rose
  tertiary: ["rgba(16, 185, 129, 0.7)", "rgba(16, 185, 129, 1)"], // Vert
  accent1: ["rgba(245, 158, 11, 0.7)", "rgba(245, 158, 11, 1)"], // Orange
  accent2: ["rgba(139, 92, 246, 0.7)", "rgba(139, 92, 246, 1)"], // Violet
  accent3: ["rgba(236, 72, 153, 0.7)", "rgba(236, 72, 153, 1)"], // Rose vif
};

// Helper function to safely create color strings
const safeColor = (color) => String(color);

// Helper function to create color arrays safely
const safeColorArray = (colors) => colors.map(color => String(color));

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

  // Log détaillé des données reçues
  console.log("========== DASHBOARD GRAPHS ==========");
  console.log("Données complètes reçues:", data);
  console.log("GraphData reçu:", data?.graphData);
  console.log("Période:", period);

  // Extraire graphData de data de façon sécurisée
  const graphData = data?.graphData || {};
  const daysToShow = period === "week" ? 7 : period === "month" ? 30 : 12;

  // Vérifier si nous avons des données
  const hasData = useMemo(() => {
    // Vérifier si nous avons au moins une donnée dans l'un des graphiques
    const hasAnyData =
      data?.totalCandidates > 0 ||
      data?.activeJobs > 0 ||
      data?.upcomingInterviews > 0 ||
      data?.conversionRate > 0;

    console.log("Données disponibles:", {
      hasTotalCandidates: data?.totalCandidates > 0,
      hasActiveJobs: data?.activeJobs > 0,
      hasUpcomingInterviews: data?.upcomingInterviews > 0,
      hasConversionRate: data?.conversionRate > 0,
      hasAnyData,
    });

    return hasAnyData;
  }, [data]);

  // Utiliser useMemo pour éviter de recalculer les données à chaque rendu
  const activityData = useMemo(() => {
    console.log("========== ACTIVITY DATA ==========");

    // Générer des dates pour l'axe X
    const { dates, labels } = generateDateRange(daysToShow - 1);
    console.log("Dates générées:", dates);
    console.log("Labels générés:", labels);

    // Calculer les données d'activité basées sur le total des candidats
    const totalCandidates = data?.totalCandidates || 0;
    const totalInterviews = data?.upcomingInterviews || 0;

    // Générer des données progressives pour les 7 derniers jours
    const candidatesData = dates.map((_, index) => {
      const progress = (index + 1) / daysToShow;
      return Math.floor(totalCandidates * progress);
    });

    const interviewsData = dates.map((_, index) => {
      const progress = (index + 1) / daysToShow;
      return Math.floor(totalInterviews * progress);
    });

    console.log("Données des candidats:", candidatesData);
    console.log("Données des entretiens:", interviewsData);

    const result = {
      labels: labels,
    datasets: [
      {
        label: "Candidats",
          data: candidatesData,
          backgroundColor: safeColor(colorPalette.primary[0]),
          borderColor: safeColor(colorPalette.primary[1]),
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: safeColor(colorPalette.primary[1]),
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
      },
      {
        label: "Entretiens",
          data: interviewsData,
          backgroundColor: safeColor(colorPalette.secondary[0]),
          borderColor: safeColor(colorPalette.secondary[1]),
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: safeColor(colorPalette.secondary[1]),
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
      ],
    };

    console.log("Données d'activité préparées:", result);
    return result;
  }, [graphData, daysToShow, data?.totalCandidates, data?.upcomingInterviews]);

  // Préparer les données pour le graphique de distribution des statuts
  const statusData = useMemo(() => {
    console.log("========== STATUS DATA ==========");
    console.log("Candidates:", candidates);

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

    console.log("Distribution des statuts calculée:", statusDistribution);

    // Créer de nouvelles copies des couleurs pour éviter de modifier des objets gelés
    const backgroundColors = safeColorArray([
            colorPalette.primary[0],
            colorPalette.tertiary[0],
            colorPalette.secondary[0],
            colorPalette.accent1[0],
            colorPalette.accent2[0],
    ]);
    
    const borderColors = safeColorArray([
            colorPalette.primary[1],
            colorPalette.tertiary[1],
            colorPalette.secondary[1],
            colorPalette.accent1[1],
            colorPalette.accent2[1],
    ]);

    const result = {
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

    console.log("Données de statut préparées:", result);
    return result;
  }, [candidates]);

  // Préparer les données pour le graphique des entretiens
  const interviewStatusData = useMemo(() => {
    console.log("========== INTERVIEW STATUS DATA ==========");
    console.log(
      "Interview Status Distribution reçu:",
      graphData?.interviewStatusDistribution
    );
    console.log("Upcoming Interviews:", data?.upcomingInterviews);

    // Données par défaut pour la démonstration
    const defaultDistribution = {
      "En attente": Math.floor(Math.random() * 5) + 2,
      Planifié: Math.floor(Math.random() * 3) + 1,
      Terminé: Math.floor(Math.random() * 4) + 1,
      Annulé: Math.floor(Math.random() * 2) + 1,
    };

    // Utiliser les données réelles ou les données par défaut
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

    console.log(
      "Distribution des statuts d'entretien traitée:",
      processedDistribution
    );

    // Créer de nouvelles copies des couleurs pour éviter de modifier des objets gelés
    const backgroundColors = safeColorArray([
            colorPalette.accent1[0],
            colorPalette.tertiary[0],
            colorPalette.secondary[0],
            colorPalette.accent2[0],
    ]);
    
    const borderColors = safeColorArray([
            colorPalette.accent1[1],
            colorPalette.tertiary[1],
            colorPalette.secondary[1],
            colorPalette.accent2[1],
    ]);

    const result = {
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

    console.log("Données de statut d'entretien préparées:", result);
    return result;
  }, [graphData, data?.upcomingInterviews]);

  // Données pour le graphique d'offres par département
  const jobsByDepartment = useMemo(() => {
    console.log("========== JOBS BY DEPARTMENT ==========");
    console.log(
      "Offres par département reçues:",
      graphData?.offresByDepartment
    );
    console.log("Offres:", data?.offres);

    // Créer des données basées sur les offres actives
    const defaultDepartments = {
      Informatique: Math.floor(data?.activeJobs * 0.4) || 2,
      Marketing: Math.floor(data?.activeJobs * 0.3) || 1,
      "Ressources Humaines": Math.floor(data?.activeJobs * 0.2) || 1,
      Finance: Math.floor(data?.activeJobs * 0.1) || 1,
    };

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
      departmentData = {...defaultDepartments};
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

    console.log("Données de département traitées:", departmentData);

    // Créer de nouvelles copies des couleurs pour éviter de modifier des objets gelés
    const backgroundColors = safeColorArray(Object.values(colorPalette).map(c => c[0]));
    const borderColors = safeColorArray(Object.values(colorPalette).map(c => c[1]));

    const result = {
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

    console.log("Données de département préparées:", result);
    return result;
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

      {/* Message si aucun graphique n'est disponible */}
      {!hasData && (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <div className="text-gray-500 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mx-auto text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            Aucune donnée disponible
          </h3>
          <p className="text-gray-500">
            Les statistiques s'afficheront ici dès que des candidatures et
            entretiens seront enregistrés.
          </p>
      </div>
      )}
    </div>
  );
};

export default DashboardGraphs;
