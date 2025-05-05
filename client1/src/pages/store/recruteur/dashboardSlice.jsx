import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../services/api";
import { getCleanToken } from "../../../utils/tokenUtils";

// Fonction utilitaire pour obtenir le token
const getToken = () => {
  return getCleanToken();
};

// Thunk pour récupérer les données initiales
export const fetchInitialData = createAsyncThunk(
  "dashboard/fetchInitialData",
  async (_, { rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return rejectWithValue("Token non trouvé");
      }

      // Utilisation du nouvel endpoint qui retourne les données filtrées par recruteur
      const response = await api.get("/api/recruteur/dashboard/init", {
        headers: { Authorization: token },
      });

      console.log("Initial dashboard data received:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error fetchInitialData:", error);
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la récupération des données"
      );
    }
  }
);

// Thunk pour récupérer les données du graphique
export const fetchGraphData = createAsyncThunk(
  "dashboard/fetchGraphData",
  async ({ period }, { rejectWithValue }) => {
    try {
      console.log(`Fetching graph data for period: ${period}`);
      const token = getToken();
      if (!token) {
        return rejectWithValue("Token non trouvé");
      }

      // Utiliser également le nouvel endpoint avec le paramètre period
      const response = await api.get("/api/recruteur/dashboard/init", {
        params: { period },
        headers: { Authorization: token },
      });

      // Formatage des données reçues
      const data = response.data;
      console.log("Dashboard graph data received:", data);

      // Structure de base pour les graphiques avec les données reçues
      return {
        activeJobs: data.activeJobs || 0,
        newCandidates: data.newCandidates || 0,
        totalJobs: data.totalJobs || 0,
        totalCandidates: data.totalCandidates || 0,
        totalInterviews: data.totalInterviews || 0,
        upcomingInterviews: data.upcomingInterviews || 0,
        conversionRate: data.conversionRate || 0,
        recentActivity: data.recentActivity || [],
        offres: data.offres || [],
        graphData: {
          // Utiliser directement les données formatées par l'API
          candidatesByDate: data.graphData?.candidatesByDate || {},
          interviewsByDate: data.graphData?.interviewsByDate || {},
          statusDistribution: data.graphData?.statusDistribution || {
            "Pas de données": 0,
          },
          interviewStatusDistribution: data.graphData
            ?.interviewStatusDistribution || { "Pas de données": 0 },
          offresByDepartment: data.graphData?.offresByDepartment || {},
          candidatesByJob: data.graphData?.candidatesByJob || {},
        },
      };
    } catch (error) {
      console.error("Erreur fetchGraphData:", error);
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la récupération des données"
      );
    }
  }
);

// Thunk pour récupérer les offres
export const fetchOffres = createAsyncThunk(
  "dashboard/fetchOffres",
  async (_, { rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return rejectWithValue("Token non trouvé");
      }

      const response = await api.get("/api/recruteur/offres-emploi", {
        headers: { Authorization: token },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la récupération des offres"
      );
    }
  }
);

// Thunk pour récupérer le profil
export const fetchProfile = createAsyncThunk(
  "dashboard/fetchProfile",
  async (_, { rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return rejectWithValue("Token non trouvé");
      }

      const response = await api.get("/api/recruteur/profile", {
        headers: { Authorization: token },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la récupération du profil"
      );
    }
  }
);

// Thunk pour récupérer les candidats
export const fetchCandidates = createAsyncThunk(
  "dashboard/fetchCandidates",
  async ({ page = 1, per_page = 10 }, { rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return rejectWithValue("Token non trouvé");
      }

      const response = await api.get("/api/recruteur/candidates", {
        params: { page, per_page },
        headers: { Authorization: token },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la récupération des candidats"
      );
    }
  }
);

// Thunk pour récupérer les entretiens
export const fetchInterviews = createAsyncThunk(
  "dashboard/fetchInterviews",
  async ({ page = 1, per_page = 10 }, { rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return rejectWithValue("Token non trouvé");
      }

      const response = await api.get("/api/recruteur/interviews", {
        params: { page, per_page },
        headers: { Authorization: token },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la récupération des entretiens"
      );
    }
  }
);

// Thunk pour télécharger un CV
export const downloadCV = createAsyncThunk(
  "dashboard/downloadCV",
  async ({ candidatureId }, { rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return rejectWithValue("Token non trouvé");
      }

      const response = await api.get(`/api/recruteur/cv/${candidatureId}`, {
        headers: { Authorization: token },
        responseType: "blob",
      });

      // Créer un blob URL et télécharger le fichier
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `cv_${candidatureId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      return { success: true };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Erreur lors du téléchargement du CV"
      );
    }
  }
);

const initialState = {
  loading: false,
  error: null,
  data: {
    activeJobs: 0,
    newCandidates: 0,
    conversionRate: 0,
    offres: [],
    candidates: [],
    interviews: [],
    graphData: {
      candidatesByDate: {},
      interviewsByDate: {},
      statusDistribution: { "Pas de données": 0 },
      interviewStatusDistribution: { "Pas de données": 0 },
    },
  },
  candidatesPagination: {
    page: 1,
    per_page: 10,
    total: 0,
    pages: 0,
  },
  interviewsPagination: {
    page: 1,
    per_page: 10,
    total: 0,
    pages: 0,
  },
  selectedPeriod: "week",
  activeTab: "overview",
  isSidebarOpen: true,
};

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearDashboardError: (state) => {
      state.error = null;
    },
    setSelectedPeriod: (state, action) => {
      state.selectedPeriod = action.payload;
    },
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    toggleSidebar: (state) => {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
    closeSidebar: (state) => {
      state.isSidebarOpen = false;
    },
    setCandidatesPage: (state, action) => {
      state.candidatesPagination.page = action.payload;
    },
    setInterviewsPage: (state, action) => {
      state.interviewsPagination.page = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchInitialData
      .addCase(fetchInitialData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInitialData.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchInitialData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchGraphData
      .addCase(fetchGraphData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGraphData.fulfilled, (state, action) => {
        state.loading = false;
        state.data.graphData = action.payload.graphData;
      })
      .addCase(fetchGraphData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchOffres
      .addCase(fetchOffres.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOffres.fulfilled, (state, action) => {
        state.loading = false;
        state.data.offres = action.payload.offres || [];
      })
      .addCase(fetchOffres.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchProfile
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.data.profile = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchCandidates
      .addCase(fetchCandidates.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCandidates.fulfilled, (state, action) => {
        state.loading = false;
        state.data.candidates = action.payload.candidates || [];
        state.candidatesPagination = action.payload.pagination;
      })
      .addCase(fetchCandidates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // fetchInterviews
      .addCase(fetchInterviews.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInterviews.fulfilled, (state, action) => {
        state.loading = false;
        state.data.interviews = action.payload.interviews || [];
        state.interviewsPagination = action.payload.pagination;
      })
      .addCase(fetchInterviews.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // downloadCV
      .addCase(downloadCV.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(downloadCV.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(downloadCV.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const {
  clearError,
  clearDashboardError,
  setSelectedPeriod,
  setActiveTab,
  toggleSidebar,
  closeSidebar,
  setCandidatesPage,
  setInterviewsPage,
} = dashboardSlice.actions;

export default dashboardSlice.reducer;