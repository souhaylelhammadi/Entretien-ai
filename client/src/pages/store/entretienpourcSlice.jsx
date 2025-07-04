import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { BASE_URL } from "../config"; // e.g., "http://localhost:5000"

// Helper to validate and log token
const getValidToken = () => {
  const token = localStorage.getItem("token");
  if (!token) {
    throw new Error("No token found");
  }
  return token.replace(/^Bearer\s+/i, "").trim();
};

// Action to fetch interview details
export const fetchInterviewDetails = createAsyncThunk(
  "interview/fetchDetails",
  async (interviewId, { rejectWithValue }) => {
    try {
      console.log(
        "Début de la récupération des détails de l'entretien:",
        interviewId
      );
      const token = getValidToken();
      console.log("Token validé:", token ? "Présent" : "Absent");

      const response = await axios.get(
        `${BASE_URL}/api/candidates/entretiens/${interviewId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("Réponse du serveur:", response.status, response.data);

      if (!response.data.success) {
        console.error("Erreur serveur:", response.data.error);
        return rejectWithValue(
          response.data.error || "Erreur lors de la récupération de l'entretien"
        );
      }

      const data = response.data.data;
      console.log("Données de l'entretien:", data);

      if (!data || !data.entretien) {
        console.error("Aucune donnée d'entretien dans la réponse");
        return rejectWithValue("Données d'entretien manquantes");
      }

      if (!data.questions || !Array.isArray(data.questions)) {
        console.error("Format de questions invalide:", data.questions);
        return rejectWithValue("Format de questions invalide");
      }

      if (data.questions.length === 0) {
        console.error("Aucune question trouvée dans l'entretien");
        return rejectWithValue("Aucune question disponible pour cet entretien");
      }

      console.log("Questions reçues:", data.questions);
      return {
        entretien: data.entretien,
        questions: data.questions,
        video: data.video,
      };
    } catch (error) {
      console.error("Erreur lors de la récupération:", error);

      if (error.response?.status === 401) {
        console.error("Session expirée");
        localStorage.removeItem("token");
        return rejectWithValue("Session expirée. Veuillez vous reconnecter.");
      }

      if (error.response?.status === 403) {
        console.error("Accès non autorisé");
        return rejectWithValue("Vous n'avez pas accès à cet entretien.");
      }

      if (error.response?.status === 404) {
        console.error("Entretien non trouvé");
        return rejectWithValue("Entretien non trouvé.");
      }

      return rejectWithValue(
        error.response?.data?.error ||
          "Erreur lors de la récupération de l'entretien"
      );
    }
  }
);

// Action to fetch recordings
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

      console.log("Recordings response:", response.status, response.data);

      if (response.data.success) {
        return response.data.recordings || [];
      } else {
        return rejectWithValue(response.data.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error fetching recordings:", error);
      console.error("Error details:", {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      });

      if (error.response?.status === 404) {
        return rejectWithValue("Recordings not found for this interview.");
      }
      if (error.response?.status === 403) {
        return rejectWithValue("Access to recordings is forbidden.");
      }
      if (error.response?.status === 401) {
        console.error("401 Unauthorized: Invalid or unauthorized token");
        localStorage.removeItem("token");
        return rejectWithValue("Session expired. Please log in again.");
      }
      return rejectWithValue(
        error.response?.data?.error || "Error fetching recordings"
      );
    }
  }
);

// Action to save interview
export const saveInterviewToDatabase = createAsyncThunk(
  "interview/saveInterviewToDatabase",
  async ({ interviewId, formData }, { rejectWithValue }) => {
    try {
      const token = getValidToken();
      console.log("Saving interview with data:", {
        interviewId,
        metadata: JSON.parse(formData.get("metadata")),
      });

      // Always use the candidate endpoint for this component
      const endpoint = `/api/candidates/entretiens/${interviewId}/save`;

      const response = await axios.post(`${BASE_URL}${endpoint}`, formData, {
        headers: {
          Authorization: token,
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("Save interview response:", response.data);

      if (!response.data.success) {
        throw new Error(response.data.error || "Failed to save interview");
      }

      return response.data;
    } catch (error) {
      console.error("Error saving interview:", error);
      console.error("Error details:", {
        status: error.response?.status,
        data: error.response?.data,
      });

      if (error.response?.status === 404) {
        return rejectWithValue("Interview not found for saving.");
      }
      if (error.response?.status === 403) {
        return rejectWithValue("Saving this interview is forbidden.");
      }
      if (error.response?.status === 401) {
        console.error("401 Unauthorized: Invalid or unauthorized token");
        localStorage.removeItem("token");
        return rejectWithValue("Session expired. Please log in again.");
      }
      return rejectWithValue(
        error.response?.data?.error || error.message || "Error saving interview"
      );
    }
  }
);

const initialState = {
  currentQuestionIndex: 0,
  transcript: {},
  isSpeaking: false,
  showModal: false,
  errorMessage: "",
  interviewStarted: false,
  questions: [],
  loading: false,
  savingInterview: false,
  error: null,
  interviewDetails: null,
  showConfirmModal: false,
  isProcessing: false,
  videoUrl: null,
  transcription: null,
  transcriptions: [],
};

const interviewSlice = createSlice({
  name: "interview",
  initialState,
  reducers: {
    setState: (state, action) => {
      Object.keys(action.payload).forEach((key) => {
        if (key !== "transcript") {
          state[key] = action.payload[key];
        } else {
          state.transcript = {
            ...state.transcript,
            ...action.payload.transcript,
          };
        }
      });
    },
    startInterview: (state) => {
      return {
        ...state,
        interviewStarted: true,
        currentQuestionIndex: 0,
        transcript: {},
        transcriptions: [],
        error: null,
        showModal: false,
        isSpeaking: false,
        isProcessing: false,
      };
    },
    stopInterview: (state) => {
      return {
        ...state,
        interviewStarted: false,
        currentQuestionIndex: 0,
        transcript: {},
        transcriptions: [],
        error: null,
        isSpeaking: false,
        isProcessing: false,
      };
    },
    goToPreviousQuestion: (state) => {
      if (state.currentQuestionIndex > 0) {
        state.currentQuestionIndex -= 1;
      }
    },
    setTranscript: (state, action) => {
      const { questionIndex, text } = action.payload;
      state.transcript[questionIndex] = text;
    },
    clearTranscript: (state) => {
      state.transcript = {};
    },
    setSpeaking: (state, action) => {
      state.isSpeaking = action.payload;
    },
    setConfirmModal: (state, action) => {
      state.showConfirmModal = action.payload;
    },
    setProcessing: (state, action) => {
      state.isProcessing = action.payload;
    },
    setVideoUrl: (state, action) => {
      state.videoUrl = action.payload;
    },
    setTranscription: (state, action) => {
      const { questionIndex, text } = action.payload;
      state.transcriptions = state.transcriptions.map((t) =>
        t.questionIndex === questionIndex ? { ...t, answer: text } : t
      );
    },
    addTranscription: (state, action) => {
      const { questionIndex, question, answer } = action.payload;
      const existingIndex = state.transcriptions.findIndex(
        (t) => t.questionIndex === questionIndex
      );

      if (existingIndex !== -1) {
        state.transcriptions[existingIndex] = {
          questionIndex,
          question,
          answer,
        };
      } else {
        state.transcriptions.push({
          questionIndex,
          question,
          answer,
        });
      }
    },
    clearTranscriptions: (state) => {
      state.transcriptions = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInterviewDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.questions = [];
        state.currentQuestionIndex = 0;
        state.isProcessing = true;
      })
      .addCase(fetchInterviewDetails.fulfilled, (state, action) => {
        console.log("Questions reçues:", action.payload.questions);
        state.loading = false;
        state.interviewDetails = action.payload.entretien;
        state.questions = Array.isArray(action.payload.questions)
          ? action.payload.questions
          : [];
        state.currentQuestionIndex = 0;
        state.error = null;
        state.isProcessing = false;
        state.videoUrl = action.payload.video?.url || null;
        state.transcription = action.payload.video?.transcription || null;
        state.transcriptions = action.payload.video?.transcriptions || [];
      })
      .addCase(fetchInterviewDetails.rejected, (state, action) => {
        console.error("Erreur lors de la récupération:", action.payload);
        state.loading = false;
        state.error = action.payload;
        state.questions = [];
        state.currentQuestionIndex = 0;
        state.isProcessing = false;
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
        state.error = action.payload || "Error fetching recordings";
      })
      .addCase(saveInterviewToDatabase.pending, (state) => {
        state.savingInterview = true;
        state.error = null;
      })
      .addCase(saveInterviewToDatabase.fulfilled, (state, action) => {
        state.savingInterview = false;
        state.interviewCompleted = true;
        state.error = null;
        if (action.payload.videoUrl) {
          state.videoUrl = action.payload.videoUrl;
        }
        if (action.payload.transcription) {
          state.transcription = action.payload.transcription;
        }
        if (action.payload.data) {
          state.interviewDetails = {
            ...state.interviewDetails,
            statut: action.payload.data.statut,
            transcription_completed:
              action.payload.data.transcription_completed,
            last_updated_by: action.payload.data.last_updated_by,
          };
          if (action.payload.data.recordings) {
            state.transcriptions = action.payload.data.recordings.map(
              (rec) => ({
                questionIndex: rec.questionIndex,
                question: rec.question,
                answer: rec.transcript,
              })
            );
          }
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
  startInterview,
  stopInterview,
  goToPreviousQuestion,
  setTranscript,
  clearTranscript,
  setSpeaking,
  setConfirmModal,
  setProcessing,
  setVideoUrl,
  setTranscription,
  addTranscription,
  clearTranscriptions,
} = interviewSlice.actions;

export default interviewSlice.reducer;
