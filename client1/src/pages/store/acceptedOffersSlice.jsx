import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

export const fetchAcceptedOffers = createAsyncThunk(
  "acceptedOffers/fetchAcceptedOffers",
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      const token = auth.token;
      if (!token) {
        throw new Error(
          "Vous devez être connecté pour accéder aux candidatures acceptées"
        );
      }
      if (token.split(".").length !== 3) {
        localStorage.removeItem("token");
        throw new Error("Jeton malformé. Veuillez vous reconnecter.");
      }

      const response = await fetch(`${API_BASE_URL}/api/accepted-offers`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
        }
        throw new Error(
          data.error || "Échec de la récupération des candidatures acceptées"
        );
      }
      // Ensure the response is an array
      return Array.isArray(data.offers) ? data.offers : [];
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
      const token = auth.token;
      if (!token) {
        throw new Error(
          "Vous devez être connecté pour mettre à jour une candidature"
        );
      }
      if (token.split(".").length !== 3) {
        localStorage.removeItem("token");
        throw new Error("Jeton malformé. Veuillez vous reconnecter.");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/accepted-offers/${applicationId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
        }
        throw new Error(
          data.error || "Échec de la mise à jour du statut de la candidature"
        );
      }
      return data.offer;
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
        state.candidatures = []; // Reset to avoid undefined
      })
      .addCase(fetchAcceptedOffers.fulfilled, (state, action) => {
        state.loading = false;
        state.candidatures = action.payload;
      })
      .addCase(fetchAcceptedOffers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.candidatures = []; // Ensure array on error
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
