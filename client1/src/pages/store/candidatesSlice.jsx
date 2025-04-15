import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// Async thunk to fetch candidates
export const fetchCandidates = createAsyncThunk(
  "candidates/fetchCandidates",
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const token = auth.user?.token;

      if (!token) {
        return rejectWithValue("Utilisateur non connecté");
      }

      const response = await axios.get("/api/candidates", {
        headers: { Authorization: `Bearer ${token}` },
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

export const updateCandidateStatus = createAsyncThunk(
  "candidates/updateCandidateStatus",
  async ({ candidateId, status }, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const token = auth.user?.token;

      if (!token) {
        return rejectWithValue("Utilisateur non connecté");
      }

      const response = await axios.put(
        `/api/candidates/${candidateId}`,
        { status },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return response.data.candidate;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la mise à jour du candidat"
      );
    }
  }
);

const candidatesSlice = createSlice({
  name: "candidates",
  initialState: {
    pagination: {
      currentPage: 1,
      itemsPerPage: 5,
      activeJobId: null,
    },
    viewDocument: {
      isOpen: false,
      type: null,
      content: "",
      candidateName: "",
    },
    filters: {
      status: "all",
      searchTerm: "",
      sortBy: "recent",
    },
    candidates: [],
    loading: false,
    error: null,
  },
  reducers: {
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    setItemsPerPage: (state, action) => {
      state.pagination.itemsPerPage = action.payload;
      state.pagination.currentPage = 1;
    },
    setViewDocument: (state, action) => {
      state.viewDocument = { ...state.viewDocument, ...action.payload };
    },
    closeDocumentView: (state) => {
      state.viewDocument = {
        isOpen: false,
        type: null,
        content: "",
        candidateName: "",
      };
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.pagination.currentPage = 1;
    },
    resetFilters: (state) => {
      state.filters = {
        status: "all",
        searchTerm: "",
        sortBy: "recent",
      };
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch candidates
      .addCase(fetchCandidates.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCandidates.fulfilled, (state, action) => {
        state.loading = false;
        state.candidates = action.payload;
      })
      .addCase(fetchCandidates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Update candidate status
      .addCase(updateCandidateStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCandidateStatus.fulfilled, (state, action) => {
        state.loading = false;
        const updatedCandidate = action.payload;
        const index = state.candidates.findIndex(
          (c) => c._id === updatedCandidate._id
        );
        if (index !== -1) {
          state.candidates[index] = updatedCandidate;
        }
      })
      .addCase(updateCandidateStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const {
  setPagination,
  setItemsPerPage,
  setViewDocument,
  closeDocumentView,
  setFilters,
  resetFilters,
} = candidatesSlice.actions;

export default candidatesSlice.reducer;
