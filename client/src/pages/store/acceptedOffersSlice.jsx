import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export const fetchAcceptedOffers = createAsyncThunk(
  "acceptedOffers/fetchAcceptedOffers",
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      console.log("État d'authentification:", auth);

      if (!auth || !auth.token) {
        console.log("Pas de token dans le state");
        throw new Error(
          "Vous devez être connecté pour accéder aux candidatures acceptées"
        );
      }

      const tokenObj = auth.token;
      console.log("Token object:", tokenObj);

      if (!tokenObj.value) {
        console.log("Pas de valeur dans le token");
        throw new Error("Token invalide");
      }

      const tokenValue = tokenObj.value.replace("Bearer ", "");
      console.log("Token value:", tokenValue);

      const response = await fetch(`${API_BASE_URL}/api/accepted-offers`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenValue}`,
        },
        credentials: "include",
        mode: "cors",
      });

      console.log("Response status:", response.status);

      const data = await response.json();
      console.log("Response data:", data);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          throw new Error("Session expirée. Veuillez vous reconnecter.");
        }
        throw new Error(
          data.error || "Échec de la récupération des candidatures acceptées"
        );
      }
      return data.acceptedOffers || [];
    } catch (error) {
      console.error("fetchAcceptedOffers error:", error.message);
      return rejectWithValue(error.message);
    }
  }
);

export const updateOfferStatus = createAsyncThunk(
  "acceptedOffers/updateOfferStatus",
  async ({ applicationId, status }, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      console.log("État d'authentification pour update:", auth);

      if (!auth || !auth.token) {
        console.log("Pas de token dans le state pour update");
        throw new Error(
          "Vous devez être connecté pour mettre à jour une candidature"
        );
      }

      const tokenObj = auth.token;
      console.log("Token object pour update:", tokenObj);

      if (!tokenObj.value) {
        console.log("Pas de valeur dans le token pour update");
        throw new Error("Token invalide");
      }

      const tokenValue = tokenObj.value.replace("Bearer ", "");
      console.log("Token value pour update:", tokenValue);

      const response = await fetch(
        `${API_BASE_URL}/api/accepted-offers/${applicationId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenValue}`,
          },
          credentials: "include",
          mode: "cors",
          body: JSON.stringify({ status }),
        }
      );

      console.log("Update response status:", response.status);

      const data = await response.json();
      console.log("Update response data:", data);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          throw new Error("Session expirée. Veuillez vous reconnecter.");
        }
        throw new Error(
          data.error || "Échec de la mise à jour du statut de la candidature"
        );
      }
      return data.data;
    } catch (error) {
      console.error("updateOfferStatus error:", error.message);
      return rejectWithValue(error.message);
    }
  }
);

const acceptedOffersSlice = createSlice({
  name: "acceptedOffers",
  initialState: {
    candidatures: [],
    loading: false,
    error: null,
  },
  reducers: {
    clearOffersError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAcceptedOffers.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.candidatures = [];
      })
      .addCase(fetchAcceptedOffers.fulfilled, (state, action) => {
        state.loading = false;
        state.candidatures = action.payload;
      })
      .addCase(fetchAcceptedOffers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.candidatures = [];
      })
      .addCase(updateOfferStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateOfferStatus.fulfilled, (state, action) => {
        state.loading = false;
        const updatedCandidature = action.payload;
        const index = state.candidatures.findIndex(
          (candidature) => candidature._id === updatedCandidature._id
        );
        if (index !== -1) {
          state.candidatures[index] = updatedCandidature;
        }
      })
      .addCase(updateOfferStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { clearOffersError } = acceptedOffersSlice.actions;
export default acceptedOffersSlice.reducer;
