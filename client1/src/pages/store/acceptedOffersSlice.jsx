import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const API_BASE_URL = "http://localhost:5000";

export const fetchAcceptedOffers = createAsyncThunk(
  "acceptedOffers/fetchAcceptedOffers",
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accepted-offers`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch accepted offers");
      }
      return data.offers; // Return the array of offers
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateOfferStatus = createAsyncThunk(
  "acceptedOffers/updateOfferStatus",
  async ({ offerId, status }, { rejectWithValue }) => {
    try {
      // Note: In a real app, you'd need a token here for PUT requests
      const response = await fetch(
        `${API_BASE_URL}/api/accepted-offers/${offerId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            // Uncomment and add token if authentication is re-added
            // "Authorization": `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ status }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update offer status");
      }
      return data.offer; // Return the updated offer
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const acceptedOffersSlice = createSlice({
  name: "acceptedOffers",
  initialState: {
    offers: [],
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
      })
      .addCase(fetchAcceptedOffers.fulfilled, (state, action) => {
        state.loading = false;
        state.offers = action.payload;
      })
      .addCase(fetchAcceptedOffers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateOfferStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateOfferStatus.fulfilled, (state, action) => {
        state.loading = false;
        const updatedOffer = action.payload;
        const index = state.offers.findIndex(
          (offer) => offer._id === updatedOffer._id
        );
        if (index !== -1) {
          state.offers[index] = updatedOffer;
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
