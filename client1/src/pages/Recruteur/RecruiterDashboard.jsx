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
  fetchGraphData,
  fetchOffres,
  fetchProfile,
  fetchCandidates,
  fetchInterviews,
  setActiveTab,
  toggleSidebar,
  closeSidebar,
  clearDashboardError,
  setSelectedPeriod,
  resetProfile,
} from "../store/recruteur/dashboardSlice";
import { useNavigate } from "react-router-dom";
import ProfileSection from "./components/ProfileSection";
import JobsSection from "./components/JobsSection";
import CandidatesSection from "./components/CandidatesSection";
import InterviewsSection from "./components/InterviewsSection";
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
  Filler,
} from "chart.js";
import { resetAuthState } from "../store/auth/authSlice";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  ThemeProvider,
  createTheme,
  Grid,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  People as PeopleIcon,
  Work as WorkIcon,
  Event as EventIcon,
  TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";
import DashboardGraphs from "./components/DashboardGraphs";

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
  Filler
);

// Créer un thème par défaut
const defaultTheme = createTheme();

const RecruiterDashboard = () => {
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
    selectedPeriod = "week",
    data,
  } = useSelector((state) => state.dashboard);
  const { user, token, isAuthenticated } = useSelector((state) => state.auth);
  const {
    profile,
    loading: profileLoading,
    error: profileError,
  } = useSelector((state) => state.profile);

  // Vérifier si l'utilisateur est authentifié
  useEffect(() => {
    if (!isAuthenticated || !token) {
      console.log(
        "Utilisateur non authentifié, redirection vers la page de connexion"
      );
      navigate("/login");
    }
  }, [isAuthenticated, token, navigate]);

  // Charger les données du dashboard si l'utilisateur est authentifié
  useEffect(() => {
    const fetchData = async () => {
      if (isAuthenticated && token) {
        console.log("Chargement des données du dashboard");
        console.log("Token:", token);
        try {
          // Ensure token is stored in localStorage
          if (!localStorage.getItem("token")) {
            localStorage.setItem("token", token);
          }

          const result = await dispatch(
            fetchInitialData({ page: 1, limit: 10 })
          ).unwrap();
          console.log("Initial data fetched:", result);
          // Charger les données des graphiques après le chargement initial
          dispatch(fetchGraphData({ period: selectedPeriod }));
        } catch (error) {
          console.error("Error fetching initial data:", error);
          if (
            error.includes("Session expired") ||
            error.includes("Authentication token not found")
          ) {
            handleAuthError();
          }
        }
      }
    };

    fetchData();
  }, [dispatch, isAuthenticated, token, navigate, selectedPeriod]);

  // Effect to fetch profile data when switching to profile tab
  useEffect(() => {
    const fetchProfileData = async () => {
      if (activeTab === "profile" && isAuthenticated && token) {
        console.log("Fetching profile data for profile tab");
        try {
          if (!profile && !profileLoading) {
            await dispatch(fetchProfile()).unwrap();
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
          if (
            error.includes("Session expired") ||
            error.includes("Authentication token not found")
          ) {
            handleAuthError();
          }
        }
      }
    };

    fetchProfileData();
  }, [activeTab, dispatch, isAuthenticated, token, profile, profileLoading]);

  const handlePeriodChange = (event) => {
    dispatch(setSelectedPeriod(event.target.value));
    dispatch(fetchGraphData({ period: event.target.value }));
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

  const handleRetry = async () => {
    try {
      dispatch(clearDashboardError());
      const result = await dispatch(
        fetchInitialData({ page: 1, limit: 10 })
      ).unwrap();
      console.log("Data fetched successfully:", result);
      dispatch(fetchGraphData({ period: selectedPeriod }));
    } catch (error) {
      console.error("Error fetching data:", error);
      if (
        error.includes("Session expired") ||
        error.includes("Authentication token not found")
      ) {
        handleAuthError();
      }
    }
  };

  const handleAuthError = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    dispatch(resetAuthState());
    navigate("/login");
  };

  // Handle tab change
  const handleTabChange = (tab) => {
    // Éviter de recharger le même onglet
    if (tab === activeTab) {
      return;
    }

    dispatch(setActiveTab(tab));

    if (tab === "profile") {
      if (!profile && !profileLoading) {
        dispatch(fetchProfile());
      }
    } else if (tab === "overview") {
      dispatch(fetchGraphData({ period: selectedPeriod }));
    } else if (tab === "jobs") {
      dispatch(fetchOffres());
    } else if (tab === "candidates") {
      // Always fetch first page when switching to candidates tab
      dispatch(fetchCandidates({ page: 1, per_page: 10 }));
    } else if (tab === "interviews") {
      dispatch(fetchInterviews({ page: 1, per_page: 10 }));
    }
  };

  return (
    <ThemeProvider theme={defaultTheme}>
      <Box sx={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar */}
        <Box
          sx={{
            width: isSidebarOpen ? 240 : 0,
            transition: "width 0.3s",
            overflow: "hidden",
            bgcolor: "background.paper",
            borderRight: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              p: 2,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h6">Recrutement AI</Typography>
            <Button onClick={() => dispatch(closeSidebar())}>
              <ChevronLeft />
            </Button>
          </Box>
          {menuItems.map((item) => (
            <Button
              key={item.tab}
              onClick={() => handleTabChange(item.tab)}
              sx={{
                width: "100%",
                justifyContent: "flex-start",
                px: 3,
                py: 1.5,
                color:
                  activeTab === item.tab ? "primary.main" : "text.secondary",
                bgcolor:
                  activeTab === item.tab ? "action.selected" : "transparent",
              }}
            >
              {item.icon}
              <Typography sx={{ ml: 2 }}>{item.label}</Typography>
            </Button>
          ))}
        </Box>

        {/* Main content */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <Box
            sx={{
              p: 2,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Button onClick={() => dispatch(toggleSidebar())}>
              <Menu />
            </Button>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Bell />
              <Typography>{user?.name || "Utilisateur"}</Typography>
            </Box>
          </Box>

          {/* Content area */}
          <Box sx={{ flex: 1, p: 3, overflow: "auto" }}>
            {loading || profileLoading ? (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  minHeight: "50vh",
                }}
              >
                <CircularProgress />
              </Box>
            ) : error || profileError ? (
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={handleRetry}>
                    Réessayer
                  </Button>
                }
              >
                {error || profileError}
              </Alert>
            ) : (
              <>
                {activeTab === "overview" && (
                  <Box>
                    <FormControl sx={{ mb: 3, minWidth: 120 }}>
                      <InputLabel>Période</InputLabel>
                      <Select
                        value={selectedPeriod || "week"}
                        onChange={handlePeriodChange}
                        label="Période"
                      >
                        <MenuItem value="week">7 derniers jours</MenuItem>
                        <MenuItem value="month">30 derniers jours</MenuItem>
                        <MenuItem value="year">12 derniers mois</MenuItem>
                      </Select>
                    </FormControl>
                    <DashboardGraphs
                      data={data}
                      period={selectedPeriod || "week"}
                    />
                  </Box>
                )}
                {activeTab === "jobs" && <JobsSection />}
                {activeTab === "candidates" && <CandidatesSection />}
                {activeTab === "interviews" && <InterviewsSection />}
                {activeTab === "profile" && <ProfileSection />}
              </>
            )}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default RecruiterDashboard;
