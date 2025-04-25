import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  User,
  ChevronLeft,
  Menu,
  Bell,
 
} from "lucide-react";
import {
  fetchInitialData,
  fetchGraphData,
  setActiveTab,
  toggleSidebar,
  closeSidebar,
  clearDashboardError,
  setSelectedPeriod,
} from "../store/recruteur/dashboardSlice";
import { useNavigate } from "react-router-dom";
import JobsSection from "./components/JobsSection";
import CandidatesSection from "./components/CandidatesSection";
import InterviewsSection from "./components/InterviewsSection";
import ProfileSection from "./components/ProfileSection";

import { Bar, Line, Pie } from "react-chartjs-2";
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
  ArcElement
);

const DashboardRecrutement = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    activeTab,
    isSidebarOpen,
    jobs,
    candidates,
    interviews,
    graphData,
    pagination,
    loading,
    error,
    selectedPeriod,
  } = useSelector((state) => state.dashboard);
  const { user, token, isAuthenticated } = useSelector((state) => state.auth);

  // Vérifier si l'utilisateur est authentifié
  useEffect(() => {
    if (!isAuthenticated || !token) {
      console.log("Utilisateur non authentifié, redirection vers la page de connexion");
      navigate("/login");
    }
  }, [isAuthenticated, token, navigate]);

  // Charger les données du dashboard si l'utilisateur est authentifié
  useEffect(() => {
    if (isAuthenticated && token) {
      console.log("Chargement des données du dashboard avec token:", token.substring(0, 15) + "...");
      dispatch(fetchInitialData({ page: 1, limit: 10 }));
    }
  }, [dispatch, token, isAuthenticated]);

  const handlePeriodChange = (period) => {
    dispatch(setSelectedPeriod(period));
    dispatch(fetchGraphData({ period }));
  };

  const menuItems = [
    {
      tab: "overview",
      label: "Vue d'ensemble",
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    { tab: "jobs", label: "Offres", icon: <Briefcase className="w-5 h-5" /> },
    {
      tab: "candidates",
      label: "Candidats",
      icon: <Users className="w-5 h-5" />,
    },
    {
      tab: "interviews",
      label: "Entretiens",
      icon: <Calendar className="w-5 h-5" />,
    },
    
    { tab: "profile", label: "Profil", icon: <User className="w-5 h-5" /> },
  ];

  const handleRetry = () => {
    dispatch(clearDashboardError());
    dispatch(fetchInitialData({ page: 1, limit: 10 }));
  };

  // Fonction pour gérer la déconnexion ou les problèmes d'authentification
  const handleAuthError = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  // Prepare chart data from graphData
  const chartData = useMemo(() => {
    if (!graphData) {
      return {
        weekly: { labels: [], candidates: [], interviews: [], jobs: [] },
        monthly: { labels: [], candidates: [], interviews: [] },
        status: { labels: [], data: [], backgroundColor: [] },
        interviewStatus: { labels: [], data: [], backgroundColor: [] },
      };
    }

    const weeklyLabels =
      selectedPeriod === "week" && graphData.candidates_by_date
        ? Object.keys(graphData.candidates_by_date).sort()
        : [];
    const monthlyLabels =
      selectedPeriod === "month" || selectedPeriod === "year"
        ? Object.keys(graphData.candidates_by_date || {}).sort()
        : [];

    return {
      weekly: {
        labels: weeklyLabels,
        candidates: weeklyLabels.map(
          (date) => graphData.candidates_by_date[date] || 0
        ),
        interviews: weeklyLabels.map(
          (date) => graphData.interviews_by_date[date] || 0
        ),
        jobs: weeklyLabels.map((date) => graphData.offers_by_date[date] || 0),
      },
      monthly: {
        labels: monthlyLabels,
        candidates: monthlyLabels.map(
          (date) => graphData.candidates_by_date[date] || 0
        ),
        interviews: monthlyLabels.map(
          (date) => graphData.interviews_by_date[date] || 0
        ),
      },
      status: {
        labels: Object.keys(graphData.status_distribution || {}),
        data: Object.values(graphData.status_distribution || {}),
        backgroundColor: [
          "rgba(54, 162, 235, 0.7)",
          "rgba(255, 206, 86, 0.7)",
          "rgba(75, 192, 192, 0.7)",
          "rgba(153, 102, 255, 0.7)",
          "rgba(255, 99, 132, 0.7)",
        ].slice(0, Object.keys(graphData.status_distribution || {}).length),
      },
      interviewStatus: {
        labels: Object.keys(graphData.interview_status_distribution || {}),
        data: Object.values(graphData.interview_status_distribution || {}),
        backgroundColor: [
          "rgba(54, 162, 235, 0.7)",
          "rgba(255, 206, 86, 0.7)",
          "rgba(75, 192, 192, 0.7)",
          "rgba(153, 102, 255, 0.7)",
          "rgba(255, 99, 132, 0.7)",
        ].slice(
          0,
          Object.keys(graphData.interview_status_distribution || {}).length
        ),
      },
    };
  }, [graphData, selectedPeriod]);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      tooltip: {
        mode: "index",
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
    maintainAspectRatio: false,
  };

  const renderContent = useMemo(() => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-teal-600"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-100/90 backdrop-blur-md text-red-700 p-6 rounded-2xl shadow-sm animate-fadeIn">
          <p>{error}</p>
          <button
            className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            onClick={handleRetry}
          >
            Réessayer
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case "overview":
        return (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">
                Vue d'ensemble
              </h2>
              <select
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="p-2 border rounded-lg"
              >
                <option value="week">Semaine</option>
                <option value="month">Mois</option>
                <option value="year">Année</option>
                <option value="all">Tout</option>
              </select>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300">
                <h3 className="text-lg font-semibold text-gray-800">
                  Offres Actives
                </h3>
                <p className="text-3xl font-bold text-teal-600">
                  {graphData?.offers || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {graphData?.offers > 0
                    ? "+5% vs période précédente"
                    : "Aucune offre"}
                </p>
              </div>
              <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300">
                <h3 className="text-lg font-semibold text-gray-800">
                  Candidatures
                </h3>
                <p className="text-3xl font-bold text-green-600">
                  {graphData?.candidates || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {graphData?.candidates > 0
                    ? "+12% vs période précédente"
                    : "Aucune candidature"}
                </p>
              </div>
              <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300">
                <h3 className="text-lg font-semibold text-gray-800">
                  Entretiens Planifiés
                </h3>
                <p className="text-3xl font-bold text-blue-600">
                  {graphData?.interviews || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {graphData?.interviews > 0
                    ? "+8% vs période précédente"
                    : "Aucun entretien"}
                </p>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weekly/Monthly Activity */}
              <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Activité{" "}
                  {selectedPeriod === "week"
                    ? "hebdomadaire"
                    : selectedPeriod === "month"
                    ? "mensuelle"
                    : "annuelle"}
                </h3>
                <div className="h-64">
                  <Line
                    data={{
                      labels: chartData.weekly.labels.length
                        ? chartData.weekly.labels
                        : chartData.monthly.labels,
                      datasets: [
                        {
                          label: "Candidatures",
                          data: chartData.weekly.labels.length
                            ? chartData.weekly.candidates
                            : chartData.monthly.candidates,
                          borderColor: "rgba(16, 185, 129, 0.8)",
                          backgroundColor: "rgba(16, 185, 129, 0.1)",
                          tension: 0.3,
                          fill: true,
                        },
                        {
                          label: "Entretiens",
                          data: chartData.weekly.labels.length
                            ? chartData.weekly.interviews
                            : chartData.monthly.interviews,
                          borderColor: "rgba(59, 130, 246, 0.8)",
                          backgroundColor: "rgba(59, 130, 246, 0.1)",
                          tension: 0.3,
                          fill: true,
                        },
                        selectedPeriod === "week"
                          ? {
                              label: "Offres",
                              data: chartData.weekly.jobs,
                              borderColor: "rgba(255, 99, 132, 0.8)",
                              backgroundColor: "rgba(255, 99, 132, 0.1)",
                              tension: 0.3,
                              fill: true,
                            }
                          : null,
                      ].filter(Boolean),
                    }}
                    options={chartOptions}
                  />
                </div>
              </div>

              {/* Candidate Status Distribution */}
              <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Statut des candidats
                </h3>
                <div className="h-64">
                  <Pie
                    data={{
                      labels: chartData.status.labels,
                      datasets: [
                        {
                          data: chartData.status.data,
                          backgroundColor: chartData.status.backgroundColor,
                          borderWidth: 1,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: "right",
                        },
                      },
                      maintainAspectRatio: false,
                    }}
                  />
                </div>
              </div>

              {/* Interview Status Distribution */}
              <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Statut des entretiens
                </h3>
                <div className="h-64">
                  <Pie
                    data={{
                      labels: chartData.interviewStatus.labels,
                      datasets: [
                        {
                          data: chartData.interviewStatus.data,
                          backgroundColor:
                            chartData.interviewStatus.backgroundColor,
                          borderWidth: 1,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      plugins: {
                        legend: {
                          position: "right",
                        },
                      },
                      maintainAspectRatio: false,
                    }}
                  />
                </div>
              </div>

              {/* Monthly Performance */}
              {selectedPeriod !== "week" && (
                <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-md lg:col-span-2">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Performance{" "}
                    {selectedPeriod === "month" ? "mensuelle" : "annuelle"}
                  </h3>
                  <div className="h-80">
                    <Bar
                      data={{
                        labels: chartData.monthly.labels,
                        datasets: [
                          {
                            label: "Candidatures",
                            data: chartData.monthly.candidates,
                            backgroundColor: "rgba(16, 185, 129, 0.7)",
                            borderRadius: 6,
                          },
                          {
                            label: "Entretiens",
                            data: chartData.monthly.interviews,
                            backgroundColor: "rgba(59, 130, 246, 0.7)",
                            borderRadius: 6,
                          },
                        ],
                      }}
                      options={{
                        ...chartOptions,
                        scales: {
                          y: {
                            beginAtZero: true,
                            stacked: false,
                            grid: {
                              color: "rgba(0, 0, 0, 0.05)",
                            },
                          },
                          x: {
                            stacked: false,
                            grid: {
                              display: false,
                            },
                          },
                        },
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case "jobs":
        return <JobsSection />;
      case "candidates":
        return <CandidatesSection />;
      case "interviews":
        return <InterviewsSection />;
      case "profile":
        return <ProfileSection />;
      default:
        return <div className="text-gray-700">Section non trouvée</div>;
    }
  }, [
    activeTab,
    loading,
    error,
    jobs,
    candidates,
    interviews,
    graphData,
    selectedPeriod,
    pagination,
  ]);

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform transition-all duration-300 ease-in-out bg-white/95 backdrop-blur-md shadow-lg
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:w-20 md:translate-x-0 md:hover:w-64 md:group`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100/50">
          <h1 className="text-xl font-extrabold text-gray-900 whitespace-nowrap transition-all duration-300 md:group-hover:opacity-100 md:opacity-0 bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">
            Recrutement AI
          </h1>
          <button
            className="p-2 rounded-full hover:bg-gray-100/50 md:hidden"
            onClick={() => dispatch(closeSidebar())}
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <nav className="p-3 space-y-1">
          {menuItems.map(({ tab, label, icon }) => (
            <button
              key={tab}
              onClick={() => {
                dispatch(setActiveTab(tab));
                window.innerWidth < 768 && dispatch(closeSidebar());
              }}
              className={`flex items-center w-full px-4 py-3 text-gray-700 rounded-xl transition-all duration-200
                hover:bg-teal-50 hover:text-teal-600 ${
                  activeTab === tab
                    ? "bg-teal-50 text-teal-600 font-semibold shadow-sm"
                    : ""
                }`}
            >
              <span className="flex-shrink-0 mr-3">{icon}</span>
              <span className="truncate transition-all duration-300 md:group-hover:opacity-100 md:opacity-0">
                {label}
              </span>
            </button>
          ))}
        </nav>
      </aside>

      <div
        className={`flex-1 transition-all duration-300 w-full ${
          isSidebarOpen ? "md:ml-0 ml-0" : "md:ml-20 ml-0"
        }`}
      >
        <header className="bg-white/95 backdrop-blur-md shadow-sm p-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center space-x-4 w-full max-w-full">
            <button
              onClick={() => dispatch(toggleSidebar())}
              className="text-gray-600 hover:text-teal-600 md:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">
              Dashboard de Recrutement
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <Bell className="text-gray-600 hover:text-teal-600 cursor-pointer w-5 h-5 sm:w-6 sm:h-6 transition-all duration-200" />
            <div className="hidden sm:flex items-center space-x-2">
              <User className="text-gray-600 w-5 h-5" />
              <span className="text-gray-800 font-medium">
                {user?.firstName || "Utilisateur"}
              </span>
            </div>
          </div>
        </header>

        <main className="p-6 sm:p-8">{renderContent}</main>
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/30 md:hidden"
          onClick={() => dispatch(closeSidebar())}
        />
      )}
    </div>
  );
};

export default DashboardRecrutement;
