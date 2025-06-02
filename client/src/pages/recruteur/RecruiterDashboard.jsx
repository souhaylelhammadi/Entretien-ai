import React, { useEffect, useRef, useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Calendar,
  User,
  ChevronLeft,
  Menu,
  LogOut,
} from "lucide-react";
import {
  fetchInitialData,
  fetchGraphData,
  fetchOffres,
  fetchProfile,
  fetchCandidates,
  fetchInterviews,
  setActiveTab,
  clearDashboardError,
  setSelectedPeriod,
} from "../store/recruteur/dashboardSlice";
import { useNavigate } from "react-router-dom";
import ProfileSection from "./components/ProfileSection";
import JobsSection from "./components/JobsSection";
import CandidatesSection from "./components/CandidatesSection";
import InterviewsSection from "./components/ent1";
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
  ThemeProvider,
  createTheme,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Avatar,
  Chip,
  IconButton,
} from "@mui/material";
import DashboardGraphs from "./components/DashboardGraphs.fixed";
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

// Theme aligned with Navbar colors
const modernTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#0d9488", // Teal-600
      dark: "#0f766e",
      light: "#14b8a6",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#2563eb", // Blue-600
      dark: "#1d4ed8",
      light: "#3b82f6",
      contrastText: "#ffffff",
    },
    background: {
      default: "#ffffff",
      paper: "#ffffff",
    },
    text: {
      primary: "#1f2937", // Gray-800
      secondary: "#4b5563", // Gray-600
    },
    divider: "#f3f4f6", // Gray-100
    grey: {
      50: "#f9fafb",
      100: "#f3f4f6",
      200: "#e5e7eb",
      300: "#d1d5db",
      400: "#9ca3af",
      500: "#6b7280",
      600: "#4b5563",
      700: "#374151",
      800: "#1f2937",
      900: "#111827",
    },
  },
  typography: {
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: { fontWeight: 800, fontSize: "2rem" },
    h5: { fontWeight: 700, fontSize: "1.5rem" },
    h6: { fontWeight: 600, fontSize: "1.125rem" },
    body1: { fontSize: "0.875rem", lineHeight: 1.6 },
    body2: { fontSize: "0.75rem", lineHeight: 1.5, color: "#4b5563" },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: "12px",
          textTransform: "none",
          fontWeight: 500,
          fontSize: "0.875rem",
          padding: "10px 20px",
          boxShadow: "none",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            boxShadow: "0 8px 25px rgba(0, 0, 0, 0.15)",
            transform: "translateY(-2px)",
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          border: "1px solid #f3f4f6",
          background: "#ffffff",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
          border: "1px solid #f3f4f6",
          transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          "&:hover": {
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
            transform: "translateY(-4px)",
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          borderRadius: "12px",
          background: "#f9fafb",
          border: "1px solid #f3f4f6",
          padding: "8px 12px",
          transition: "all 0.3s ease",
          "&:hover": { borderColor: "#e5e7eb" },
          "&.Mui-focused": {
            borderColor: "#0d9488",
            boxShadow: "0 0 0 3px rgba(13, 148, 136, 0.1)",
          },
        },
      },
    },
  },
});

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

  // Handle authentication errors
  const handleAuthError = useCallback(() => {
    dispatch(resetAuthState());
    navigate("/login");
    toast.error("Session expirée ou non autorisée");
  }, [dispatch, navigate]);

  

  // Load initial data
  const loadInitialData = useCallback(async () => {
    if (initialLoadDone.current) return;
    if (!isAuthenticated || !token) {
      navigate("/login");
      return;
    }
    if (!user || user.role !== "recruteur") {
      handleAuthError();
      return;
    }
    if (!dataFetched.current && !dataFetchInProgress.current) {
      dataFetchInProgress.current = true;
      try {
        await dispatch(fetchInitialData()).unwrap();
        dataFetched.current = true;
        initialLoadDone.current = true;
        if (activeTab === "overview") {
          await dispatch(fetchGraphData({ period: selectedPeriod })).unwrap();
          hasLoadedRef.current.overview = true;
        }
        await Promise.all([
          dispatch(fetchOffres()).unwrap(),
          dispatch(fetchCandidates({ page: 1, per_page: 10 })).unwrap(),
          dispatch(fetchInterviews()).unwrap(),
          dispatch(fetchProfile()).unwrap(),
        ]);
      } catch (error) {
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

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Handle tab change
  const handleTabChange = useCallback(
    async (tab) => {
      if (!user || user.role !== "recruteur") {
        handleAuthError();
        return;
      }
      if (tab === activeTab || tabChangeInProgress) return;
      try {
        setTabChangeInProgress(true);
        setActiveTab(tab);
        if (tab === "candidates" && !hasLoadedRef.current.candidates) {
          await dispatch(fetchCandidates({ page: 1, per_page: 10 })).unwrap();
          hasLoadedRef.current.candidates = true;
        } else if (tab === "overview" && !hasLoadedRef.current.overview) {
          await dispatch(fetchGraphData({ period: selectedPeriod })).unwrap();
          hasLoadedRef.current.overview = true;
        } else if (tab === "jobs" && !hasLoadedRef.current.jobs) {
          await dispatch(fetchOffres()).unwrap();
          hasLoadedRef.current.jobs = true;
        }
      } catch (error) {
        toast.error("Erreur lors du chargement des données");
      } finally {
        setTimeout(() => setTabChangeInProgress(false), 500);
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

 
  const {
    profile,
    loading: profileLoading,
    error: profileError,
  } = useSelector((state) => state.profile);

  const menuItems = [
    {
      tab: "overview",
      label: "Tableau de bord",
      icon: <LayoutDashboard className="w-5 h-5" />,
      badge: null,
    },
    {
      tab: "jobs",
      label: "Mes Offres",
      icon: <Briefcase className="w-5 h-5" />,
      badge: null,
    },
    {
      tab: "candidates",
      label: "Candidats",
      icon: <Users className="w-5 h-5" />,
      badge: null,
    },
    {
      tab: "interviews",
      label: "Entretiens",
      icon: <Calendar className="w-5 h-5" />,
      badge: null,
    },
    {
      tab: "profile",
      label: "Mon Profil",
      icon: <User className="w-5 h-5" />,
      badge: null,
    },
  ];

  const handleRetry = async () => {
    try {
      dispatch(clearDashboardError());
      dataFetched.current = false;
      Object.keys(hasLoadedRef.current).forEach((key) => {
        hasLoadedRef.current[key] = false;
      });
      await dispatch(fetchInitialData({ page: 1, limit: 10 })).unwrap();
      dataFetched.current = true;
      if (activeTab === "overview") {
        dispatch(fetchGraphData({ period: selectedPeriod }));
        hasLoadedRef.current.overview = true;
      }
    } catch (error) {
      if (
        error.includes("Session expired") ||
        error.includes("Authentication token not found")
      ) {
        handleAuthError();
      }
    }
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadInitialData();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    loadInitialData();
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loadInitialData]);

  const handleLogout = () => {
    dispatch(resetAuthState());
    navigate("/login");
    toast.success("Déconnexion réussie");
  };

  return (
    <ThemeProvider theme={modernTheme}>
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          bgcolor: "background.default",
        }}
      >
        {/* Sidebar */}
        <Box
          sx={{
            width: isSidebarOpen ? 280 : 0,
            maxWidth: "280px",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            overflow: "hidden",
            bgcolor: "background.paper",
            borderRight: "1px solid",
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            position: "fixed",
            top: 0,
            left: 0,
            height: "100vh",
            zIndex: 9999,
            boxShadow: "2px 0 20px rgba(0, 0, 0, 0.05)",
          }}
        >
          {/* Sidebar Header */}
          <Box
            sx={{
              p: 2,
              borderBottom: "1px solid",
              borderColor: "divider",
              bgcolor: "white",
              backdropFilter: "blur(10px)",
              position: "sticky",
              top: 0,
              zIndex: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "10px",
                  background: "linear-gradient(to right, #14b8a6, #2563eb)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(13, 148, 136, 0.3)",
                }}
              >
                <LayoutDashboard sx={{ fontSize: "1.25rem", color: "white" }} />
              </Box>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
              >
                Espace Recruteur
              </Typography>
            </Box>
          </Box>

          {/* Navigation */}
          <Box
            sx={{
              flex: 1,
              p: 2,
              bgcolor: "#ffffff",
              overflowY: "auto",
              "&::-webkit-scrollbar": {
                width: "4px",
              },
              "&::-webkit-scrollbar-track": {
                background: "#f1f1f1",
                borderRadius: "4px",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "#888",
                borderRadius: "4px",
                "&:hover": {
                  background: "#555",
                },
              },
            }}
          >
            {menuItems.map((item) => (
              <Button
                key={item.tab}
                onClick={() => handleTabChange(item.tab)}
                aria-label={`Navigate to ${item.label}`}
                sx={{
                  width: "100%",
                  justifyContent: "flex-start",
                  px: 2,
                  py: 1.5,
                  mb: 1,
                  borderRadius: "10px",
                  bgcolor:
                    activeTab === item.tab ? "primary.main" : "transparent",
                  color: activeTab === item.tab ? "white" : "text.secondary",
                  "&:hover": {
                    bgcolor:
                      activeTab === item.tab ? "primary.dark" : "grey.100",
                    transform: "translateX(4px)",
                  },
                  transition: "all 0.2s ease",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    width: "100%",
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "8px",
                      bgcolor:
                        activeTab === item.tab
                          ? "rgba(255,255,255,0.2)"
                          : "grey.100",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {React.cloneElement(item.icon, {
                      style: {
                        color: activeTab === item.tab ? "white" : "#4b5563",
                        width: "18px",
                        height: "18px",
                      },
                    })}
                  </Box>
                  <Typography
                    sx={{
                      fontWeight: activeTab === item.tab ? 600 : 500,
                      fontSize: "0.875rem",
                    }}
                  >
                    {item.label}
                  </Typography>
                  {item.badge && (
                    <Chip
                      label={item.badge}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        bgcolor:
                          activeTab === item.tab
                            ? "rgba(255,255,255,0.2)"
                            : "primary.main",
                        color: "white",
                        ml: "auto",
                      }}
                    />
                  )}
                </Box>
              </Button>
            ))}
          </Box>

          {/* Profile Section */}
          <Box sx={{ p: 2, borderTop: "1px solid", borderColor: "divider" }}>
            <Card
              sx={{
                p: 2,
                bgcolor: "grey.50",
                border: "1px solid",
                borderColor: "divider",
                boxShadow: "none",
              }}
            >
              <Box
                sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}
              >
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: "primary.main",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                  }}
                >
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      color: "text.primary",
                    }}
                  >
                    {user?.name || "Utilisateur"}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.secondary",
                      fontSize: "0.75rem",
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {user?.email || "user@example.com"}
                  </Typography>
                </Box>
              </Box>
              <Button
                fullWidth
                onClick={handleLogout}
                startIcon={<LogOut size={16} />}
                sx={{
                  color: "text.secondary",
                  bgcolor: "transparent",
                  borderRadius: "8px",
                  py: 1,
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  "&:hover": { bgcolor: "grey.100", color: "text.primary" },
                }}
              >
                Se déconnecter
              </Button>
            </Card>
          </Box>
        </Box>

        {/* Main Content */}
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.default",
            marginLeft: isSidebarOpen ? "280px" : 0,
            transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            width: `calc(100% - ${isSidebarOpen ? "280px" : "0px"})`,
            minHeight: "100vh",
            position: "relative",
          }}
        >
          {/* Content Area */}
          <Box
            sx={{
              flex: 1,
              p: 4,
              bgcolor: "background.default",
              overflow: "auto",
              height: "100vh",
              paddingTop: "80px",
            }}
          >
            {!isSidebarOpen && (
              <Box sx={{ mb: 3 }}>
                <IconButton
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open sidebar"
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: "10px",
                    bgcolor: "grey.100",
                    color: "text.secondary",
                    "&:hover": { bgcolor: "grey.200", color: "text.primary" },
                  }}
                >
                  <Menu sx={{ fontSize: "1.25rem" }} />
                </IconButton>
              </Box>
            )}
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
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                     
                      
                    </Box>
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
