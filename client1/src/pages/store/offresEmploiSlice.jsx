import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

export const fetchOffresEmploi = createAsyncThunk(
  "offresEmploi/fetchOffresEmploi",
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        "http://localhost:5000/api/offres-emploi"
      );
      return response.data.map((offre) => ({
        id: offre._id || "",
        titre: offre.titre || "Titre non spécifié",
        entreprise: offre.entreprise?.nom || "Entreprise non spécifiée",
        localisation: offre.localisation || "Localisation non spécifiée",
        valide: true,
        description: offre.description || "Description non disponible",
        competences_requises: offre.competences_requises || [],
        createdAt: offre.created_at || new Date(),
      }));
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la récupération des offres"
      );
    }
  }
);

export const fetchOffreById = createAsyncThunk(
  "offresEmploi/fetchOffreById",
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/offres-emploi/${id}`
      );
      return {
        id: response.data._id || id,
        titre: response.data.titre || "Titre non spécifié",
        entreprise: response.data.entreprise?.nom || "Entreprise non spécifiée",
        localisation:
          response.data.localisation || "Localisation non spécifiée",
        description: response.data.description || "Description non disponible",
        competences_requises: response.data.competences_requises || [],
        salaire_min: response.data.salaire_min || 0,
        createdAt: response.data.created_at || new Date(),
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la récupération de l’offre"
      );
    }
  }
);

export const submitCandidature = createAsyncThunk(
  "offresEmploi/submitCandidature",
  async ({ offreId, cv, lettreMotivation }, { rejectWithValue }) => {
    try {
      const formData = new FormData();
      formData.append("cv", cv);
      formData.append("lettre_motivation", lettreMotivation);
      formData.append("offre_id", offreId);

      const response = await axios.post(
        "http://localhost:5000/api/candidatures",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de l'envoi de la candidature"
      );
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
    candidatureStatus: null,
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
      state.candidatureStatus = null;
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
      })
      .addCase(fetchOffresEmploi.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload || "Erreur lors de la récupération des offres";
      })
      .addCase(fetchOffreById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOffreById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedOffre = action.payload;
      })
      .addCase(fetchOffreById.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload || "Erreur lors de la récupération de l’offre";
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
        state.candidatureStatus = "error";
        state.candidatureError =
          action.payload || "Erreur lors de l'envoi de la candidature";
      });
  },
});

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
