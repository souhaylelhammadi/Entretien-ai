import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

// Configuration d'Axios
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000",
  headers: {
    "Content-Type": "application/json",
  },
});

// Intercepteur pour ajouter le token à chaque requête
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Fonction utilitaire pour valider les données d'entretien
const validateInterviewData = (interview) => {
  const requiredFields = [
    "id",
    "candidatId",
    "offreId",
    "recruteurId",
    "statut",
  ];
  const missingFields = requiredFields.filter((field) => !interview[field]);

  if (missingFields.length > 0) {
    throw new Error(
      `Données d'entretien invalides: champs manquants: ${missingFields.join(
        ", "
      )}`
    );
  }

  return true;
};

// Thunk pour récupérer les entretiens passés d'un recruteur
export const fetchRecruiterInterviews = createAsyncThunk(
  "entretiens/fetchRecruiterInterviews",
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Token non trouvé");
      }

      console.log("Fetching interviews...");
      const response = await api.get("/api/recruteur/entretiens");
      console.log("API Response:", response.data);

      if (!response.data.interviews) {
        console.error("No interviews array in response:", response.data);
        return rejectWithValue("Format de réponse invalide");
      }

      return response.data;
    } catch (error) {
      console.error("Error fetching interviews:", error);
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la récupération des entretiens"
      );
    }
  }
);

// Thunk pour récupérer les détails d'un entretien
export const fetchInterviewDetails = createAsyncThunk(
  "entretiens/fetchInterviewDetails",
  async (interviewId, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        return rejectWithValue("Token d'authentification manquant");
      }

      const response = await api.get(
        `/api/recruteur/entretiens/${interviewId}`
      );

      if (!response.data.interview) {
        return rejectWithValue(
          response.data.error || "Erreur lors de la récupération des détails"
        );
      }

      // Valider les détails de l'entretien
      try {
        validateInterviewData(response.data.interview);
      } catch (error) {
        console.error("Erreur de validation:", error);
        // On continue même si la validation échoue
      }

      return {
        ...response.data.interview,
        candidat: response.data.candidat,
        offre: response.data.offre,
        video: response.data.video,
      };
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
      return rejectWithValue(
        error.response?.data?.error ||
          error.message ||
          "Erreur lors de la récupération des détails de l'entretien"
      );
    }
  }
);

const initialState = {
  interviews: [],
  selectedInterview: null,
  loading: false,
  error: null,
};

const entretiensSlice = createSlice({
  name: "entretiens",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSelectedInterview: (state) => {
      state.selectedInterview = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecruiterInterviews.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRecruiterInterviews.fulfilled, (state, action) => {
        state.loading = false;
        state.interviews = action.payload.interviews;
      })
      .addCase(fetchRecruiterInterviews.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      })
      .addCase(fetchInterviewDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchInterviewDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedInterview = action.payload;
      })
      .addCase(fetchInterviewDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || action.error.message;
      });
  },
});

export const { clearError, clearSelectedInterview } = entretiensSlice.actions;
export default entretiensSlice.reducer;
