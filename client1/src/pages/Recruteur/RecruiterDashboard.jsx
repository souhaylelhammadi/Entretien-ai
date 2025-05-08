import React, {
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useState,
} from "react";
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
  const isInitialMount = useRef(true);
  const dataFetched = useRef(false);
  const dataFetchInProgress = useRef(false);
  const tabTimeoutRef = useRef(null);
  const [tabChangeInProgress, setTabChangeInProgress] = useState(false);

  // Référence pour suivre les onglets déjà chargés
  const hasLoadedRef = useRef({
    overview: false,
    profile: false,
    jobs: false,
    candidates: false,
    interviews: false,
  });

  // Référence pour les timers de debounce
  const debounceTimersRef = useRef({});

  const {
    activeTab,
    isSidebarOpen,
    loading,
    error,
    selectedPeriod = "week",
    data,
  } = useSelector((state) => state.dashboard);

  const { user, token, isAuthenticated, role } = useSelector(
    (state) => state.auth
  );

  // Vérifier l'authentification et le rôle
  useEffect(() => {
    console.log("État d'authentification:", {
      isAuthenticated,
      token,
      role,
      user,
    });

    if (!isAuthenticated || !token) {
      console.log("Redirection vers login - Non authentifié");
      navigate("/login");
      return;
    }

    // Vérifier le rôle dans l'objet user
    if (!user || user.role !== "recruteur") {
      console.log("Redirection vers accueil - Rôle non autorisé:", user?.role);
      // Déconnexion et redirection
      handleAuthError();
      return;
    }

    // S'assurer que le token est dans le localStorage
    if (!localStorage.getItem("token")) {
      localStorage.setItem("token", token);
    }

    // S'assurer que l'ID du recruteur est dans le localStorage
    if (!localStorage.getItem("userId") && user.id) {
      localStorage.setItem("userId", user.id);
    }

    // Si tout est correct, charger les données initiales
    if (!dataFetched.current && !dataFetchInProgress.current) {
      console.log("Chargement initial des données du dashboard");
      dispatch(fetchInitialData());
    }
  }, [isAuthenticated, token, user, role, navigate, dispatch]);

  // Charger les données initiales
  useEffect(() => {
    const fetchData = async () => {
      if (
        isAuthenticated &&
        token &&
        !dataFetched.current &&
        !dataFetchInProgress.current
      ) {
        console.log("Chargement des données initiales du dashboard");

        try {
          dataFetchInProgress.current = true;

          // Charger les données initiales
          await dispatch(fetchInitialData()).unwrap();
          console.log("Initial data fetched successfully");
          dataFetched.current = true;

          // Charger les données de l'onglet actif
          if (activeTab === "overview") {
            dispatch(fetchGraphData({ period: selectedPeriod }));
            hasLoadedRef.current.overview = true;
          } else if (activeTab === "candidates") {
            dispatch(fetchCandidates({ page: 1, per_page: 10 }));
            hasLoadedRef.current.candidates = true;
          }
        } catch (error) {
          console.error("Error fetching initial data:", error);
          if (
            error?.includes("Session expired") ||
            error?.includes("Authentication token not found")
          ) {
            handleAuthError();
          }
        } finally {
          dataFetchInProgress.current = false;
        }
      }
    };

    fetchData();
  }, [isAuthenticated, token, dispatch, activeTab, selectedPeriod]);

  const handleAuthError = () => {
    console.log("Erreur d'authentification - Déconnexion");
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    dispatch(resetAuthState());
    navigate("/login");
  };

  const handleTabChange = useCallback(
    (tab) => {
      if (!user || user.role !== "recruteur") {
        handleAuthError();
        return;
      }

      if (tab === activeTab) {
        return;
      }

      if (tabChangeInProgress) {
        console.log(
          "Changement d'onglet ignoré: un autre changement est déjà en cours"
        );
        return;
      }

      try {
        setTabChangeInProgress(true);
        dispatch(setActiveTab(tab));

        if (tab === "candidates" && !hasLoadedRef.current.candidates) {
          dispatch(fetchCandidates({ page: 1, per_page: 10 }));
          hasLoadedRef.current.candidates = true;
        } else if (tab === "overview" && !hasLoadedRef.current.overview) {
          dispatch(fetchGraphData({ period: selectedPeriod }));
          hasLoadedRef.current.overview = true;
        } else if (tab === "jobs" && !hasLoadedRef.current.jobs) {
          dispatch(fetchOffres());
          hasLoadedRef.current.jobs = true;
        }

        setTimeout(() => {
          setTabChangeInProgress(false);
        }, 500);
      } catch (error) {
        console.error("Erreur lors du changement d'onglet:", error);
        setTabChangeInProgress(false);
      }
    },
    [activeTab, dispatch, selectedPeriod, tabChangeInProgress, user]
  );

  const {
    profile,
    loading: profileLoading,
    error: profileError,
  } = useSelector((state) => state.profile);

  const handlePeriodChange = (event) => {
    const newPeriod = event.target.value;
    console.log("Changement de période:", newPeriod);
    dispatch(setSelectedPeriod(newPeriod));
    // L'useEffect se chargera de mettre à jour les données pour la nouvelle période
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
      // Réinitialiser les états d'erreur et les drapeaux de suivi
      dispatch(clearDashboardError());
      dataFetched.current = false;

      // Réinitialiser tous les drapeaux de chargement des onglets
      Object.keys(hasLoadedRef.current).forEach((key) => {
        hasLoadedRef.current[key] = false;
      });

      // Recharger les données initiales
      const result = await dispatch(
        fetchInitialData({ page: 1, limit: 10 })
      ).unwrap();
      console.log("Data fetched successfully:", result);

      // Mettre à jour le drapeau de données chargées
      dataFetched.current = true;

      // Charger les graphiques si nécessaire
      if (activeTab === "overview") {
      dispatch(fetchGraphData({ period: selectedPeriod }));
        hasLoadedRef.current.overview = true;
      }
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

  // Nettoyage lors du démontage du composant
  useEffect(() => {
    return () => {
      // Nettoyer tous les timers de debounce
      Object.values(debounceTimersRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

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
