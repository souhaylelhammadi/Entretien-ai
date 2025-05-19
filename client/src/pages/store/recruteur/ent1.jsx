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
  (error) => {
    return Promise.reject(error);
  }
);

// Fonction utilitaire pour valider les données d'entretien
const validateInterviewData = (interview) => {
  const requiredFields = [
    "id",
    "candidatId",
    "offreId",
    "recruteurId",
    "statut",
    "candidat",
    "offre",
  ];
  const missingFields = requiredFields.filter((field) => !interview[field]);

  if (missingFields.length > 0) {
    throw new Error(
      `Données d'entretien invalides: champs manquants: ${missingFields.join(
        ", "
      )}`
    );
  }

  // Vérifier les sous-champs critiques
  if (!interview.candidat.email || interview.candidat.email === "Non défini") {
    throw new Error(
      `Email du candidat manquant pour l'entretien ${interview.id}`
    );
  }
  if (!interview.offre.titre || interview.offre.titre === "Non défini") {
    throw new Error(
      `Titre de l'offre manquant pour l'entretien ${interview.id}`
    );
  }

  return true;
};

// Thunk pour récupérer les entretiens passés d'un recruteur
export const fetchRecruiterInterviews = createAsyncThunk(
  "entretiens/fetchRecruiterInterviews",
  async ({ page = 1, perPage = 10 }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        return rejectWithValue("Token d'authentification manquant");
      }

      const response = await api.get(
        `/api/recruteur/entretiens?page=${page}&per_page=${perPage}`
      );

      if (!response.data.interviews) {
        return rejectWithValue(
          response.data.error ||
            "Erreur lors de la récupération des entretiens passés"
        );
      }

      // Valider chaque entretien
      const validInterviews = response.data.interviews.filter((interview) => {
        try {
          validateInterviewData(interview);
          return true;
        } catch (error) {
          console.warn(`Entretien invalide (${interview.id}):`, error.message);
          return false;
        }
      });

      return {
        interviews: validInterviews,
        pagination: response.data.pagination,
      };
    } catch (error) {
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
      return rejectWithValue(
        error.response?.data?.error ||
          error.message ||
          "Erreur lors de la récupération des entretiens passés"
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
        return rejectWithValue(`Entretien invalide: ${error.message}`);
      }

      return response.data.interview;
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
  pagination: { page: 1, per_page: 10, total: 0, pages: 1 },
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
        state.pagination = action.payload.pagination;
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
