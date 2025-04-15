import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const addJob = createAsyncThunk(
  "addjob/addJob",
  async (jobData, { rejectWithValue }) => {
    try {
      const response = await fetch("http://localhost:5000/api/offres-emploi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jobData),
      });
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
  async ({ jobId, jobData }, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/offres-emploi/${jobId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(jobData),
        }
      );
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
  async (jobId, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/offres-emploi/${jobId}`,
        {
          method: "DELETE",
        }
      );
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
    newJob: {
      title: "",
      department: "",
      location: "",
      description: "",
      requirements: [],
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
          title: jobData.title || jobData.titre || "",
          department: jobData.department || "",
          location: jobData.location || "",
          description: jobData.description || "",
          requirements:
            jobData.requirements || jobData.competences_requises || [],
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
      setTimeout(() => {
        state.alert.show = false;
      }, 3000);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addJob.fulfilled, (state) => {
        state.isAddingJob = false;
        state.newJob = {
          title: "",
          department: "",
          location: "",
          description: "",
          requirements: [],
          status: "open",
        };
      })
      .addCase(editJob.fulfilled, (state) => {
        state.isEditingJob = null;
        state.newJob = {
          title: "",
          department: "",
          location: "",
          description: "",
          requirements: [],
          status: "open",
        };
      })
      .addCase(deleteJob.fulfilled, (state) => {
        state.alert = {
          show: true,
          type: "success",
          message: "Job deleted successfully",
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
} = addjobsSlice.actions;
export default addjobsSlice.reducer;
