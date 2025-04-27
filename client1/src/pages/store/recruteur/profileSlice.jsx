// src/store/recruteur/profileSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// Helper function to get authorization header
const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("No token found");
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
};

export const fetchProfile = createAsyncThunk(
  "profile/fetchProfile",
  async (_, { rejectWithValue }) => {
    try {
      console.log("Fetching profile data...");
      const authHeader = getAuthHeader();
      
      // Check for correct API endpoint - updated to match server routes
      const response = await fetch("http://localhost:5000/api/recruteur/profile", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Profile fetch failed:", response.status, errorData);
        throw new Error(errorData.error || `Failed to fetch profile: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Profile data retrieved successfully:", data);
      return data.profile;
    } catch (err) {
      console.error("Fetch profile error:", err);
      return rejectWithValue(err.message);
    }
  }
);

export const updateProfileAsync = createAsyncThunk(
  "profile/updateProfile",
  async (profileData, { rejectWithValue }) => {
    try {
      console.log("Updating profile with data:", profileData);
      const authHeader = getAuthHeader();
      
      const updateData = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone,
        position: profileData.position,
        department: profileData.department,
        bio: profileData.bio,
        linkedin: profileData.linkedin,
      };
      
      // Check for correct API endpoint - updated to match server routes
      const response = await fetch("http://localhost:5000/api/recruteur/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
        body: JSON.stringify(updateData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Profile update failed:", response.status, errorData);
        throw new Error(errorData.error || errorData.details || `Failed to update profile: ${response.statusText}`);
      }
      
      // After successful update, fetch the updated profile
      const updatedProfileResponse = await fetch("http://localhost:5000/api/recruteur/profile", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader
        },
      });
      
      if (!updatedProfileResponse.ok) {
        console.warn("Could not fetch updated profile after update, returning submitted data");
        return { ...profileData, updated: true };
      }
      
      const updatedProfileData = await updatedProfileResponse.json();
      console.log("Profile updated successfully:", updatedProfileData);
      return updatedProfileData.profile;
    } catch (err) {
      console.error("Update profile error:", err);
      return rejectWithValue(err.message);
    }
  }
);

const profileSlice = createSlice({
  name: "profile",
  initialState: {
    profile: null,
    loading: false,
    error: null,
  },
  reducers: {
    updateProfile: (state, action) => {
      state.profile = { ...state.profile, ...action.payload };
    },
    clearProfileError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(updateProfileAsync.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateProfileAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.profile = action.payload;
      })
      .addCase(updateProfileAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { updateProfile, clearProfileError } = profileSlice.actions;
export default profileSlice.reducer;
