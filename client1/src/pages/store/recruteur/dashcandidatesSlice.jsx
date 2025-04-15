import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const fetchCandidates = createAsyncThunk(
  "candidates/fetchCandidates",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch("http://localhost:5000/api/candidates");
      if (!response.ok) {
        throw new Error("Failed to fetch candidates");
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
        throw new Error("Failed to update status");
      }
      return { candidateId, status };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const candidatesSlice = createSlice({
  name: "candidates",
  initialState: {
    candidates: [],
    pagination: { currentPage: 1, itemsPerPage: 10 },
    viewDocument: { isOpen: false, type: "", content: "", candidateName: "" },
    loading: false,
    error: null,
  },
  reducers: {
    setPagination: (state, action) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },
    setViewDocument: (state, action) => {
      state.viewDocument = action.payload;
    },
    closeDocumentView: (state) => {
      state.viewDocument = {
        isOpen: false,
        type: "",
        content: "",
        candidateName: "",
      };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCandidates.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCandidates.fulfilled, (state, action) => {
        state.loading = false;
        state.candidates = action.payload;
        console.log("Updated candidates state:", action.payload);
      })
      .addCase(fetchCandidates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateCandidateStatus.fulfilled, (state, action) => {
        const { candidateId, status } = action.payload;
        const candidate = state.candidates.find((c) => c.id === candidateId);
        if (candidate) {
          candidate.statut = status;
        }
      });
  },
});

export const { setPagination, setViewDocument, closeDocumentView } =
  candidatesSlice.actions;
export default candidatesSlice.reducer;
