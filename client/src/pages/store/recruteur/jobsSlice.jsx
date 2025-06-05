import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../services/api";

// Fonction utilitaire pour obtenir le token
const getToken = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("No token found in localStorage");
    return null;
  }

  // Vérifier si le token a déjà le préfixe Bearer
  if (token.startsWith("Bearer ")) {
    return token; // Retourner le token tel quel s'il a déjà le préfixe
  }

  // Ajouter le préfixe Bearer pour l'authentification si nécessaire
  return `Bearer ${token}`;
};

// Thunk pour récupérer les offres d'emploi
export const fetchJobs = createAsyncThunk(
  "jobs/fetchJobs",
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

// Thunks pour les opérations CRUD
export const addJob = createAsyncThunk(
  "jobs/addJob",
  async (payload, { rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return rejectWithValue("Token non trouvé");
      }

      // Extract jobData from payload
      const jobData = payload.jobData || payload;

      const response = await api.post("/api/recruteur/offres-emploi", jobData, {
        headers: { Authorization: token },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Erreur lors de l'ajout de l'offre"
      );
    }
  }
);

export const editJob = createAsyncThunk(
  "jobs/editJob",
  async (payload, { rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return rejectWithValue("Token non trouvé");
      }

      let jobId, jobData;

      // Extract jobId and jobData from payload
      if (typeof payload === "object" && payload !== null) {
        jobId = payload.jobId;
        jobData = payload.jobData;
      } else {
        return rejectWithValue("Format de données invalide");
      }

      if (!jobId || typeof jobId !== "string") {
        return rejectWithValue("ID de l'offre invalide");
      }

      const response = await api.put(
        `/api/recruteur/offres-emploi/${jobId}`,
        jobData,
        {
          headers: { Authorization: token },
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la modification de l'offre"
      );
    }
  }
);

export const deleteJob = createAsyncThunk(
  "jobs/deleteJob",
  async (payload, { rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return rejectWithValue("Token non trouvé");
      }

      // Handle both string jobId and {jobId} object
      const jobId = typeof payload === "object" ? payload.jobId : payload;

      if (!jobId || typeof jobId !== "string") {
        return rejectWithValue("ID de l'offre invalide");
      }

      await api.delete(`/api/recruteur/offres-emploi/${jobId}`, {
        headers: { Authorization: token },
      });
      return jobId;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la suppression de l'offre"
      );
    }
  }
);

const initialState = {
  jobs: [],
  loading: false,
  error: null,
  isAddingJob: false,
  isEditingJob: null,
  newJob: {
    titre: "",
    description: "",
    localisation: "",
    departement: "",
    
    competences_requises: [],
  },
  sortField: "date_creation",
  sortDirection: "desc",
  alert: {
    show: false,
    type: "",
    message: "",
  },
};

const jobsSlice = createSlice({
  name: "jobs",
  initialState,
  reducers: {
    setIsAddingJob: (state, action) => {
      state.isAddingJob = action.payload;
    },
    setIsEditingJob: (state, action) => {
      // Vérifier si payload est un objet ou une valeur simple
      if (action.payload && typeof action.payload === "object") {
        const { isEditing, jobId, jobData } = action.payload;
        state.isEditingJob = isEditing;
        state.editingJobId = jobId;
        if (jobData) {
          state.newJob = { ...state.newJob, ...jobData };
        }
      } else {
        // Pour la compatibilité avec l'ancien code
        state.isEditingJob = action.payload;
      }
    },
    setNewJob: (state, action) => {
      state.newJob = { ...state.newJob, ...action.payload };
    },
    resetNewJob: (state) => {
      state.newJob = initialState.newJob;
    },
    addRequirement: (state) => {
      state.newJob.competences_requises.push("");
    },
    removeRequirement: (state, action) => {
      state.newJob.competences_requises.splice(action.payload, 1);
    },
    updateRequirement: (state, action) => {
      const { index, value } = action.payload;
      state.newJob.competences_requises[index] = value;
    },
    setSort: (state, action) => {
      const { field, direction } = action.payload;
      state.sortField = field;
      state.sortDirection = direction;
    },
    showAlert: (state, action) => {
      state.alert = {
        show: true,
        type: action.payload.type,
        message: action.payload.message,
      };
    },
    clearAlert: (state) => {
      state.alert = initialState.alert;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Jobs
      .addCase(fetchJobs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchJobs.fulfilled, (state, action) => {
        state.loading = false;
        state.jobs = action.payload.offres || [];
      })
      .addCase(fetchJobs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.alert = {
          show: true,
          type: "error",
          message: action.payload,
        };
      })
      // Add Job
      .addCase(addJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addJob.fulfilled, (state, action) => {
        state.loading = false;
        state.jobs.push(action.payload);
        state.alert = {
          show: true,
          type: "success",
          message: "Offre ajoutée avec succès",
        };
      })
      .addCase(addJob.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.alert = {
          show: true,
          type: "error",
          message: action.payload,
        };
      })
      // Edit Job
      .addCase(editJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(editJob.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.jobs.findIndex(
          (job) => job.id === action.payload.id
        );
        if (index !== -1) {
          state.jobs[index] = action.payload;
        }
        state.alert = {
          show: true,
          type: "success",
          message: "Offre modifiée avec succès",
        };
      })
      .addCase(editJob.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.alert = {
          show: true,
          type: "error",
          message: action.payload,
        };
      })
      // Delete Job
      .addCase(deleteJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteJob.fulfilled, (state, action) => {
        state.loading = false;
        state.jobs = state.jobs.filter((job) => job.id !== action.payload);
        state.alert = {
          show: true,
          type: "success",
          message: "Offre supprimée avec succès",
        };
      })
      .addCase(deleteJob.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.alert = {
          show: true,
          type: "error",
          message: action.payload,
        };
      });
  },
});

export const {
  setIsAddingJob,
  setIsEditingJob,
  setNewJob,
  resetNewJob,
  addRequirement,
  removeRequirement,
  updateRequirement,
  setSort,
  showAlert,
  clearAlert,
} = jobsSlice.actions;

export default jobsSlice.reducer;
