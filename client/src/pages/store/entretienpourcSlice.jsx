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

// Action to fetch interview details
export const fetchInterviewDetails = createAsyncThunk(
  "interview/fetchDetails",
  async (interviewId, { rejectWithValue }) => {
    try {
      console.log("Starting to fetch interview:", interviewId);
      const token = getValidToken();
      console.log("Token used:", token);

      const response = await axios.get(
        `${BASE_URL}/api/candidates/entretiens/${interviewId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log("Server response:", response.status, response.data);

      if (response.data.success) {
        return response.data.data;
      } else {
        return rejectWithValue(response.data.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error fetching interview details:", error);
      console.error("Error details:", {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      });

      if (error.response?.status === 404) {
        return rejectWithValue(
          "This interview does not exist or is not accessible."
        );
      }
      if (error.response?.status === 403) {
        return rejectWithValue("Access to this interview is forbidden.");
      }
      if (error.response?.status === 401) {
        console.error("401 Unauthorized: Invalid or unauthorized token");
        localStorage.removeItem("token");
        return rejectWithValue("Session expired. Please log in again.");
      }
      return rejectWithValue(
        error.response?.data?.error || "Error fetching interview details"
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

      console.log("Save interview response:", response.data);
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
        error.response?.data?.error || "Error saving interview"
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
        timestamp: action.payload.timestamp,
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
        state.error = action.payload || "Error fetching interview details";
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
