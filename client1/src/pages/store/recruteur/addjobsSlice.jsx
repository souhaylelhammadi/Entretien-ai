import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const addJob = createAsyncThunk(
  "addjob/addJob",
  async ({ jobData, token }, { rejectWithValue, dispatch }) => {
    try {
      const response = await fetch("http://localhost:5000/api/offres-emploi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(jobData),
      });
      if (response.status === 401) {
        dispatch({ type: "auth/logout" }); // Assuming logout action
        throw new Error("Session expired. Please log in again.");
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to add job");
      }
      return await response.json();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const editJob = createAsyncThunk(
  "addjob/editJob",
  async ({ jobId, jobData, token }, { rejectWithValue, dispatch }) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/offres-emploi/${jobId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(jobData),
        }
      );
      if (response.status === 401) {
        dispatch({ type: "auth/logout" });
        throw new Error("Session expired. Please log in again.");
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to edit job");
      }
      return await response.json();
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const deleteJob = createAsyncThunk(
  "addjob/deleteJob",
  async ({ jobId, token }, { rejectWithValue, dispatch }) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/offres-emploi/${jobId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.status === 401) {
        dispatch({ type: "auth/logout" });
        throw new Error("Session expired. Please log in again.");
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete job");
      }
      return jobId;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const addjobsSlice = createSlice({
  name: "addjob",
  initialState: {
    isAddingJob: false,
    isEditingJob: null,
    loading: false,
    newJob: {
      title: "",
      department: "",
      location: "",
      description: "",
      requirements: [],
      salaryMin: 0,
      status: "open",
    },
    alert: { show: false, type: "", message: "" },
    sortField: "title",
    sortDirection: "asc",
  },
  reducers: {
    setIsAddingJob: (state, action) => {
      state.isAddingJob = action.payload;
    },
    setIsEditingJob: (state, action) => {
      const { jobId, jobData } = action.payload || {};
      state.isEditingJob = jobId || null;
      if (jobData) {
        state.newJob = {
          title: jobData.titre || jobData.title || "",
          department: jobData.departement || jobData.department || "",
          location: jobData.localisation || jobData.location || "",
          description: jobData.description || "",
          requirements:
            jobData.competences_requises || jobData.requirements || [],
          salaryMin: jobData.salaire_min || jobData.salaryMin || 0,
          status: jobData.status || "open",
        };
      }
    },
    setNewJob: (state, action) => {
      state.newJob = { ...state.newJob, ...action.payload };
    },
    addRequirement: (state) => {
      state.newJob.requirements.push("");
    },
    removeRequirement: (state, action) => {
      state.newJob.requirements.splice(action.payload, 1);
    },
    updateRequirement: (state, action) => {
      const { index, value } = action.payload;
      state.newJob.requirements[index] = value;
    },
    setSort: (state, action) => {
      state.sortField = action.payload.field;
      state.sortDirection = action.payload.direction;
    },
    showAlert: (state, action) => {
      state.alert = { show: true, ...action.payload };
    },
    clearAlert: (state) => {
      state.alert = { show: false, type: "", message: "" };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addJob.pending, (state) => {
        state.loading = true;
      })
      .addCase(addJob.fulfilled, (state) => {
        state.isAddingJob = false;
        state.loading = false;
        state.newJob = {
          title: "",
          department: "",
          location: "",
          description: "",
          requirements: [],
          salaryMin: 0,
          status: "open",
        };
      })
      .addCase(addJob.rejected, (state, action) => {
        state.loading = false;
        state.alert = {
          show: true,
          type: "error",
          message: action.payload,
        };
      })
      .addCase(editJob.pending, (state) => {
        state.loading = true;
      })
      .addCase(editJob.fulfilled, (state) => {
        state.isEditingJob = null;
        state.loading = false;
        state.newJob = {
          title: "",
          department: "",
          location: "",
          description: "",
          requirements: [],
          salaryMin: 0,
          status: "open",
        };
      })
      .addCase(editJob.rejected, (state, action) => {
        state.loading = false;
        state.alert = {
          show: true,
          type: "error",
          message: action.payload,
        };
      })
      .addCase(deleteJob.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteJob.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(deleteJob.rejected, (state, action) => {
        state.loading = false;
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
  addRequirement,
  removeRequirement,
  updateRequirement,
  setSort,
  showAlert,
  clearAlert,
} = addjobsSlice.actions;
export default addjobsSlice.reducer;
