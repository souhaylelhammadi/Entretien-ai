import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { createSelector } from "reselect";

export const fetchCandidates = createAsyncThunk(
  "candidates/fetchCandidates",
  async (_, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      let token = auth.token || localStorage.getItem("token");
      const userId =
        auth.user?._id || auth.user?.id || localStorage.getItem("userId");

      if (!token) {
        throw new Error("Aucun jeton d'authentification trouvé");
      }

      if (!userId) {
        throw new Error("ID utilisateur non trouvé, veuillez vous reconnecter");
      }

      console.log("========== FETCH CANDIDATES ==========");
      console.log("Recruteur ID utilisé:", userId);
      console.log("Token (20 premiers car.):", token.substring(0, 20) + "...");

      // Ajouter recruteur_id pour filtrer les candidats par recruteur
      const url = `http://localhost:5000/api/candidates?recruteur_id=${userId}`;
      console.log("URL de récupération des candidats:", url);

      const response = await fetch(url, {
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      });

      console.log("Statut réponse candidats:", response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Erreur récupération candidats:", errorData);
        throw new Error(
          `Échec de récupération des candidats: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log(`Nombre de candidats récupérés: ${data.length || 0}`);
      console.log("========== FIN FETCH CANDIDATES ==========");

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
          lettre_motivation_text:
            candidate.candidat?.lettre_motivation_text || "",
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
  async ({ candidateId, status }, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      let token = auth.token || localStorage.getItem("token");
      const userId = auth.user?._id || auth.user?.id || localStorage.getItem("userId");
      
      if (!token) {
        throw new Error("Aucun jeton d'authentification trouvé");
      }
      
      if (!userId) {
        throw new Error("ID utilisateur non trouvé, veuillez vous reconnecter");
      }
      
      console.log("========== UPDATE CANDIDATE STATUS ==========");
      console.log("Mise à jour candidat ID:", candidateId);
      console.log("Nouveau statut:", status);
      console.log("Recruteur ID:", userId);
      
      const response = await fetch(
        `http://localhost:5000/api/candidates/${candidateId}`,
        {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": token 
          },
          body: JSON.stringify({ 
            statut: status,
            recruteur_id: userId // Ajouter l'ID du recruteur pour la vérification côté serveur
          }),
        }
      );
      
      console.log("Statut réponse mise à jour:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Erreur mise à jour candidat:", errorData);
        throw new Error(`Échec de mise à jour du statut: ${response.statusText}`);
      }
      
      console.log("Mise à jour réussie du candidat");
      console.log("========== FIN UPDATE CANDIDATE STATUS ==========");
      
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
      total: 0, // Ensure total is initialized
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
    pagination: { currentPage: 1, itemsPerPage: 10, total: 0 }, // Ensure total is initialized
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
        state.pagination.total = action.payload.length; // Update total based on fetched candidates
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
