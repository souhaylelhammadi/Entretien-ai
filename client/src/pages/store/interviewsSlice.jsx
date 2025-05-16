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
      const formData = new FormData();
      formData.append("video", recordedBlob, `interview_${interviewId}.webm`);
      formData.append("recordings", JSON.stringify(recordings));

      const response = await fetch(
        `${BASE_URL}/api/candidates/entretiens/${interviewId}/recordings`,
        {
          method: "POST",
          body: formData,
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Erreur lors de la sauvegarde de l'entretien"
        );
      }

      return { success: true, data };
    } catch (error) {
      return rejectWithValue(error.message);
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
      if (state.currentQuestionIndex < state.questions.length - 1) {
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
      if (index >= 0 && index < state.questions.length) {
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
      })
      .addCase(fetchInterviewDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.interviewDetails = action.payload;
        state.questions = action.payload.questions || [];
        state.currentQuestionIndex = 0;
      })
      .addCase(fetchInterviewDetails.rejected, (state, action) => {
        state.loading = false;
        state.error =
          action.payload || "Erreur lors du chargement de l'entretien";
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
      })
      .addCase(saveInterviewToDatabase.fulfilled, (state, action) => {
        state.savingInterview = false;
        state.interviewCompleted = true;
        state.status = "succeeded";
        state.error = null;
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
