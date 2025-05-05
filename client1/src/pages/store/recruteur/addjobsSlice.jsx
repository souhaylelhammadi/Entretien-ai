import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../../../services/api";

// Thunk pour récupérer les offres d'emploi
export const fetchJobs = createAsyncThunk(
  "jobs/fetchJobs",
  async ({ token }, { rejectWithValue }) => {
    try {
      const response = await api.get("/api/recruteur/offres-emploi", {
        headers: { Authorization: `Bearer ${token}` },
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
  async ({ jobData, token }, { rejectWithValue }) => {
    try {
      const response = await api.post("/api/recruteur/offres-emploi", jobData, {
        headers: { Authorization: `Bearer ${token}` },
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
  async ({ jobId, jobData, token }, { rejectWithValue }) => {
    try {
      const response = await api.put(
        `/api/recruteur/offres-emploi/${jobId}`,
        jobData,
        {
          headers: { Authorization: `Bearer ${token}` },
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
      // Extract token and jobId from different payload formats
      let token, jobId;

      if (typeof payload === "object") {
        // Handle {jobId, token} format
        token = payload.token;
        jobId = payload.jobId;
      } else {
        // Handle plain jobId string format
        token = localStorage.getItem("token");
        jobId = payload;
      }

      if (!token) {
        return rejectWithValue("Token non trouvé");
      }

      if (!jobId || typeof jobId !== "string") {
        return rejectWithValue("ID de l'offre invalide");
      }

      await api.delete(`/api/recruteur/offres-emploi/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
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
  isEditingJob: false,
  editingJobId: null,
  newJob: {
    titre: "",
    description: "",
    localisation: "",
    departement: "",
    statut: "ouverte",
    competences_requises: [],
  },
  sortField: "date_creation",
  sortDirection: "desc",
  alert: { show: false, type: "", message: "" },
};

const jobsSlice = createSlice({
  name: "jobs",
  initialState,
  reducers: {
    setIsAddingJob: (state, action) => {
      state.isAddingJob = action.payload;
    },
    setIsEditingJob: (state, action) => {
      const { isEditing, jobId, jobData } = action.payload;
      state.isEditingJob = isEditing;
      state.editingJobId = jobId;
      if (jobData) {
        state.newJob = { ...state.newJob, ...jobData };
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
      const { type, message } = action.payload;
      state.alert = { show: true, type, message };
    },
    clearAlert: (state) => {
      state.alert = { show: false, type: "", message: "" };
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
          message: "Offre d'emploi créée avec succès",
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
          message: "Offre d'emploi mise à jour avec succès",
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
          message: "Offre d'emploi supprimée avec succès",
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
