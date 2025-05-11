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
import { toast } from "react-hot-toast";

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
  const { isAuthenticated, token, role, user } = useSelector(
    (state) => state.auth
  );
  const { data, loading, error } = useSelector((state) => state.dashboard);
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [activeTab, setActiveTab] = useState("overview");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const dataFetched = useRef(false);
  const dataFetchInProgress = useRef(false);
  const initialLoadDone = useRef(false);
  const hasLoadedRef = useRef({
    overview: false,
    profile: false,
    jobs: false,
    candidates: false,
    interviews: false,
  });
  const [tabChangeInProgress, setTabChangeInProgress] = useState(false);
  const periodFetchInProgress = useRef(false);

  // Fonction pour gérer les erreurs d'authentification
  const handleAuthError = useCallback(() => {
    dispatch(resetAuthState());
    navigate("/login");
    toast.error("Session expirée ou non autorisée");
  }, [dispatch, navigate]);

  // Fonction pour gérer le changement de période
  const handlePeriodChange = useCallback(
    async (event) => {
      const newPeriod = event.target.value;
      console.log("Changement de période:", newPeriod);

      if (periodFetchInProgress.current) {
        console.log("Une requête de période est déjà en cours");
        return;
      }

      try {
        periodFetchInProgress.current = true;
        setSelectedPeriod(newPeriod);
        const result = await dispatch(
          fetchGraphData({ period: newPeriod })
        ).unwrap();
        console.log("Données reçues pour la période:", newPeriod, result);
      } catch (error) {
        console.error("Erreur lors du changement de période:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        periodFetchInProgress.current = false;
      }
    },
    [dispatch]
  );

  // Fonction pour charger les données initiales
  const loadInitialData = useCallback(async () => {
    if (initialLoadDone.current) {
      return;
    }

    if (!isAuthenticated || !token) {
      console.log("Redirection vers login - Non authentifié");
      navigate("/login");
      return;
    }

    if (!user || user.role !== "recruteur") {
      console.log("Redirection vers accueil - Rôle non autorisé:", user?.role);
      handleAuthError();
      return;
    }

    if (!dataFetched.current && !dataFetchInProgress.current) {
      console.log("Chargement initial des données du dashboard");
      dataFetchInProgress.current = true;
      try {
        // Charger les données initiales
        const result = await dispatch(fetchInitialData()).unwrap();
        console.log("Données initiales reçues:", result);
        dataFetched.current = true;
        initialLoadDone.current = true;

        // Charger les données du graphique pour la période initiale
        if (activeTab === "overview") {
          const graphResult = await dispatch(
            fetchGraphData({ period: selectedPeriod })
          ).unwrap();
          console.log("Données graphique initiales reçues:", graphResult);
          hasLoadedRef.current.overview = true;
        }

        // Charger les autres données nécessaires
        await Promise.all([
          dispatch(fetchOffres()).unwrap(),
          dispatch(fetchCandidates({ page: 1, per_page: 10 })).unwrap(),
          dispatch(fetchInterviews()).unwrap(),
          dispatch(fetchProfile()).unwrap(),
        ]);
      } catch (error) {
        console.error("Erreur lors du chargement des données:", error);
        toast.error("Erreur lors du chargement des données");
      } finally {
        dataFetchInProgress.current = false;
      }
    }
  }, [
    isAuthenticated,
    token,
    user,
    role,
    navigate,
    dispatch,
    handleAuthError,
    activeTab,
    selectedPeriod,
  ]);

  // Charger les données initiales une seule fois
  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Fonction pour gérer le changement d'onglet
  const handleTabChange = useCallback(
    async (tab) => {
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
        setActiveTab(tab);

        // Charger les données uniquement si elles n'ont pas déjà été chargées
        if (tab === "candidates" && !hasLoadedRef.current.candidates) {
          const result = await dispatch(
            fetchCandidates({ page: 1, per_page: 10 })
          ).unwrap();
          console.log("Données candidats reçues:", result);
          hasLoadedRef.current.candidates = true;
        } else if (tab === "overview" && !hasLoadedRef.current.overview) {
          const result = await dispatch(
            fetchGraphData({ period: selectedPeriod })
          ).unwrap();
          console.log("Données graphique reçues:", result);
          hasLoadedRef.current.overview = true;
        } else if (tab === "jobs" && !hasLoadedRef.current.jobs) {
          const result = await dispatch(fetchOffres()).unwrap();
          console.log("Données offres reçues:", result);
          hasLoadedRef.current.jobs = true;
        }

        setTimeout(() => {
          setTabChangeInProgress(false);
        }, 500);
      } catch (error) {
        console.error("Erreur lors du changement d'onglet:", error);
        toast.error("Erreur lors du chargement des données");
        setTabChangeInProgress(false);
      }
    },
    [
      activeTab,
      dispatch,
      selectedPeriod,
      tabChangeInProgress,
      user,
      handleAuthError,
    ]
  );

  // Charger les données du graphique quand la période change
  useEffect(() => {
    if (dataFetched.current && activeTab === "overview") {
      console.log(
        "Chargement des données du graphique pour la période:",
        selectedPeriod
      );
      dispatch(fetchGraphData({ period: selectedPeriod }));
    }
  }, [selectedPeriod, dispatch, activeTab]);

  const {
    profile,
    loading: profileLoading,
    error: profileError,
  } = useSelector((state) => state.profile);

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
      // Ne pas réinitialiser les flags lors du démontage
      // Cela permet de conserver l'état entre les navigations
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
