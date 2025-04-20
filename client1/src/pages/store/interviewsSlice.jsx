import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

const API_BASE_URL = "http://localhost:5000";

export const saveInterviewToDatabase = createAsyncThunk(
  "interview/saveInterviewToDatabase",
  async ({ applicationId }, { getState }) => {
    const { recordedBlob, recordings } = getState().interview;
    if (!recordedBlob) throw new Error("Aucune vidéo enregistrée");

    const formData = new FormData();
    formData.append("video", recordedBlob, `interview_${Date.now()}.webm`);
    formData.append("applicationId", applicationId);
    recordings.forEach((rec, index) => {
      formData.append(`transcript_${index}`, rec.transcript || "");
      formData.append(`questionIndex_${index}`, rec.questionIndex.toString());
      formData.append(`question_${index}`, rec.question);
      formData.append(`timestamp_${index}`, rec.timestamp);
    });

    const response = await fetch(`${API_BASE_URL}/api/save-recording`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: formData,
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Échec de l'enregistrement de la vidéo");
    }
    return data;
  }
);

export const fetchRecordings = createAsyncThunk(
  "interview/fetchRecordings",
  async ({ applicationId }) => {
    const response = await fetch(
      `${API_BASE_URL}/api/recordings?applicationId=${applicationId}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      }
    );
    const data = await response.json();
    if (!data.success) {
      throw new Error(
        data.error || "Échec du chargement des enregistrements précédents"
      );
    }
    return data.data.map((rec) => ({
      questionIndex: rec.questionIndex,
      transcript: rec.transcript,
      url: rec.videoUrl,
      timestamp: rec.timestamp,
      question: rec.question,
    }));
  }
);

const interviewSlice = createSlice({
  name: "interview",
  initialState: {
    webcamActive: false,
    isMuted: false,
    callTime: 0,
    localStream: null,
    currentQuestionIndex: 0,
    cameraError: false,
    transcript: "",
    isTranscribing: false,
    isRecording: false,
    recordedBlob: null,
    recordedVideoURL: "",
    isSpeaking: false,
    recordings: [],
    interviewCompleted: false,
    showModal: false,
    errorMessage: "",
    interviewStarted: false,
    questions: [],
  },
  reducers: {
    setState: (state, action) => {
      return { ...state, ...action.payload };
    },
    incrementCallTime: (state) => {
      state.callTime += 1;
      if (state.callTime >= 1800) {
        state.interviewCompleted = true;
      }
    },
    toggleMute: (state) => {
      if (state.localStream) {
        const audioTracks = state.localStream.getAudioTracks();
        audioTracks.forEach((track) => (track.enabled = !track.enabled));
        state.isMuted = !state.isMuted;
      }
    },
    hangUp: (state) => {
      if (state.localStream) {
        state.localStream.getTracks().forEach((track) => track.stop());
      }
      state.webcamActive = false;
      state.localStream = null;
      state.callTime = 0;
      state.cameraError = false;
      state.transcript = "";
      state.isTranscribing = false;
      state.isRecording = false;
      state.interviewStarted = false;
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        state.isSpeaking = false;
      }
    },
    startRecording: (state) => {
      state.isRecording = true;
    },
    stopRecording: (state) => {
      state.isRecording = false;
    },
    setRecordedBlob: (state, action) => {
      state.recordedBlob = action.payload.blob;
      state.recordedVideoURL = action.payload.url;
    },
    goToNextQuestion: (state) => {
      if (!state.interviewStarted) return;
      if (state.currentQuestionIndex < state.questions.length - 1) {
        state.recordings.push({
          questionIndex: state.currentQuestionIndex,
          transcript: state.transcript,
          question: state.questions[state.currentQuestionIndex],
          timestamp: new Date().toISOString(),
        });
        state.transcript = "";
        state.currentQuestionIndex += 1;
      } else {
        state.recordings.push({
          questionIndex: state.currentQuestionIndex,
          transcript: state.transcript,
          question: state.questions[state.currentQuestionIndex],
          timestamp: new Date().toISOString(),
        });
        state.interviewCompleted = true;
      }
    },
    goToPreviousQuestion: (state) => {
      if (!state.interviewStarted || state.currentQuestionIndex === 0) return;
      state.recordings.push({
        questionIndex: state.currentQuestionIndex,
        transcript: state.transcript,
        question: state.questions[state.currentQuestionIndex],
        timestamp: new Date().toISOString(),
      });
      state.transcript = "";
      state.currentQuestionIndex -= 1;
    },
    goToQuestion: (state, action) => {
      const index = action.payload;
      if (
        !state.interviewStarted ||
        index === state.currentQuestionIndex ||
        index < 0 ||
        index >= state.questions.length
      )
        return;
      state.recordings.push({
        questionIndex: state.currentQuestionIndex,
        transcript: state.transcript,
        question: state.questions[state.currentQuestionIndex],
        timestamp: new Date().toISOString(),
      });
      state.transcript = "";
      state.currentQuestionIndex = index;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(saveInterviewToDatabase.fulfilled, (state) => {
        state.errorMessage = "";
      })
      .addCase(saveInterviewToDatabase.rejected, (state, action) => {
        state.errorMessage =
          action.error.message ||
          "Échec de l'enregistrement de l'entretien. Veuillez réessayer.";
      })
      .addCase(fetchRecordings.fulfilled, (state, action) => {
        state.recordings = action.payload;
        state.errorMessage = "";
      })
      .addCase(fetchRecordings.rejected, (state, action) => {
        state.errorMessage =
          action.error.message ||
          "Échec du chargement des enregistrements précédents.";
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
