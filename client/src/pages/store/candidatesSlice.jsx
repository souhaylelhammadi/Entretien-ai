import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// Configuration de base d'axios
const API_BASE_URL = "http://localhost:5000";
axios.defaults.baseURL = API_BASE_URL;

// Fonction utilitaire pour obtenir le token
const getToken = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    console.warn("Token non trouvé dans le localStorage");
    return null;
  }
  // Retourner le token tel quel, sans ajouter de préfixe Bearer
  return token;
};

// Async thunks
const fetchOffersWithCandidates = createAsyncThunk(
  "candidates/fetchOffersWithCandidates",
  async (_, { getState, rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        console.error("Token non trouvé dans le localStorage");
        return rejectWithValue("Utilisateur non connecté");
      }

      const { auth } = getState();
      if (!auth?.user?.role || auth.user.role !== "recruteur") {
        console.error("Rôle non autorisé:", auth?.user?.role);
        return rejectWithValue("Accès non autorisé - Rôle recruteur requis");
      }

      console.log(
        "Envoi de la requête avec le token:",
        token.substring(0, 20) + "..."
      );

      const response = await axios.get(
        "/api/candidates/offres-with-candidates",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Réponse reçue:", response.data);
      return response.data.offres;
    } catch (error) {
      console.error("Erreur lors de la récupération des offres:", error);
      if (error.response) {
        console.error("Détails de l'erreur:", error.response.data);
        return rejectWithValue(
          error.response.data.error ||
            "Erreur lors de la récupération des offres"
        );
      }
      return rejectWithValue("Erreur de connexion au serveur");
    }
  }
);

const downloadCV = createAsyncThunk(
  "candidates/downloadCV",
  async (candidatureId, { getState, rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return rejectWithValue("Utilisateur non connecté");
      }

      // Retourner l'URL du CV avec le token
      return {
        url: `/api/candidates/cv/${candidatureId}`,
        token: token,
      };
    } catch (error) {
      console.error("Erreur lors du téléchargement du CV:", error);
      return rejectWithValue(
        error.response?.data?.error || "Erreur lors du téléchargement du CV"
      );
    }
  }
);

const updateCandidateStatus = createAsyncThunk(
  "candidates/updateCandidateStatus",
  async ({ candidateId, status }, { getState, rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return rejectWithValue("Utilisateur non connecté");
      }

      const response = await axios.put(
        `/api/candidates/${candidateId}`,
        { status },
        {
          headers: { Authorization: token },
        }
      );

      return { id: candidateId, status };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error || "Erreur lors de la mise à jour du statut"
      );
    }
  }
);

const getLettreMotivation = createAsyncThunk(
  "candidates/getLettreMotivation",
  async (candidatureId, { getState, rejectWithValue }) => {
    try {
      const token = getToken();
      if (!token) {
        return rejectWithValue("Utilisateur non connecté");
      }

      const response = await axios.get(
        `/api/candidates/lettre/${candidatureId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération de la lettre de motivation:",
        error
      );
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la récupération de la lettre de motivation"
      );
    }
  }
);

const candidatesSlice = createSlice({
  name: "candidates",
  initialState: {
    offres: [],
    loading: false,
    error: null,
    expandedOffers: {},
    downloadProgress: 0,
    selectedLettreMotivation: null,
  },
  reducers: {
    toggleOffer: (state, action) => {
      const offerId = action.payload;
      state.expandedOffers[offerId] = !state.expandedOffers[offerId];
    },
    clearError: (state) => {
      state.error = null;
    },
    setDownloadProgress: (state, action) => {
      state.downloadProgress = action.payload;
    },
    clearLettreMotivation: (state) => {
      state.selectedLettreMotivation = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOffersWithCandidates.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOffersWithCandidates.fulfilled, (state, action) => {
        state.loading = false;
        state.offres = action.payload;
      })
      .addCase(fetchOffersWithCandidates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(downloadCV.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.downloadProgress = 0;
      })
      .addCase(downloadCV.fulfilled, (state) => {
        state.loading = false;
        state.downloadProgress = 100;
      })
      .addCase(downloadCV.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.downloadProgress = 0;
      })
      .addCase(updateCandidateStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCandidateStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.offres = state.offres.map((offre) => ({
          ...offre,
          candidats: offre.candidats.map((candidat) =>
            candidat.id === action.payload.id
              ? { ...candidat, status: action.payload.status }
              : candidat
          ),
        }));
      })
      .addCase(updateCandidateStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(getLettreMotivation.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getLettreMotivation.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedLettreMotivation = action.payload;
      })
      .addCase(getLettreMotivation.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { toggleOffer, clearError, setDownloadProgress, clearLettreMotivation } =
  candidatesSlice.actions;

export {
  fetchOffersWithCandidates,
  downloadCV,
  updateCandidateStatus,
  getLettreMotivation,
};

export default candidatesSlice.reducer;
