// interviewsSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import { BASE_URL } from "../../config";

// Action pour récupérer les détails de l'entretien
export const fetchInterviewDetails = createAsyncThunk(
  "interview/fetchDetails",
  async (interviewId, { rejectWithValue }) => {
    try {
      console.log("Début du chargement de l'entretien:", interviewId);
      const response = await axios.get(
        `${BASE_URL}/api/candidates/entretiens/${interviewId}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      console.log("Réponse du serveur:", response.status);

      if (response.data.success) {
        console.log("Données de l'entretien:", response.data.data);
        return response.data.data;
      } else {
        return rejectWithValue(response.data.error || "Erreur inconnue");
      }
    } catch (error) {
      console.error("Erreur lors du chargement:", error);
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
      const response = await axios.get(
        `http://localhost:5000/api/candidates/entretiens/${interviewId}/recordings`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (response.data.success) {
        return response.data.recordings || [];
      } else {
        return rejectWithValue(response.data.error || "Erreur inconnue");
      }
    } catch (error) {
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
  async ({ interviewId, recordedBlob, recordings }, { rejectWithValue }) => {
    try {
      // Convertir le blob en base64
      const reader = new FileReader();
      reader.readAsDataURL(recordedBlob);

      const base64Video = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
      });

      // Préparer les données à envoyer
      const data = {
        video: base64Video,
        recordings: recordings.map((recording) => ({
          questionIndex: recording.questionIndex,
          question: recording.question,
          transcript: recording.transcript || "",
          timestamp: recording.timestamp || new Date().toISOString(),
        })),
        completedAt: new Date().toISOString(),
      };

      console.log("Données à envoyer:", {
        videoSize: recordedBlob.size,
        recordingsCount: recordings.length,
        interviewId: interviewId,
      });

      // Envoyer les données au serveur
      const response = await axios.post(
        `${BASE_URL}/api/candidates/entretiens/${interviewId}/recordings`,
        data,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            console.log(`Progression de l'upload: ${percentCompleted}%`);
          },
        }
      );

      console.log("Réponse du serveur:", response.data);

      if (response.data.success) {
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        throw new Error(
          response.data.error || "Erreur lors de la sauvegarde de l'entretien"
        );
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      if (error.response) {
        console.error("Détails de l'erreur:", {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
          config: {
            url: error.config.url,
            method: error.config.method,
            headers: error.config.headers,
          },
        });
      }
      return rejectWithValue(
        error.response?.data?.error ||
          error.message ||
          "Erreur lors de la sauvegarde de l'entretien"
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
      state.recordedBlob = action.payload;
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
      // Gestion de fetchInterviewDetails
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
      // Gestion de fetchRecordings
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
      // Gestion de saveInterviewToDatabase
      .addCase(saveInterviewToDatabase.pending, (state) => {
        state.savingInterview = true;
        state.error = null;
      })
      .addCase(saveInterviewToDatabase.fulfilled, (state, action) => {
        state.savingInterview = false;
        state.interviewCompleted = true;
        state.status = "succeeded";
        state.error = null;
        // Mettre à jour les statuts
        if (action.payload.data) {
          state.interviewDetails = {
            ...state.interviewDetails,
            statut: action.payload.data.statut,
          };
        }
      })
      .addCase(saveInterviewToDatabase.rejected, (state, action) => {
        state.savingInterview = false;
        state.status = "failed";
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
