import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { BASE_URL } from "../../config";

// Actions asynchrones
export const getOffresWithCandidates = createAsyncThunk(
  "candidates/getOffresWithCandidates",
  async (_, { getState }) => {
    const state = getState();
    const token = state.auth.token?.value || state.auth.token;

    if (!token) {
      throw new Error("Token d'authentification manquant");
    }

    // Nettoyer le token pour éviter le double préfixe Bearer
    const cleanToken = token.replace(/^Bearer\s+Bearer\s+/, 'Bearer ').replace(/^Bearer\s+/, 'Bearer ');

    const response = await fetch(
      `${BASE_URL}/api/candidates/offres-with-candidates`,
      {
        headers: {
          Authorization: cleanToken,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || "Erreur lors de la récupération des offres"
      );
    }

    return response.json();
  }
);

export const downloadCV = createAsyncThunk(
  "candidates/downloadCV",
  async (candidatureId, { getState }) => {
    const state = getState();
    const token = state.auth.token?.value || state.auth.token;

    if (!token) {
      throw new Error("Token d'authentification manquant");
    }

    // Nettoyer le token pour éviter le double préfixe Bearer
    const cleanToken = token.replace(/^Bearer\s+Bearer\s+/, 'Bearer ').replace(/^Bearer\s+/, 'Bearer ');

    const response = await fetch(
      `${BASE_URL}/api/candidates/cv/${candidatureId}`,
      {
        headers: {
          Authorization: cleanToken,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur lors du téléchargement du CV");
    }

    return response.blob();
  }
);

export const getLettreMotivation = createAsyncThunk(
  "candidates/getLettreMotivation",
  async (candidatureId, { getState }) => {
    const state = getState();
    const token = state.auth.token?.value || state.auth.token;

    if (!token) {
      throw new Error("Token d'authentification manquant");
    }

    // Nettoyer le token pour éviter le double préfixe Bearer
    const cleanToken = token.replace(/^Bearer\s+Bearer\s+/, 'Bearer ').replace(/^Bearer\s+/, 'Bearer ');

    const response = await fetch(
      `${BASE_URL}/api/candidates/lettre/${candidatureId}`,
      {
        headers: {
          Authorization: cleanToken,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || "Erreur lors de la récupération de la lettre"
      );
    }

    const data = await response.json();
    return data;
  }
);

export const updateCandidateStatus = createAsyncThunk(
  "candidates/updateStatus",
  async ({ candidatureId, status }, { getState }) => {
    const state = getState();
    const token = state.auth.token?.value || state.auth.token;

    if (!token) {
      throw new Error("Token d'authentification manquant");
    }

    // Nettoyer le token pour éviter le double préfixe Bearer
    const cleanToken = token.replace(/^Bearer\s+Bearer\s+/, 'Bearer ').replace(/^Bearer\s+/, 'Bearer ');

    const response = await fetch(
      `${BASE_URL}/api/candidates/${candidatureId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: cleanToken,
        },
        body: JSON.stringify({ status }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Erreur lors de la mise à jour du statut");
    }

    return response.json();
  }
);

const initialState = {
  offres: [],
  loading: false,
  error: null,
  expandedOffers: {},
  downloadProgress: 0,
  cvLoadingStates: {},
  lettreMotivation: null,
};

const candidatesSlice = createSlice({
  name: "candidates",
  initialState,
  reducers: {
    toggleOffer: (state, action) => {
      const offerId = action.payload;
      state.expandedOffers[offerId] = !state.expandedOffers[offerId];
    },
    clearError: (state) => {
      state.error = null;
    },
    clearLettreMotivation: (state) => {
      state.lettreMotivation = null;
    },
    clearSelectedCV: (state) => {
      state.selectedCV = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // getOffresWithCandidates
      .addCase(getOffresWithCandidates.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getOffresWithCandidates.fulfilled, (state, action) => {
        state.loading = false;
        state.offres = action.payload.offres;
      })
      .addCase(getOffresWithCandidates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // downloadCV
      .addCase(downloadCV.pending, (state, action) => {
        state.cvLoadingStates[action.meta.arg] = true;
      })
      .addCase(downloadCV.fulfilled, (state, action) => {
        state.cvLoadingStates[action.meta.arg] = false;
      })
      .addCase(downloadCV.rejected, (state, action) => {
        state.cvLoadingStates[action.meta.arg] = false;
        state.error = action.error.message;
      })
      // getLettreMotivation
      .addCase(getLettreMotivation.fulfilled, (state, action) => {
        state.lettreMotivation = action.payload;
      })
      .addCase(getLettreMotivation.rejected, (state, action) => {
        state.error = action.error.message;
      })
      // updateCandidateStatus
      .addCase(updateCandidateStatus.fulfilled, (state, action) => {
        // Mise à jour du statut dans la liste des candidatures
        const { candidatureId, status } = action.meta.arg;
        state.offres = state.offres.map((offre) => ({
          ...offre,
          candidats: offre.candidats.map((candidat) =>
            candidat.id === candidatureId ? { ...candidat, status } : candidat
          ),
        }));
      })
      .addCase(updateCandidateStatus.rejected, (state, action) => {
        state.error = action.error.message;
      });
  },
});

export const {
  toggleOffer,
  clearError,
  clearLettreMotivation,
  clearSelectedCV,
} = candidatesSlice.actions;

export default candidatesSlice.reducer;
