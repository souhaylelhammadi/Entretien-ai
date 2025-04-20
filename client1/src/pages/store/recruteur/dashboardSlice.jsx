import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const fetchInitialData = createAsyncThunk(
  "dashboard/fetchInitialData",
  async (_, { rejectWithValue }) => {
    try {
      const endpoints = [
        "http://localhost:5000/api/offres-emploi",
        "http://localhost:5000/api/candidates",
        "http://localhost:5000/api/interviews",
      ];

      const responses = await Promise.all(endpoints.map((url) => fetch(url)));
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

      const data = await Promise.all(responses.map((res) => res.json()));
      console.log("Fetched dashboard data:", data);
      return {
        jobs: (Array.isArray(data[0].offres) ? data[0].offres : []).map(
          (job) => ({
            ...job,
            id: job._id, // Fixed: Use _id instead of id
            title: job.titre || job.title,
            requirements: job.competences_requises || job.requirements,
            status: job.status || "open",
          })
        ),
        candidates: (Array.isArray(data[1]) ? data[1] : []).map(
          (candidate) => ({
            ...candidate,
            candidat: {
              ...candidate.candidat,
              cv: candidate.candidat?.cv || "",
              lettre_motivation: candidate.candidat?.lettre_motivation || "",
            },
            offreEmploi: {
              ...candidate.offreEmploi,
              id: candidate.offreEmploi?._id,
              titre:
                candidate.offreEmploi?.titre || candidate.offreEmploi?.title,
            },
          })
        ),
        interviews: Array.isArray(data[2]) ? data[2] : [],
      };
    } catch (err) {
      console.error("Erreur dans fetchInitialData:", err);
      return rejectWithValue(
        err.message || "Erreur lors du chargement des données"
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
    loading: true,
    error: null,
    lastFetch: null,
    pagination: { currentPage: 1, itemsPerPage: 10, total: 0 }, // Initialize pagination
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
      state.loading = false;
      state.error = null;
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
        state.lastFetch = new Date().toISOString();
        state.error = null;
        state.pagination.total = action.payload.candidates.length; // Update total based on fetched candidates
        console.log("Updated dashboard state:", action.payload);
      })
      .addCase(fetchInitialData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.jobs = state.jobs || [];
        state.candidates = state.candidates || [];
        state.interviews = state.interviews || [];
      });
  },
});

export const {
  setActiveTab,
  toggleSidebar,
  closeSidebar,
  clearDashboardError,
  resetDashboard,
} = dashboardSlice.actions;

export default dashboardSlice.reducer;