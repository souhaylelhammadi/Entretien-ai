import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api";

// Async thunks
export const fetchJobs = createAsyncThunk(
  "jobs/fetchJobs",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/jobs`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data || { message: error.message }
      );
    }
  }
);

export const addJob = createAsyncThunk(
  "jobs/addJob",
  async (jobData, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_URL}/jobs`, jobData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data || { message: error.message }
      );
    }
  }
);

export const updateJob = createAsyncThunk(
  "jobs/updateJob",
  async ({ id, jobData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`${API_URL}/jobs/${id}`, jobData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data || { message: error.message }
      );
    }
  }
);

export const deleteJob = createAsyncThunk(
  "jobs/deleteJob",
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`${API_URL}/jobs/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      return id;
    } catch (error) {
      return rejectWithValue(
        error.response?.data || { message: error.message }
      );
    }
  }
);

const initialJob = {
  title: "",
  department: "",
  location: "",
  description: "",
  requirements: [],
  status: "open",
  newRequirement: "",
};

const initialState = {
  jobs: [],
  newJob: { ...initialJob },
  isAddingJob: false,
  isEditingJob: false,
  selectedJobId: null,
  loading: false,
  error: null,
  success: null,
};

const jobsSlice = createSlice({
  name: "jobs",
  initialState,
  reducers: {
    setIsAddingJob: (state, action) => {
      state.isAddingJob = action.payload;
      if (action.payload) {
        state.newJob = { ...initialJob };
        state.isEditingJob = false;
      }
    },
    setIsEditingJob: (state, action) => {
      state.isEditingJob = action.payload;
      if (!action.payload) {
        state.newJob = { ...initialJob };
        state.selectedJobId = null;
      }
    },
    setNewJob: (state, action) => {
      state.newJob = action.payload;
    },
    selectJobForEdit: (state, action) => {
      const jobToEdit = state.jobs.find((job) => job._id === action.payload);
      if (jobToEdit) {
        state.newJob = { ...jobToEdit, newRequirement: "" };
        state.selectedJobId = action.payload;
        state.isEditingJob = true;
        state.isAddingJob = false;
      }
    },
    addRequirement: (state, action) => {
      if (!state.newJob.requirements.includes(action.payload)) {
        state.newJob.requirements.push(action.payload);
      }
    },
    removeRequirement: (state, action) => {
      state.newJob.requirements = state.newJob.requirements.filter(
        (_, index) => index !== action.payload
      );
    },
    resetNotifications: (state) => {
      state.error = null;
      state.success = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch jobs
      .addCase(fetchJobs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchJobs.fulfilled, (state, action) => {
        state.loading = false;
        state.jobs = action.payload;
      })
      .addCase(fetchJobs.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload?.message || "Erreur lors du chargement des offres";
      })

      // Add job
      .addCase(addJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addJob.fulfilled, (state, action) => {
        state.loading = false;
        state.jobs.push(action.payload);
        state.isAddingJob = false;
        state.newJob = { ...initialJob };
        state.success = "Offre d'emploi ajoutée avec succès";
      })
      .addCase(addJob.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload?.message || "Erreur lors de l'ajout de l'offre";
      })

      // Update job
      .addCase(updateJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateJob.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.jobs.findIndex(
          (job) => job._id === action.payload._id
        );
        if (index !== -1) {
          state.jobs[index] = action.payload;
        }
        state.isEditingJob = false;
        state.newJob = { ...initialJob };
        state.selectedJobId = null;
        state.success = "Offre d'emploi mise à jour avec succès";
      })
      .addCase(updateJob.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload?.message || "Erreur lors de la mise à jour de l'offre";
      })

      // Delete job
      .addCase(deleteJob.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteJob.fulfilled, (state, action) => {
        state.loading = false;
        state.jobs = state.jobs.filter((job) => job._id !== action.payload);
        state.success = "Offre d'emploi supprimée avec succès";
      })
      .addCase(deleteJob.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload?.message || "Erreur lors de la suppression de l'offre";
      });
  },
});

export const {
  setIsAddingJob,
  setIsEditingJob,
  setNewJob,
  selectJobForEdit,
  addRequirement,
  removeRequirement,
  resetNotifications,
} = jobsSlice.actions;

export default jobsSlice.reducer;
