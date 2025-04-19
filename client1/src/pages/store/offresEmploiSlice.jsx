import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Utility for retrying failed requests
const retryRequest = async (fn, retries = 2, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1 || !err.code || err.code !== "ECONNABORTED") {
        throw err;
      }
      console.warn(`Retry ${i + 1}/${retries} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Async thunk to fetch all job offers
export const fetchOffresEmploi = createAsyncThunk(
  "offresEmploi/fetchOffresEmploi",
  async (_, { rejectWithValue }) => {
    try {
      const request = () =>
        axios.get(`${API_URL}/api/offres-emploi`, { timeout: 10000 });
      const response = await retryRequest(request);
      if (!response.data || !Array.isArray(response.data.offres)) {
        console.error(
          "Invalid response format: Expected an array in 'offres'",
          response.data
        );
        return rejectWithValue("Format de réponse invalide du serveur");
      }
      console.log("fetchOffresEmploi response:", response.data.offres);
      return response.data.offres.map((offre) => ({
        id: offre.id || "",
        titre: offre.titre || "Titre non spécifié",
        entreprise: offre.entreprise || "Entreprise non spécifiée",
        localisation: offre.localisation || "Localisation non spécifiée",
        valide: offre.valide !== undefined ? offre.valide : true,
        description: offre.description || "Description non disponible",
        competences_requises: Array.isArray(offre.competences_requises)
          ? offre.competences_requises
          : [],
        createdAt: offre.createdAt || new Date().toISOString(),
      }));
    } catch (error) {
      console.error("Fetch offres error:", error.message, error.response?.data);
      const message =
        error.response?.data?.error ||
        (error.code === "ECONNABORTED"
          ? "Délai d'attente dépassé. Vérifiez votre connexion."
          : error.message === "Network Error"
          ? "Erreur réseau. Vérifiez que le serveur est accessible."
          : "Erreur lors de la récupération des offres");
      return rejectWithValue(message);
    }
  }
);

// Async thunk to fetch a single job offer by ID
export const fetchOffreById = createAsyncThunk(
  "offresEmploi/fetchOffreById",
  async (id, { rejectWithValue }) => {
    try {
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        console.error("Invalid ObjectId:", id);
        throw new Error("ID de l’offre invalide");
      }
      const request = () =>
        axios.get(`${API_URL}/api/offres-emploi/${id}`, { timeout: 10000 });
      const response = await retryRequest(request);
      console.log("fetchOffreById response:", response.data);
      const offre = response.data;
      if (!offre || !offre.id) {
        console.error("Invalid offer data:", offre);
        return rejectWithValue("Données de l’offre invalides");
      }
      return {
        id: offre.id || id,
        titre: offre.titre || "Titre non spécifié",
        entreprise: offre.entreprise || "Entreprise non spécifiée",
        localisation: offre.localisation || "Localisation non spécifiée",
        description: offre.description || "Description non disponible",
        competences_requises: Array.isArray(offre.competences_requises)
          ? offre.competences_requises
          : [],
        salaire_min: offre.salaire_min || 0,
        createdAt: offre.createdAt || new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        "Fetch offre by ID error:",
        error.message,
        error.response?.data
      );
      const message =
        error.response?.data?.error ||
        (error.code === "ECONNABORTED"
          ? "Délai d'attente dépassé. Vérifiez votre connexion."
          : error.message === "Network Error"
          ? "Erreur réseau. Vérifiez que le serveur est accessible."
          : "Erreur lors de la récupération de l’offre");
      return rejectWithValue(message);
    }
  }
);

// Async thunk to submit a job application
export const submitCandidature = createAsyncThunk(
  "offresEmploi/submitCandidature",
  async ({ offreId, cv, lettreMotivation }, { getState, rejectWithValue }) => {
    try {
      if (!offreId || !cv || !lettreMotivation) {
        throw new Error(
          "Tous les champs (offreId, cv, lettreMotivation) sont requis"
        );
      }
      const { auth } = getState();
      const token = auth.token;
      if (!token) {
        return rejectWithValue("Vous devez être connecté pour postuler");
      }

      const formData = new FormData();
      formData.append("offre_id", offreId);
      formData.append("lettre_motivation", lettreMotivation);
      formData.append("cv", cv);

      console.log("Submitting candidature:", {
        offreId,
        cv: cv.name,
        lettreMotivation: lettreMotivation.substring(0, 50) + "...",
      });

      const request = () =>
        axios.post(`${API_URL}/api/candidatures`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
          timeout: 15000,
        });

      const response = await retryRequest(request);
      console.log("Submit candidature response:", response.data);
      return response.data;
    } catch (error) {
      console.error(
        "Submit candidature error:",
        error.message,
        error.response?.data
      );
      const message =
        error.response?.data?.error ||
        (error.code === "ECONNABORTED"
          ? "Délai d'attente dépassé. Vérifiez votre connexion."
          : error.message === "Network Error"
          ? "Erreur réseau. Vérifiez que le serveur est accessible."
          : "Erreur lors de l'envoi de la candidature");
      return rejectWithValue(message);
    }
  }
);

const offresEmploiSlice = createSlice({
  name: "offresEmploi",
  initialState: {
    offres: [],
    filteredOffres: [],
    selectedOffre: null,
    loading: false,
    error: null,
    searchTerm: "",
    locationFilter: "",
    secteurFilter: "",
    isFilterOpen: false,
    candidatureStatus: "idle", // idle, pending, success, failed
    candidatureError: null,
  },
  reducers: {
    setSearchTerm: (state, action) => {
      state.searchTerm = action.payload;
      state.filteredOffres = filterOffres(state);
    },
    setLocationFilter: (state, action) => {
      state.locationFilter = action.payload;
      state.filteredOffres = filterOffres(state);
    },
    setSecteurFilter: (state, action) => {
      state.secteurFilter = action.payload;
      state.filteredOffres = filterOffres(state);
    },
    toggleFilterOpen: (state) => {
      state.isFilterOpen = !state.isFilterOpen;
    },
    resetCandidatureStatus: (state) => {
      state.candidatureStatus = "idle";
      state.candidatureError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOffresEmploi.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOffresEmploi.fulfilled, (state, action) => {
        state.loading = false;
        state.offres = action.payload;
        state.filteredOffres = action.payload;
        console.log("fetchOffresEmploi fulfilled:", action.payload);
      })
      .addCase(fetchOffresEmploi.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload || "Erreur lors de la récupération des offres";
        console.error("fetchOffresEmploi rejected:", action.payload);
      })
      .addCase(fetchOffreById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOffreById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedOffre = action.payload;
        console.log("fetchOffreById fulfilled:", action.payload);
      })
      .addCase(fetchOffreById.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload || "Erreur lors de la récupération de l’offre";
        console.error("fetchOffreById rejected:", action.payload);
      })
      .addCase(submitCandidature.pending, (state) => {
        state.candidatureStatus = "pending";
        state.candidatureError = null;
      })
      .addCase(submitCandidature.fulfilled, (state, action) => {
        state.candidatureStatus = "success";
        state.candidatureError = null;
      })
      .addCase(submitCandidature.rejected, (state, action) => {
        state.candidatureStatus = "failed";
        state.candidatureError =
          action.payload || "Erreur lors de l'envoi de la candidature";
      });
  },
});

// Utility to filter job offers
const filterOffres = (state) => {
  const searchLower = state.searchTerm.toLowerCase();
  const locationLower = state.locationFilter.toLowerCase();
  const secteurLower = state.secteurFilter.toLowerCase();

  return state.offres.filter((offre) => {
    const titre = offre.titre?.toLowerCase() || "";
    const entreprise = offre.entreprise?.toLowerCase() || "";
    const localisation = offre.localisation?.toLowerCase() || "";

    return (
      (titre.includes(searchLower) ||
        entreprise.includes(searchLower) ||
        localisation.includes(searchLower)) &&
      (locationLower === "" || localisation.includes(locationLower)) &&
      (secteurLower === "" || entreprise.includes(secteurLower))
    );
  });
};

export const {
  setSearchTerm,
  setLocationFilter,
  setSecteurFilter,
  toggleFilterOpen,
  resetCandidatureStatus,
} = offresEmploiSlice.actions;

export default offresEmploiSlice.reducer;
