import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { createSelector } from "reselect";

export const fetchCandidates = createAsyncThunk(
  "candidates/fetchCandidates",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch("http://localhost:5000/api/candidates");
      if (!response.ok) {
        throw new Error(`Failed to fetch candidates: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("Fetched candidates:", data);
      return data.map((candidate) => ({
        ...candidate,
        id: String(candidate.id),
        offreEmploiId: String(candidate.offreEmploiId),
        statut: candidate.statut || "en_attente",
        date_postulation:
          candidate.date_postulation || new Date().toISOString(),
        candidat: {
          nom: candidate.candidat?.nom || "Inconnu",
          email: candidate.candidat?.email || "",
          telephone: candidate.candidat?.telephone || "",
          cv: candidate.candidat?.cv || "",
          lettre_motivation: candidate.candidat?.lettre_motivation || "",
        },
        offreEmploi: candidate.offreEmploi || {
          id: candidate.offreEmploiId,
          titre: "Offre inconnue",
        },
      }));
    } catch (err) {
      console.error("Error fetching candidates:", err);
      return rejectWithValue(err.message);
    }
  }
);

export const updateCandidateStatus = createAsyncThunk(
  "candidates/updateCandidateStatus",
  async ({ candidateId, status }, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/candidates/${candidateId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statut: status }),
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to update status: ${response.statusText}`);
      }
      return { candidateId, status };
    } catch (err) {
      console.error("Error updating candidate status:", err);
      return rejectWithValue(err.message);
    }
  }
);

const selectCandidatesState = (state) => state.candidates;

export const selectCandidatesData = createSelector(
  [selectCandidatesState],
  (candidatesState) => ({
    candidates: candidatesState.candidates || [],
    pagination: candidatesState.pagination || {
      currentPage: 1,
      itemsPerPage: 10,
    },
    viewDocument: candidatesState.viewDocument || {
      isOpen: false,
      type: "",
      cv_path: "",
      content: "",
      candidateName: "",
    },
    loading: candidatesState.loading,
    error: candidatesState.error,
  })
);

const candidatesSlice = createSlice({
  name: "candidates",
  initialState: {
    candidates: [],
    pagination: { currentPage: 1, itemsPerPage: 10 },
    viewDocument: {
      isOpen: false,
      type: "",
      cv_path: "",
      content: "",
      candidateName: "",
    },
    loading: false,
    error: null,
    status: "idle", // idle | loading | succeeded | failed
  },
  reducers: {
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    setViewDocument: (state, action) => {
      state.viewDocument = { ...action.payload };
    },
    closeDocumentView: (state) => {
      state.viewDocument = {
        isOpen: false,
        type: "",
        cv_path: "",
        content: "",
        candidateName: "",
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCandidates.pending, (state) => {
        state.status = "loading";
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCandidates.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.loading = false;
        state.candidates = action.payload;
        console.log("Updated candidates state:", action.payload);
      })
      .addCase(fetchCandidates.rejected, (state, action) => {
        state.status = "failed";
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateCandidateStatus.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(updateCandidateStatus.fulfilled, (state, action) => {
        state.status = "succeeded";
        const { candidateId, status } = action.payload;
        const candidate = state.candidates.find((c) => c.id === candidateId);
        if (candidate) {
          candidate.statut = status;
        }
      })
      .addCase(updateCandidateStatus.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      });
  },
});

export const { setPagination, setViewDocument, closeDocumentView } =
  candidatesSlice.actions;
export default candidatesSlice.reducer;
