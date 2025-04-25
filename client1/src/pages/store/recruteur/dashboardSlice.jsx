import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const fetchInitialData = createAsyncThunk(
  "dashboard/fetchInitialData",
  async ({ page = 1, limit = 10 }, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      let token = auth.token || localStorage.getItem("token");

      if (!token) {
        throw new Error("Aucun jeton d'authentification trouvé");
      }

      console.log(
        "Token utilisé pour fetchInitialData:",
        token.substring(0, 20) + "..."
      );

      const endpoints = [
        `http://localhost:5000/api/dashboard/offres-emploi?page=${page}&limit=${limit}`,
        `http://localhost:5000/api/dashboard/candidates?page=${page}&limit=${limit}`,
        `http://localhost:5000/api/dashboard/interviews?page=${page}&limit=${limit}`,
        `http://localhost:5000/api/dashboard/data-graph?period=month`, // Default to month
      ];

      const responses = await Promise.all(
        endpoints.map((url) =>
          fetch(url, {
            headers: {
              Authorization: token,
            },
          })
        )
      );

      const errors = [];
      for (let i = 0; i < responses.length; i++) {
        if (!responses[i].ok) {
          const errorData = await responses[i].json();
          errors.push(
            errorData.error || `Erreur avec l'endpoint ${endpoints[i]}`
          );
        }
      }

      if (errors.length > 0) {
        throw new Error(errors.join(" | "));
      }

      const [jobsData, candidatesData, interviewsData, graphData] =
        await Promise.all(responses.map((res) => res.json()));

      return {
        jobs: jobsData.offres.map((job) => ({
          ...job,
          id: job._id,
          title: job.titre,
          requirements: job.competences_requises,
          status: job.status,
        })),
        candidates: candidatesData.candidates.map((candidate) => ({
          ...candidate,
          id: candidate._id,
          offreEmploi: candidate.offreEmploi
            ? {
                ...candidate.offreEmploi,
                id: candidate.offreEmploi._id,
                titre: candidate.offreEmploi.titre,
              }
            : null,
        })),
        interviews: interviewsData.interviews.map((interview) => ({
          ...interview,
          id: interview._id,
        })),
        graphData,
        pagination: {
          jobs: {
            total: jobsData.total,
            currentPage: jobsData.page,
            itemsPerPage: jobsData.limit,
          },
          candidates: {
            total: candidatesData.total,
            currentPage: candidatesData.page,
            itemsPerPage: candidatesData.limit,
          },
          interviews: {
            total: interviewsData.total,
            currentPage: interviewsData.page,
            itemsPerPage: interviewsData.limit,
          },
        },
      };
    } catch (err) {
      console.error("Erreur dans fetchInitialData:", err);
      return rejectWithValue(
        err.message || "Erreur lors du chargement des données"
      );
    }
  }
);

export const fetchGraphData = createAsyncThunk(
  "dashboard/fetchGraphData",
  async ({ period }, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      let token = auth.token || localStorage.getItem("token");

      if (!token) {
        throw new Error("Aucun jeton d'authentification trouvé");
      }

      console.log(
        "Token utilisé pour fetchGraphData:",
        token.substring(0, 20) + "..."
      );

      const response = await fetch(
        `http://localhost:5000/api/dashboard/data-graph?period=${period}`,
        {
          headers: {
            Authorization: token,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Erreur lors du chargement des données graphiques"
        );
      }

      const graphData = await response.json();
      return graphData;
    } catch (err) {
      console.error("Erreur dans fetchGraphData:", err);
      return rejectWithValue(
        err.message || "Erreur lors du chargement des données graphiques"
      );
    }
  }
);

const dashboardSlice = createSlice({
  name: "dashboard",
  initialState: {
    activeTab: "overview",
    isSidebarOpen: false,
    jobs: [],
    candidates: [],
    interviews: [],
    graphData: null,
    loading: false,
    error: null,
    lastFetch: null,
    pagination: {
      jobs: { currentPage: 1, itemsPerPage: 10, total: 0 },
      candidates: { currentPage: 1, itemsPerPage: 10, total: 0 },
      interviews: { currentPage: 1, itemsPerPage: 10, total: 0 },
    },
    selectedPeriod: "month",
  },
  reducers: {
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
    toggleSidebar: (state) => {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
    closeSidebar: (state) => {
      state.isSidebarOpen = false;
    },
    clearDashboardError: (state) => {
      state.error = null;
    },
    resetDashboard: (state) => {
      state.jobs = [];
      state.candidates = [];
      state.interviews = [];
      state.graphData = null;
      state.loading = false;
      state.error = null;
    },
    setSelectedPeriod: (state, action) => {
      state.selectedPeriod = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInitialData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInitialData.fulfilled, (state, action) => {
        state.loading = false;
        state.jobs = action.payload.jobs;
        state.candidates = action.payload.candidates;
        state.interviews = action.payload.interviews;
        state.graphData = action.payload.graphData;
        state.lastFetch = new Date().toISOString();
        state.error = null;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchInitialData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.jobs = state.jobs || [];
        state.candidates = state.candidates || [];
        state.interviews = state.interviews || [];
        state.graphData = state.graphData || null;
      })
      .addCase(fetchGraphData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchGraphData.fulfilled, (state, action) => {
        state.loading = false;
        state.graphData = action.payload;
        state.error = null;
      })
      .addCase(fetchGraphData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const {
  setActiveTab,
  toggleSidebar,
  closeSidebar,
  clearDashboardError,
  resetDashboard,
  setSelectedPeriod,
} = dashboardSlice.actions;

export default dashboardSlice.reducer;
