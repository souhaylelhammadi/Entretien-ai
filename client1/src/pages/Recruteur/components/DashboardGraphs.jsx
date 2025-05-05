import React, { useMemo } from "react";
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

const colorPalette = {
  primary: ["rgba(59, 130, 246, 0.7)", "rgba(59, 130, 246, 1)"], // Bleu
  secondary: ["rgba(233, 88, 125, 0.7)", "rgba(233, 88, 125, 1)"], // Rose
  tertiary: ["rgba(16, 185, 129, 0.7)", "rgba(16, 185, 129, 1)"], // Vert
  accent1: ["rgba(245, 158, 11, 0.7)", "rgba(245, 158, 11, 1)"], // Orange
  accent2: ["rgba(139, 92, 246, 0.7)", "rgba(139, 92, 246, 1)"], // Violet
  accent3: ["rgba(236, 72, 153, 0.7)", "rgba(236, 72, 153, 1)"], // Rose vif
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
  // Extraire graphData de data de façon sécurisée
  const graphData = data?.graphData || {};
  const daysToShow = period === "week" ? 7 : period === "month" ? 30 : 12;

  // Vérifier si nous avons des données
  const hasData = useMemo(() => {
    // Vérifier si graphData existe
    if (!graphData) {
      console.log("Aucune donnée graphData disponible");
      return false;
    }

    const hasCandidates =
      graphData.candidatesByDate && Object.keys(graphData.candidatesByDate).length > 0;
    const hasInterviews =
      graphData.interviewsByDate && Object.keys(graphData.interviewsByDate).length > 0;
    const hasStatus =
      graphData.statusDistribution && 
      Object.keys(graphData.statusDistribution).length > 0 && 
      !Object.keys(graphData.statusDistribution).includes("Pas de données");
    const hasInterviewStatus =
      graphData.interviewStatusDistribution && 
      Object.keys(graphData.interviewStatusDistribution).length > 0 && 
      !Object.keys(graphData.interviewStatusDistribution).includes("Pas de données");
    const hasOffersByDept =
      graphData.offresByDepartment && 
      Object.keys(graphData.offresByDepartment).length > 0;

    console.log("Données disponibles:", {
      hasCandidates,
      hasInterviews,
      hasStatus,
      hasInterviewStatus,
      hasOffersByDept
    });

    // Afficher les graphiques si nous avons au moins un type de données valide
    return hasCandidates || hasInterviews || hasStatus || hasInterviewStatus || hasOffersByDept;
  }, [graphData]);

  // Utiliser useMemo pour éviter de recalculer les données à chaque rendu
  const activityData = useMemo(() => {
    console.log("Préparation des données d'activité");
    const candidatesByDate = graphData?.candidatesByDate || {};
    const interviewsByDate = graphData?.interviewsByDate || {};

    // Générer des dates pour l'axe X
    const { dates, labels } = generateDateRange(daysToShow - 1);

    // Préparation des données en favorisant les données réelles
    const candidatesData = dates.map((date) => {
      // Utiliser la valeur réelle si elle existe, sinon zéro (pas de simulation)
      return candidatesByDate[date] || 0;
    });

    const interviewsData = dates.map((date) => {
      // Utiliser la valeur réelle si elle existe, sinon zéro (pas de simulation)
      return interviewsByDate[date] || 0;
    });

    console.log("Données des candidats:", candidatesData);
    console.log("Données des entretiens:", interviewsData);

    return {
      labels: labels,
      datasets: [
        {
          label: "Candidats",
          data: candidatesData,
          backgroundColor: colorPalette.primary[0],
          borderColor: colorPalette.primary[1],
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: colorPalette.primary[1],
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
        {
          label: "Entretiens",
          data: interviewsData,
          backgroundColor: colorPalette.secondary[0],
          borderColor: colorPalette.secondary[1],
          tension: 0.4,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: colorPalette.secondary[1],
          pointBorderColor: "#fff",
          pointBorderWidth: 2,
        },
      ],
    };
  }, [graphData, daysToShow]);

  // Préparer les données pour le graphique de distribution des statuts
  const statusData = useMemo(() => {
    console.log("Préparation des données de statut");
    // Utiliser uniquement les données réelles, avec un message par défaut si vide
    const statusDistribution = graphData?.statusDistribution || {
      "Aucune donnée": 1,
    };

    const labels = Object.keys(statusDistribution);
    const data = Object.values(statusDistribution);

    console.log("Statuts des candidats:", statusDistribution);

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            colorPalette.primary[0],
            colorPalette.tertiary[0],
            colorPalette.secondary[0],
            colorPalette.accent1[0],
            colorPalette.accent2[0],
          ],
          borderColor: [
            colorPalette.primary[1],
            colorPalette.tertiary[1],
            colorPalette.secondary[1],
            colorPalette.accent1[1],
            colorPalette.accent2[1],
          ],
          borderWidth: 1,
          hoverOffset: 10,
        },
      ],
    };
  }, [graphData]);

  // Préparer les données pour le graphique des entretiens
  const interviewStatusData = useMemo(() => {
    console.log("Préparation des données de statut d'entretien");
    // Utiliser uniquement les données réelles, avec un message par défaut si vide
    const interviewStatusDistribution =
      graphData?.interviewStatusDistribution || { "Aucune donnée": 1 };

    const labels = Object.keys(interviewStatusDistribution);
    const data = Object.values(interviewStatusDistribution);

    console.log("Statuts des entretiens:", interviewStatusDistribution);

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor: [
            colorPalette.accent1[0],
            colorPalette.tertiary[0],
            colorPalette.secondary[0],
            colorPalette.accent2[0],
          ],
          borderColor: [
            colorPalette.accent1[1],
            colorPalette.tertiary[1],
            colorPalette.secondary[1],
            colorPalette.accent2[1],
          ],
          borderWidth: 1,
          hoverOffset: 10,
        },
      ],
    };
  }, [graphData]);

  // Données pour le graphique d'offres par département
  const jobsByDepartment = useMemo(() => {
    console.log("Préparation des données d'offres par département");

    // Utiliser les données réelles si disponibles
    if (
      graphData?.offresByDepartment &&
      Object.keys(graphData.offresByDepartment).length > 0
    ) {
      const labels = Object.keys(graphData.offresByDepartment);
      const data = Object.values(graphData.offresByDepartment);

      console.log(
        "Offres par département (données réelles):",
        graphData.offresByDepartment
      );

      return {
        labels,
        datasets: [
          {
            label: "Offres par département",
            data,
            backgroundColor: Object.values(colorPalette).map((c) => c[0]),
            borderColor: Object.values(colorPalette).map((c) => c[1]),
            borderWidth: 1,
          },
        ],
      };
    }

    // Extraire les départements des offres si offresByDepartment n'est pas disponible
    if (data.offres && data.offres.length > 0) {
      // Compter les offres par département
      const departmentCounts = {};
      data.offres.forEach((offre) => {
        const dept = offre.departement || offre.localisation || "Non spécifié";
        departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
      });

      const labels = Object.keys(departmentCounts);
      const counts = Object.values(departmentCounts);

      console.log("Offres par département (calculées):", departmentCounts);

      return {
        labels,
        datasets: [
          {
            label: "Offres par département",
            data: counts,
            backgroundColor: Object.values(colorPalette)
              .map((c) => c[0])
              .slice(0, labels.length),
            borderColor: Object.values(colorPalette)
              .map((c) => c[1])
              .slice(0, labels.length),
            borderWidth: 1,
          },
        ],
      };
    }

    // Fallback avec un message d'absence de données
    return {
      labels: ["Aucune donnée"],
      datasets: [
        {
          label: "Offres par département",
          data: [1],
          backgroundColor: [colorPalette.primary[0]],
          borderColor: [colorPalette.primary[1]],
          borderWidth: 1,
        },
      ],
    };
  }, [graphData, data.offres]);

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
            {data?.newCandidates || 0}
          </p>
          <p className="text-xs text-blue-600 mt-1">Nouvelles candidatures</p>
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
            {data?.conversionRate?.toFixed(1) || "0.0"}%
          </p>
          <p className="text-xs text-purple-600 mt-1">Candidats embauchés</p>
        </div>
      </div>

      {hasData ? (
        /* Graphiques avec données réelles */
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
              <Doughnut data={statusData} options={pieChartOptions} />
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
      ) : (
        /* Message en cas d'absence de données */
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
