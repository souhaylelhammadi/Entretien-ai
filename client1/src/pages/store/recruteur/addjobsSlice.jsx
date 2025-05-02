import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const addJob = createAsyncThunk(
  "addjob/addJob",
  async ({ jobData, token }, { rejectWithValue, dispatch }) => {
    try {
      console.log("=== ADDJOB THUNK ===");
      if (!token || typeof token !== "string" || token.trim() === "") {
        console.error("Invalid token:", { type: typeof token, value: token });
        throw new Error("No valid authentication token provided");
      }

      console.log("Job data:", JSON.stringify(jobData, null, 2));

      const requiredFields = [
        "titre",
        "description",
        "localisation",
        "departement",
        "competences_requises",
        "entreprise_id",
        "recruteur_id",
      ];
      for (const field of requiredFields) {
        if (
          !jobData[field] ||
          (typeof jobData[field] === "string" && !jobData[field].trim())
        ) {
          console.error(`Missing required field: ${field}`);
          throw new Error(`Field ${field} is required`);
        }
      }

      if (
        !Array.isArray(jobData.competences_requises) ||
        jobData.competences_requises.length === 0
      ) {
        console.error("Missing required skills");
        throw new Error("At least one required skill is needed");
      }

      const formattedToken = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;

      const response = await fetch("http://localhost:5000/api/offres-emploi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: formattedToken,
        },
        body: JSON.stringify(jobData),
      });

      if (response.status === 401) {
        console.error("401: Session expired");
        dispatch({ type: "auth/logout" });
        throw new Error("Session expired. Please log in again.");
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        throw new Error(errorData.error || "Failed to add job offer");
      }

      const responseData = await response.json();
      console.log("Server response:", responseData);
      return responseData;
    } catch (err) {
      console.error("Error in addJob:", err.message);
      return rejectWithValue(err.message);
    }
  }
);

export const editJob = createAsyncThunk(
  "addjob/editJob",
  async ({ jobId, jobData, token }, { rejectWithValue, dispatch }) => {
    try {
      console.log("=== EDITJOB THUNK ===");
      if (!token || typeof token !== "string" || token.trim() === "") {
        console.error("Invalid token:", { type: typeof token, value: token });
        throw new Error("No valid authentication token provided");
      }

      jobId = String(jobId);
      if (!jobId || jobId === "undefined" || jobId.trim() === "") {
        console.error("Invalid job ID:", jobId);
        throw new Error("Cannot edit job: Invalid ID");
      }

      console.log("Job ID:", jobId, "Data:", JSON.stringify(jobData, null, 2));

      const requiredFields = [
        "titre",
        "description",
        "localisation",
        "departement",
      ];
      for (const field of requiredFields) {
        if (
          !jobData[field] ||
          (typeof jobData[field] === "string" && !jobData[field].trim())
        ) {
          console.error(`Missing required field: ${field}`);
          throw new Error(`Field ${field} is required`);
        }
      }

      if (
        !Array.isArray(jobData.competences_requises) ||
        jobData.competences_requises.length === 0
      ) {
        console.error("Missing required skills");
        throw new Error("At least one required skill is needed");
      }

      const formattedToken = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;

      const response = await fetch(
        `http://localhost:5000/api/offres-emploi/${jobId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: formattedToken,
          },
          body: JSON.stringify(jobData),
        }
      );

      if (response.status === 401) {
        console.error("401: Session expired");
        dispatch({ type: "auth/logout" });
        throw new Error("Session expired. Please log in again.");
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        throw new Error(errorData.error || "Failed to edit job offer");
      }

      const responseData = await response.json();
      console.log("Server response:", responseData);
      return responseData;
    } catch (err) {
      console.error("Error in editJob:", err.message);
      return rejectWithValue(err.message);
    }
  }
);

export const deleteJob = createAsyncThunk(
  "addjob/deleteJob",
  async ({ jobId, token }, { rejectWithValue, dispatch }) => {
    try {
      console.log("=== DELETEJOB THUNK ===");
      if (!token || typeof token !== "string" || token.trim() === "") {
        console.error("Invalid token:", { type: typeof token, value: token });
        throw new Error("No valid authentication token provided");
      }

      jobId = String(jobId);
      if (!jobId || jobId === "undefined" || jobId.trim() === "") {
        console.error("Invalid job ID:", jobId);
        throw new Error("Cannot delete job: Invalid ID");
      }

      console.log("Deleting job ID:", jobId);

      const formattedToken = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;

      const response = await fetch(
        `http://localhost:5000/api/offres-emploi/${jobId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: formattedToken,
          },
        }
      );

      if (response.status === 401) {
        console.error("401: Session expired");
        dispatch({ type: "auth/logout" });
        throw new Error("Session expired. Please log in again.");
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Server error:", errorData);
        throw new Error(errorData.error || "Failed to delete job offer");
      }

      console.log("Job deleted successfully");
      return jobId;
    } catch (err) {
      console.error("Error in deleteJob:", err.message);
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
      titre: "",
      departement: "",
      localisation: "",
      description: "",
      competences_requises: [],
      status: "open",
    },
    alert: { show: false, type: "", message: "" },
    sortField: "titre",
    sortDirection: "asc",
  },
  reducers: {
    setIsAddingJob: (state, action) => {
      state.isAddingJob = action.payload;
    },
    setIsEditingJob: (state, action) => {
      const { jobId, jobData } = action.payload || {};
      state.isEditingJob = jobId ? String(jobId) : null;
      console.log("Edit mode:", state.isEditingJob);

      if (jobData) {
        state.newJob = {
          titre: jobData.titre || "",
          departement: jobData.departement || "",
          localisation: jobData.localisation || "",
          description: jobData.description || "",
          competences_requises: jobData.competences_requises || [],
          status: jobData.status || "open",
        };
      }
    },
    setNewJob: (state, action) => {
      state.newJob = { ...state.newJob, ...action.payload };
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
          titre: "",
          departement: "",
          localisation: "",
          description: "",
          competences_requises: [],
          status: "open",
        };
      })
      .addCase(addJob.rejected, (state, action) => {
        state.loading = false;
        state.alert = {
          show: true,
          type: "error",
          message: action.payload || "Failed to add job offer",
        };
      })
      .addCase(editJob.pending, (state) => {
        state.loading = true;
      })
      .addCase(editJob.fulfilled, (state) => {
        state.isEditingJob = null;
        state.loading = false;
        state.newJob = {
          titre: "",
          departement: "",
          localisation: "",
          description: "",
          competences_requises: [],
          status: "open",
        };
      })
      .addCase(editJob.rejected, (state, action) => {
        state.loading = false;
        state.alert = {
          show: true,
          type: "error",
          message: action.payload || "Failed to edit job offer",
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
          message: action.payload || "Failed to delete job offer",
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
