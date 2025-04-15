import React, { useEffect } from "react";
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
} from "../store/recruteur/dashboardSlice";
import JobsSection from "./components/JobsSection";
import CandidatesSection from "./components/CandidatesSection";
import InterviewsSection from "./components/InterviewsSection";
import ProfileSection from "./components/ProfileSection";

const DashboardRecrutement = () => {
  const dispatch = useDispatch();
  const {
    activeTab,
    isSidebarOpen,
    jobs,
    candidates,
    interviews,
    loading,
    error,
  } = useSelector((state) => state.dashboard);

  useEffect(() => {
    dispatch(fetchInitialData());
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

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">{error}</div>
      );
    }

    switch (activeTab) {
      case "overview":
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">
              Vue d'ensemble
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm">
                <h3 className="text-lg font-medium text-gray-800">
                  Offres Actives
                </h3>
                <p className="text-2xl font-bold text-blue-600">
                  {jobs.length}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm">
                <h3 className="text-lg font-medium text-gray-800">
                  Candidatures
                </h3>
                <p className="text-2xl font-bold text-green-600">
                  {candidates.length}
                </p>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm">
                <h3 className="text-lg font-medium text-gray-800">
                  Entretiens Planifiés
                </h3>
                <p className="text-2xl font-bold text-purple-600">
                  {interviews.length}
                </p>
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
        return <div>Section non trouvée</div>;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform transition-all duration-300 ease-in-out bg-white shadow-lg
          ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } md:w-20 md:translate-x-0 md:hover:w-64 md:group`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900 whitespace-nowrap transition-all duration-300 md:group-hover:opacity-100 md:opacity-0">
            Recrutement AI
          </h1>
          <button
            className="p-2 rounded-full hover:bg-gray-100 md:hidden"
            onClick={() => dispatch(closeSidebar())}
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <nav className="p-2 space-y-1">
          {menuItems.map(({ tab, label, icon }) => (
            <button
              key={tab}
              onClick={() => {
                dispatch(setActiveTab(tab));
                window.innerWidth < 768 && dispatch(closeSidebar());
              }}
              className={`flex items-center w-full px-4 py-3 text-gray-700 rounded-lg transition-all duration-200
                hover:bg-blue-50 hover:text-blue-600 ${
                  activeTab === tab
                    ? "bg-blue-50 text-blue-600 font-semibold shadow-sm"
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
        <header className="bg-white shadow-sm p-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center space-x-4 w-full max-w-full">
            <button
              onClick={() => dispatch(toggleSidebar())}
              className="text-gray-600 hover:text-gray-800 md:hidden"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">
              Dashboard de Recrutement
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <Bell className="text-gray-600 hover:text-gray-800 cursor-pointer w-5 h-5 sm:w-6 sm:h-6" />
            <div className="hidden sm:flex items-center space-x-2">
              <User className="text-gray-600 w-5 h-5" />
              <span className="text-gray-800 font-medium">Utilisateur</span>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">{renderContent()}</main>
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-10 bg-black bg-opacity-30 md:hidden"
          onClick={() => dispatch(closeSidebar())}
        />
      )}
    </div>
  );
};

export default DashboardRecrutement;
