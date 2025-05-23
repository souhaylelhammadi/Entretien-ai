import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { BASE_URL } from "../../config";

// Helper to validate and log token
const getValidToken = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("No token found in localStorage");
    throw new Error("No token found");
  }
  const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
  try {
    const payload = JSON.parse(atob(cleanToken.split(".")[1]));
    console.log("Token payload:", payload);
  } catch (error) {
    console.error("Failed to decode token payload:", error);
  }
  return cleanToken;
};

// Action pour récupérer les détails de l'entretien
export const fetchInterviewDetails = createAsyncThunk(
  "interview/fetchDetails",
  async (interviewId, { rejectWithValue }) => {
    try {
      console.log("Début du chargement de l'entretien:", interviewId);
      const token = getValidToken();
      console.log("Token utilisé:", token);

      const response = await axios.get(
        `${BASE_URL}/api/candidates/entretiens/${interviewId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("Réponse du serveur:", response.status);
      console.log("Données de l'entretien:", response.data);

      if (response.data.success) {
        return response.data.data;
      } else {
        return rejectWithValue(response.data.error || "Erreur inconnue");
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
      console.error("Détails de l'erreur:", {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      });

      if (error.response?.status === 404) {
        return rejectWithValue(
          "Cet entretien n'existe pas ou n'est pas accessible."
        );
      }
      if (error.response?.status === 403) {
        return rejectWithValue("Accès à cet entretien interdit.");
      }
      if (error.response?.status === 401) {
        console.error("401 Unauthorized: Invalid or unauthorized token");
        localStorage.removeItem("token");
        return rejectWithValue("Session expirée. Veuillez vous reconnecter.");
      }
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la récupération des détails de l'entretien"
      );
    }
  }
);

// Action pour récupérer les enregistrements
export const fetchRecordings = createAsyncThunk(
  "interview/fetchRecordings",
  async (interviewId, { rejectWithValue }) => {
    try {
      const token = getValidToken();
      console.log("Fetching recordings for interview:", interviewId);

      const response = await axios.get(
        `${BASE_URL}/api/candidates/entretiens/${interviewId}/recordings`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("Recordings response:", response.status);
      console.log("Recordings data:", response.data);

      if (response.data.success) {
        return response.data.recordings || [];
      } else {
        return rejectWithValue(response.data.error || "Erreur inconnue");
      }
    } catch (error) {
      console.error("Erreur lors du chargement des enregistrements:", error);
      console.error("Détails de l'erreur:", {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      });

      if (error.response?.status === 404) {
        return rejectWithValue(
          "Enregistrements non trouvés pour cet entretien."
        );
      }
      if (error.response?.status === 403) {
        return rejectWithValue("Accès aux enregistrements interdit.");
      }
      if (error.response?.status === 401) {
        console.error("401 Unauthorized: Invalid or unauthorized token");
        localStorage.removeItem("token");
        return rejectWithValue("Session expirée. Veuillez vous reconnecter.");
      }
      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la récupération des enregistrements"
      );
    }
  }
);

// Action pour sauvegarder l'entretien
export const saveInterviewToDatabase = createAsyncThunk(
  "interview/saveInterviewToDatabase",
  async ({ interviewId, formData }, { rejectWithValue }) => {
    try {
      const token = getValidToken();

      const response = await axios.post(
        `${BASE_URL}/api/candidates/entretiens/${interviewId}/recordings`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      if (error.response?.status === 404) {
        return rejectWithValue("Entretien non trouvé pour la sauvegarde.");
      }
      if (error.response?.status === 403) {
        return rejectWithValue("Sauvegarde interdite pour cet entretien.");
      }
      if (error.response?.status === 401) {
        console.error("401 Unauthorized: Invalid or unauthorized token");
        localStorage.removeItem("token");
        return rejectWithValue("Session expirée. Veuillez vous reconnecter.");
      }
      return rejectWithValue(
        error.response?.data?.error || "Erreur lors de la sauvegarde"
      );
    }
  }
);

const initialState = {
  webcamActive: false,
  isMuted: false,
  callTime: 0,
  currentQuestionIndex: 0,
  cameraError: false,
  transcript: "",
  isTranscribing: false,
  isRecording: false,
  recordedBlob: null,
  isSpeaking: false,
  recordings: [],
  interviewCompleted: false,
  showModal: false,
  errorMessage: "",
  interviewStarted: false,
  questions: [],
  loading: false,
  loadingRecordings: false,
  savingInterview: false,
  error: null,
  interviewDetails: null,
};

const interviewSlice = createSlice({
  name: "interview",
  initialState,
  reducers: {
    setState: (state, action) => {
      return { ...state, ...action.payload };
    },
    incrementCallTime: (state) => {
      state.callTime += 1;
    },
    toggleMute: (state) => {
      state.isMuted = !state.isMuted;
    },
    hangUp: (state) => {
      state.webcamActive = false;
      state.callTime = 0;
      state.currentQuestionIndex = 0;
      state.isRecording = false;
      state.recordedBlob = null;
      state.recordings = [];
    },
    startRecording: (state) => {
      state.isRecording = true;
    },
    stopRecording: (state) => {
      state.isRecording = false;
    },
    setRecordedBlob: (state, action) => {
      state.recordedBlob = {
        size: action.payload.size,
        type: action.payload.type,
        timestamp: new Date().toISOString(),
      };
    },
    goToNextQuestion: (state) => {
      const questionsLength = state.questions?.length || 0;
      if (state.currentQuestionIndex < questionsLength - 1) {
        state.currentQuestionIndex += 1;
      }
    },
    goToPreviousQuestion: (state) => {
      if (state.currentQuestionIndex > 0) {
        state.currentQuestionIndex -= 1;
      }
    },
    goToQuestion: (state, action) => {
      const index = action.payload;
      const questionsLength = state.questions?.length || 0;
      if (index >= 0 && index < questionsLength) {
        state.currentQuestionIndex = index;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInterviewDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.questions = [];
        state.currentQuestionIndex = 0;
      })
      .addCase(fetchInterviewDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.interviewDetails = action.payload;
        state.questions = Array.isArray(action.payload?.questions)
          ? action.payload.questions
          : [];
        state.currentQuestionIndex = 0;
      })
      .addCase(fetchInterviewDetails.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload || "Erreur lors du chargement de l'entretien";
        state.questions = [];
        state.currentQuestionIndex = 0;
      })
      .addCase(fetchRecordings.pending, (state) => {
        state.loadingRecordings = true;
      })
      .addCase(fetchRecordings.fulfilled, (state, action) => {
        state.loadingRecordings = false;
        state.recordings = action.payload;
      })
      .addCase(fetchRecordings.rejected, (state, action) => {
        state.loadingRecordings = false;
        state.error =
          action.payload || "Erreur lors du chargement des enregistrements";
      })
      .addCase(saveInterviewToDatabase.pending, (state) => {
        state.savingInterview = true;
        state.error = null;
      })
      .addCase(saveInterviewToDatabase.fulfilled, (state, action) => {
        state.savingInterview = false;
        state.interviewCompleted = true;
        state.error = null;
        if (action.payload.data) {
          state.interviewDetails = {
            ...state.interviewDetails,
            statut: action.payload.data.statut,
          };
        }
      })
      .addCase(saveInterviewToDatabase.rejected, (state, action) => {
        state.savingInterview = false;
        state.error = action.payload;
      });
  },
});

export const {
  setState,
  incrementCallTime,
  toggleMute,
  hangUp,
  startRecording,
  stopRecording,
  setRecordedBlob,
  goToNextQuestion,
  goToPreviousQuestion,
  goToQuestion,
} = interviewSlice.actions;

export default interviewSlice.reducer;
