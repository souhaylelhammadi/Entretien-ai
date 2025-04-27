import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const fetchInitialData = createAsyncThunk(
  "dashboard/fetchInitialData",
  async ({ page = 1, limit = 10 }, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      let token = auth.token || localStorage.getItem("token");
      const userId =
        auth.user?._id || auth.user?.id || localStorage.getItem("userId");

      if (!token) {
        throw new Error("Aucun jeton d'authentification trouvé");
      }

      if (!userId) {
        console.error(
          "ID utilisateur non trouvé dans l'état auth ou localStorage"
        );
        throw new Error("ID utilisateur non trouvé, veuillez vous reconnecter");
      }

      console.log("========== FETCH INITIAL DATA ==========");
      console.log("Recruteur ID utilisé:", userId);
      console.log("Token (20 premiers car.):", token.substring(0, 20) + "...");

      // Endpoints avec filtrage par recruteur_id explicite
      const endpoints = [
        `http://localhost:5000/api/offres-emploi?page=${page}&limit=${limit}&recruteur_id=${userId}`,
        `http://localhost:5000/api/candidates?page=${page}&limit=${limit}&recruteur_id=${userId}`,
        `http://localhost:5000/api/candidatures?page=${page}&limit=${limit}&recruteur_id=${userId}`,
        `http://localhost:5000/api/offres-emploi?period=month&recruteur_id=${userId}`,
      ];

      // Log des URLs pour débogage
      endpoints.forEach((url, index) => {
        console.log(`Endpoint ${index + 1}:`, url);
      });

      const responses = await Promise.all(
        endpoints.map((url, index) =>
          fetch(url, {
            headers: {
              Authorization: token,
              "Content-Type": "application/json",
            },
          })
            .then((response) => {
              console.log(
                `Statut réponse endpoint ${index + 1}:`,
                response.status
              );
              return response;
            })
            .catch((error) => {
              console.error(`Erreur lors de l'appel à ${url}:`, error);
              // Retourner un objet mock qui simule une réponse en échec
              return {
                ok: false,
                json: async () => ({
                  error: `Erreur de connexion: ${error.message}`,
                }),
              };
            })
        )
      );

      // Préparer les données par défaut en cas d'échec
      let jobsData = { offres: [], total: 0, page: 1, limit };
      let candidatesData = { candidates: [], total: 0, page: 1, limit };
      let interviewsData = { interviews: [], total: 0, page: 1, limit };
      let graphData = { labels: [], datasets: [] };

      // Traiter les réponses individuellement
      if (responses[0].ok) {
        jobsData = await responses[0].json();
        console.log("Données offres reçues:", jobsData);
        console.log(`Nombre d'offres reçues: ${jobsData.offres?.length || 0}`);
      } else {
        console.error(
          "Échec de récupération des offres d'emploi:",
          await responses[0].json().catch(() => ({}))
        );
      }

      if (responses[1].ok) {
        candidatesData = await responses[1].json();
        console.log(
          `Nombre de candidats reçus: ${candidatesData.candidates?.length || 0}`
        );
      } else {
        console.error("Échec de récupération des candidats");
      }

      if (responses[2].ok) {
        interviewsData = await responses[2].json();
        console.log(
          `Nombre d'entretiens reçus: ${interviewsData.interviews?.length || 0}`
        );
      } else {
        console.error("Échec de récupération des entretiens");
      }

      if (responses[3].ok) {
        graphData = await responses[3].json();
        console.log("Données graphiques reçues:", graphData);
      } else {
        console.error("Échec de récupération des données graphiques");
      }

      console.log("========== FIN FETCH INITIAL DATA ==========");

      return {
        jobs: (jobsData.offres || []).map((job) => ({
          ...job,
          id: job._id,
          title: job.titre || job.title,
          requirements: job.competences_requises || job.requirements || [],
          status: job.status || "open",
        })),
        candidates: (candidatesData.candidates || []).map((candidate) => ({
          ...candidate,
          id: candidate._id || candidate.id,
          offreEmploi: candidate.offreEmploi
            ? {
                ...candidate.offreEmploi,
                id: candidate.offreEmploi._id || candidate.offreEmploi.id,
                titre:
                  candidate.offreEmploi.titre || candidate.offreEmploi.title,
              }
            : null,
        })),
        interviews: (interviewsData.interviews || []).map((interview) => ({
          ...interview,
          id: interview._id || interview.id,
        })),
        graphData,
        pagination: {
          jobs: {
            total: jobsData.total || 0,
            currentPage: jobsData.page || 1,
            itemsPerPage: jobsData.limit || limit,
          },
          candidates: {
            total: candidatesData.total || 0,
            currentPage: candidatesData.page || 1,
            itemsPerPage: candidatesData.limit || limit,
          },
          interviews: {
            total: interviewsData.total || 0,
            currentPage: interviewsData.page || 1,
            itemsPerPage: interviewsData.limit || limit,
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
      const userId =
        auth.user?._id || auth.user?.id || localStorage.getItem("userId");

      if (!token) {
        throw new Error("Aucun jeton d'authentification trouvé");
      }

      if (!userId) {
        console.error(
          "ID utilisateur non trouvé dans l'état auth ou localStorage"
        );
        throw new Error("ID utilisateur non trouvé, veuillez vous reconnecter");
      }

      console.log("========== FETCH GRAPH DATA ==========");
      console.log("Période:", period);
      console.log("Recruteur ID utilisé:", userId);
      console.log("Token (20 premiers car.):", token.substring(0, 20) + "...");

      // Ajouter recruteur_id pour filtrer les données par recruteur
      const url = `http://localhost:5000/api/offres-emploi?period=${period}&recruteur_id=${userId}`;
      console.log("URL appel graphique:", url);

      const response = await fetch(url, {
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      }).catch((error) => {
        console.error(
          `Erreur lors de l'appel à l'API pour les données graphiques:`,
          error
        );
        throw new Error(`Erreur de connexion: ${error.message}`);
      });

      console.log("Statut réponse graphique:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erreur données graphiques:", errorData);
        throw new Error(
          errorData.error || "Erreur lors du chargement des données graphiques"
        );
      }

      const graphData = await response.json();
      console.log("Données graphiques reçues:", graphData);
      console.log("========== FIN FETCH GRAPH DATA ==========");

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
