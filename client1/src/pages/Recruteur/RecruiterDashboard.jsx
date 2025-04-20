import React, { useEffect, useMemo } from "react";
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
  setActiveTab,
  toggleSidebar,
  closeSidebar,
  clearDashboardError,
} from "../store/recruteur/dashboardSlice";
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

// Enregistrer les composants nécessaires de Chart.js
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
  const {
    activeTab,
    isSidebarOpen,
    jobs,
    candidates,
    interviews,
    pagination,
    loading,
    error,
  } = useSelector((state) => state.dashboard);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(fetchInitialData({ page: 1, limit: 10 }));
  }, [dispatch]);

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
    dispatch(
      fetchInitialData({
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
      })
    );
  };

  // Données simulées pour les graphiques (à remplacer par vos vraies données)
  const weeklyData = {
    labels: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
    candidates: [12, 19, 8, 15, 12, 5, 9],
    interviews: [3, 5, 2, 6, 4, 1, 2],
    jobs: [2, 3, 1, 4, 2, 0, 1],
  };

  const monthlyData = {
    labels: ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"],
    candidates: [85, 92, 78, 105, 120, 95, 110, 98, 115, 130, 125, 140],
    interviews: [25, 30, 22, 35, 40, 28, 32, 29, 38, 42, 39, 45],
  };

  const statusDistribution = {
    labels: ["Nouveau", "En revue", "Entretien", "Embauché", "Rejeté"],
    data: [35, 25, 20, 10, 10],
    backgroundColor: [
      "rgba(54, 162, 235, 0.7)",
      "rgba(255, 206, 86, 0.7)",
      "rgba(75, 192, 192, 0.7)",
      "rgba(153, 102, 255, 0.7)",
      "rgba(255, 99, 132, 0.7)",
    ],
  };

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

    const total = pagination?.total || 0;

    switch (activeTab) {
      case "overview":
        return (
          <div className="space-y-6 animate-fadeIn">
            <h2 className="text-2xl font-bold text-gray-800">Vue d'ensemble</h2>
            
            {/* Cartes de statistiques */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300">
                <h3 className="text-lg font-semibold text-gray-800">
                  Offres Actives
                </h3>
                <p className="text-3xl font-bold text-teal-600">
                  {jobs?.length || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">+5% vs mois dernier</p>
              </div>
              <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300">
                <h3 className="text-lg font-semibold text-gray-800">
                  Candidatures
                </h3>
                <p className="text-3xl font-bold text-green-600">
                  {candidates?.length || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">+12% vs semaine dernière</p>
              </div>
              <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300">
                <h3 className="text-lg font-semibold text-gray-800">
                  Entretiens Planifiés
                </h3>
                <p className="text-3xl font-bold text-blue-600">
                  {interviews?.length || 0}
                </p>
                <p className="text-sm text-gray-500 mt-1">+8% vs semaine dernière</p>
              </div>
            </div>

            {/* Graphiques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Activité hebdomadaire */}
              <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Activité hebdomadaire</h3>
                <div className="h-64">
                  <Line
                    data={{
                      labels: weeklyData.labels,
                      datasets: [
                        {
                          label: "Candidatures",
                          data: weeklyData.candidates,
                          borderColor: "rgba(16, 185, 129, 0.8)",
                          backgroundColor: "rgba(16, 185, 129, 0.1)",
                          tension: 0.3,
                          fill: true,
                        },
                        {
                          label: "Entretiens",
                          data: weeklyData.interviews,
                          borderColor: "rgba(59, 130, 246, 0.8)",
                          backgroundColor: "rgba(59, 130, 246, 0.1)",
                          tension: 0.3,
                          fill: true,
                        },
                      ],
                    }}
                    options={chartOptions}
                  />
                </div>
              </div>

              {/* Répartition des candidats */}
              <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-md">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Statut des candidats</h3>
                <div className="h-64">
                  <Pie
                    data={{
                      labels: statusDistribution.labels,
                      datasets: [
                        {
                          data: statusDistribution.data,
                          backgroundColor: statusDistribution.backgroundColor,
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

              {/* Performance mensuelle */}
              <div className="bg-white/95 backdrop-blur-md p-6 rounded-2xl shadow-md lg:col-span-2">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance mensuelle</h3>
                <div className="h-80">
                  <Bar
                    data={{
                      labels: monthlyData.labels,
                      datasets: [
                        {
                          label: "Candidatures",
                          data: monthlyData.candidates,
                          backgroundColor: "rgba(16, 185, 129, 0.7)",
                          borderRadius: 6,
                        },
                        {
                          label: "Entretiens",
                          data: monthlyData.interviews,
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
  }, [activeTab, loading, error, jobs, candidates, interviews, pagination]);

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      {/* Le reste du code reste inchangé */}
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