import React, { useRef, useState, useEffect, useCallback } from "react";
import { Mic, MicOff, PhoneOff, Volume2, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchInterviewDetails,
  saveInterviewToDatabase,
  setState,
  startInterview,
  stopInterview,
  goToNextQuestion,
  goToPreviousQuestion,
  setSpeaking,
  setConfirmModal,
  setProcessing,
} from "./store/entretienpourcSlice";
import { toast } from "react-hot-toast";
import { BASE_URL } from "../config";

const API_BASE_URL = BASE_URL;

// Fonction pour initialiser la reconnaissance vocale
const initializeSpeechRecognition = () => {
  if ('webkitSpeechRecognition' in window) {
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'fr-FR';
    return recognition;
  }
  return null;
};

// Fonction pour initialiser la synthèse vocale
const initializeSpeechSynthesis = () => {
  if ('speechSynthesis' in window) {
    return window.speechSynthesis;
  }
  return null;
};

const Interview = () => {
  const { interviewId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const {
    questions,
    currentQuestionIndex,
    isSpeaking,
    loading,
    error,
    interviewStarted,
    interviewDetails,
    savingInterview,
    showConfirmModal,
    isProcessing,
  } = useSelector((state) => state.interview);

  const localRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const synthesisRef = useRef(null);

  const [localState, setLocalState] = useState({
    webcamActive: false,
    isMuted: false,
    callTime: 0,
    localStream: null,
    cameraError: false,
    isRecording: false,
    recordedBlob: null,
    recordedVideoURL: "",
    recordings: [],
    interviewCompleted: false,
    showModal: false,
    errorMessage: "",
    startTime: null,
    isListening: false,
    transcriptions: [],
    currentTranscription: "",
  });

  const maxDuration = 1800; // 30 minutes

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  useEffect(() => {
    if (interviewId) {
      dispatch(fetchInterviewDetails(interviewId));
    }
  }, [dispatch, interviewId]);

  useEffect(() => {
    if (error) {
      setLocalState((prev) => ({
        ...prev,
        errorMessage: error,
      }));
    }
  }, [error]);

  useEffect(() => {
    let interval;
    if (localState.webcamActive) {
      interval = setInterval(() => {
        setLocalState((prev) => {
          const newTime = prev.callTime + 1;
          if (newTime >= maxDuration) {
            completeInterview();
          }
          return { ...prev, callTime: newTime };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [localState.webcamActive]);

  useEffect(() => {
    if (localState.interviewCompleted) {
      navigate("/home");
    }
  }, [localState.interviewCompleted, navigate]);

  const completeInterview = async () => {
    try {
      setProcessing(true);

      // Sauvegarder la dernière transcription si elle existe
      saveTranscription();

      // Arrêter l'enregistrement en cours
      if (localState.isRecording) {
        await stopRecording();
      }

      // Arrêter la webcam et nettoyer les ressources
      if (localState.localStream) {
        localState.localStream.getTracks().forEach((track) => track.stop());
      }

      // Annuler toute synthèse vocale en cours
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        dispatch(setSpeaking(false));
      }

      const metadata = {
        interviewId,
        duration: Math.floor((Date.now() - localState.startTime) / 1000),
        questionCount: questions.length,
        completedQuestions: currentQuestionIndex + 1,
        transcriptions: localState.transcriptions,
      };

      console.log("Saving interview with metadata:", metadata);

      // Prepare form data
      const formData = new FormData();
      formData.append("metadata", JSON.stringify(metadata));
      if (localState.recordedBlob) {
        formData.append("video", localState.recordedBlob, "interview.webm");
      }

      // Get token and clean it
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Clean token (remove Bearer prefix if present)
      const cleanToken = token.replace(/^Bearer\s+/i, "").trim();

      // Make the request directly to the candidate endpoint
      const response = await fetch(
        `${API_BASE_URL}/api/candidates/entretiens/${interviewId}/save`,
        {
          method: "POST",
          headers: {
            Authorization: cleanToken,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save interview");
      }

      const data = await response.json();
      console.log("Interview saved successfully:", data);

      // Update Redux state with video URL and transcription
      dispatch(
        setState({
          interviewDetails: {
            ...interviewDetails,
            videoUrl: data.videoUrl,
            status: "completed",
            transcriptions: localState.transcriptions,
            completed_at: new Date().toISOString(),
            last_updated_by: data.last_updated_by,
          },
        })
      );

      // Mettre à jour l'état local pour désactiver la webcam
      setLocalState((prev) => ({
        ...prev,
        webcamActive: false,
        localStream: null,
        isRecording: false,
        recordedBlob: null,
        recordedVideoURL: "",
        errorMessage: "",
        transcriptions: [],
        currentTranscription: "",
      }));

      // Navigate to success page
      navigate("/mesinterview");
    } catch (error) {
      console.error("Error saving interview:", error);
      setLocalState((prev) => ({
        ...prev,
        errorMessage: "Failed to save interview. Please try again.",
      }));
    } finally {
      setProcessing(false);
    }
  };

  const setupSources = async () => {
    try {
      const constraints = { video: true, audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (stream.getVideoTracks().length === 0) {
        throw new Error("No video track available");
      }

      setLocalState((prev) => ({
        ...prev,
        localStream: stream,
        startTime: Date.now(),
      }));

      setTimeout(() => {
        if (localRef.current) {
          localRef.current.srcObject = stream;
          localRef.current
            .play()
            .catch((e) => console.error("Error playing video:", e));
        }
      }, 100);

      setLocalState((prev) => ({
        ...prev,
        webcamActive: true,
        cameraError: false,
      }));

      dispatch(startInterview());

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm",
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm",
        });
        setLocalState((prev) => ({
          ...prev,
          recordedBlob: blob,
          recordedVideoURL: URL.createObjectURL(blob),
        }));
        recordedChunksRef.current = [];
      };

      mediaRecorderRef.current = mediaRecorder;

      setTimeout(() => {
        startRecording();
        speakQuestion();
      }, 1000);
    } catch (error) {
      console.error("Error setting up media sources:", error);
      setLocalState((prev) => ({
        ...prev,
        cameraError: true,
        webcamActive: true,
        showModal:
          error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError",
      }));
    }
  };

  const toggleMute = () => {
    if (localState.localStream) {
      const audioTracks = localState.localStream.getAudioTracks();
      audioTracks.forEach((track) => (track.enabled = !track.enabled));
      setLocalState((prev) => ({
        ...prev,
        isMuted: !prev.isMuted,
      }));
    }
  };

  const hangUp = () => {
    if (localState.isRecording) stopRecording();
    if (localState.localStream)
      localState.localStream.getTracks().forEach((track) => track.stop());
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      dispatch(setSpeaking(false));
    }
    setLocalState((prev) => ({
      ...prev,
      webcamActive: false,
      localStream: null,
      callTime: 0,
      cameraError: false,
      interviewStarted: false,
    }));
  };

  const startRecording = () => {
    if (mediaRecorderRef.current && !localState.isRecording) {
      recordedChunksRef.current = [];
      mediaRecorderRef.current.start();
      setLocalState((prev) => ({ ...prev, isRecording: true }));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && localState.isRecording) {
      mediaRecorderRef.current.stop();
      setLocalState((prev) => ({ ...prev, isRecording: false }));
    }
  };

  const saveInterviewToDatabase = async () => {
    if (!localState.recordedBlob) return;

    try {
      dispatch(setProcessing(true));
      const formData = new FormData();

      // Ajouter la vidéo
      formData.append(
        "video",
        localState.recordedBlob,
        `interview_${interviewId}_${Date.now()}.webm`
      );

      // Ajouter les métadonnées
      const metadata = {
        interviewId,
        duration: localState.callTime,
        questionCount: questions.length,
        completedQuestions: currentQuestionIndex + 1,
        recordings: localState.recordings.map((rec, index) => ({
          questionIndex: rec.questionIndex,
          question: rec.question,
          timestamp: rec.timestamp,
        })),
      };
      formData.append("metadata", JSON.stringify(metadata));

      const response = await fetch(
        `${API_BASE_URL}/api/recruteur/entretiens/${interviewId}/save`,
        {
          method: "POST",
          headers: {
            Authorization: localStorage.getItem("token"),
          },
          body: formData,
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save interview");
      }

      // Mettre à jour l'état avec l'URL de la vidéo
      if (data.videoUrl) {
        dispatch(
          setState({
            interviewDetails: {
              ...interviewDetails,
              videoUrl: data.videoUrl,
              status: "terminée",
              transcription: data.transcription,
            },
          })
        );
      }

      console.log("Interview saved successfully:", data);
      setLocalState((prev) => ({ ...prev, errorMessage: "" }));
    } catch (error) {
      console.error("Error saving interview:", error);
      setLocalState((prev) => ({
        ...prev,
        errorMessage: "Failed to save interview. Please try again.",
      }));
    } finally {
      dispatch(setProcessing(false));
    }
  };

  const speakQuestion = useCallback(() => {
    if (!("speechSynthesis" in window) || !questions.length) {
      console.warn("Text-to-speech is not supported by this browser");
      return;
    }

    try {
      // Annuler toute synthèse vocale en cours
      window.speechSynthesis.cancel();
      dispatch(setSpeaking(false));

      const currentQuestion = questions[currentQuestionIndex];
      if (!currentQuestion) {
        console.warn(
          "No question available for current index:",
          currentQuestionIndex
        );
        return;
      }

      const questionText = currentQuestion.question || "No question available";
      const speech = new SpeechSynthesisUtterance(questionText);
      speech.lang = "fr-FR";
      speech.rate = 0.9;
      speech.pitch = 1;
      
      // Attendre que les voix soient chargées
      const voices = window.speechSynthesis.getVoices();
      const frenchVoices = voices.filter((voice) => voice.lang.includes("fr-"));
      if (frenchVoices.length > 0) {
        speech.voice = frenchVoices[0];
      } else {
        // Si les voix ne sont pas encore chargées, attendre
        window.speechSynthesis.onvoiceschanged = () => {
          const voices = window.speechSynthesis.getVoices();
          const frenchVoices = voices.filter((voice) =>
            voice.lang.includes("fr-")
          );
          if (frenchVoices.length > 0) {
            speech.voice = frenchVoices[0];
            try {
              window.speechSynthesis.speak(speech);
            } catch (error) {
              console.error("Error starting speech synthesis:", error);
              dispatch(setSpeaking(false));
            }
          }
        };
      }

      // Gérer les événements du speech
      speech.onstart = () => {
        console.log("Speech started for question:", currentQuestionIndex);
        dispatch(setSpeaking(true));
      };

      speech.onend = () => {
        console.log("Speech ended for question:", currentQuestionIndex);
        dispatch(setSpeaking(false));
      };

      speech.onerror = (event) => {
        console.error("Text-to-speech error:", event);
        dispatch(setSpeaking(false));
      };

      // Lancer la synthèse vocale
      try {
        window.speechSynthesis.speak(speech);
      } catch (error) {
        console.error("Error starting speech synthesis:", error);
        dispatch(setSpeaking(false));
      }
    } catch (error) {
      console.error("Error in speakQuestion:", error);
      dispatch(setSpeaking(false));
    }
  }, [questions, currentQuestionIndex, dispatch]);

  // Initialiser la reconnaissance vocale
  useEffect(() => {
    if (interviewStarted && !recognitionRef.current) {
      recognitionRef.current = initializeSpeechRecognition();
      if (recognitionRef.current) {
        recognitionRef.current.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0].transcript)
            .join("");

          setLocalState((prev) => ({
            ...prev,
            currentTranscription: transcript,
          }));
        };

        recognitionRef.current.onend = () => {
          if (localState.isListening) {
            recognitionRef.current.start();
          }
        };

        recognitionRef.current.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
          setLocalState((prev) => ({
            ...prev,
            isListening: false,
            errorMessage: `Erreur de reconnaissance vocale: ${event.error}`,
          }));
        };
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [interviewStarted]);

  // Démarrer la reconnaissance vocale après que la question a été posée
  useEffect(() => {
    if (
      interviewStarted &&
      !isSpeaking &&
      recognitionRef.current &&
      !localState.isListening
    ) {
      try {
        recognitionRef.current.start();
        setLocalState((prev) => ({
          ...prev,
          isListening: true,
        }));
      } catch (error) {
        console.error("Error starting speech recognition:", error);
      }
    }
  }, [interviewStarted, isSpeaking]);

  // Arrêter la reconnaissance vocale avant de passer à la question suivante
  useEffect(() => {
    if (!interviewStarted || isSpeaking) {
      if (recognitionRef.current && localState.isListening) {
        try {
          recognitionRef.current.stop();
          setLocalState((prev) => ({
            ...prev,
            isListening: false,
          }));
        } catch (error) {
          console.error("Error stopping speech recognition:", error);
        }
      }
    }
  }, [interviewStarted, isSpeaking]);

  // Sauvegarder la transcription quand on passe à la question suivante
  const saveTranscription = useCallback(() => {
    if (localState.currentTranscription) {
      setLocalState((prev) => ({
        ...prev,
        transcriptions: [
          ...prev.transcriptions,
          {
            questionIndex: currentQuestionIndex,
            question: questions[currentQuestionIndex]?.question,
            answer: localState.currentTranscription,
          },
        ],
        currentTranscription: "",
      }));
    }
  }, [currentQuestionIndex, questions, localState.currentTranscription]);

  // Modifier handleNextQuestion pour sauvegarder la transcription
  const handleNextQuestion = useCallback(async () => {
    if (!interviewStarted || isProcessing) return;

    try {
      dispatch(setProcessing(true));

      // Sauvegarder la transcription actuelle
      saveTranscription();

      // Arrêter l'enregistrement en cours
      if (localState.isRecording) {
        await stopRecording();
      }

      // Annuler toute synthèse vocale en cours
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        dispatch(setSpeaking(false));
      }

      // Attendre un court instant pour s'assurer que tout est arrêté
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (currentQuestionIndex < questions.length - 1) {
        dispatch(goToNextQuestion());

        // Attendre un court instant avant de démarrer l'enregistrement et la synthèse vocale
        await new Promise((resolve) => setTimeout(resolve, 300));

        startRecording();
        speakQuestion();
      } else {
        await completeInterview();
      }
    } catch (error) {
      console.error("Error in handleNextQuestion:", error);
      setLocalState((prev) => ({
        ...prev,
        errorMessage: "Error moving to next question. Please try again.",
      }));
    } finally {
      dispatch(setProcessing(false));
    }
  }, [
    dispatch,
    interviewStarted,
    currentQuestionIndex,
    questions.length,
    stopRecording,
    startRecording,
    speakQuestion,
    isProcessing,
    localState.isRecording,
    completeInterview,
    saveTranscription,
  ]);

  // Navigate to previous question
  const handlePreviousQuestion = useCallback(async () => {
    if (!interviewStarted || currentQuestionIndex === 0 || isProcessing) return;

    try {
      dispatch(setProcessing(true));

      // Arrêter l'enregistrement en cours
      if (localState.isRecording) {
        await stopRecording();
      }

      // Annuler toute synthèse vocale en cours
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        dispatch(setSpeaking(false));
      }

      // Attendre un court instant pour s'assurer que tout est arrêté
      await new Promise((resolve) => setTimeout(resolve, 100));

      dispatch(goToPreviousQuestion());

      // Attendre un court instant avant de démarrer l'enregistrement et la synthèse vocale
      await new Promise((resolve) => setTimeout(resolve, 300));

      startRecording();
      speakQuestion();
    } catch (error) {
      console.error("Error in handlePreviousQuestion:", error);
      setLocalState((prev) => ({
        ...prev,
        errorMessage: "Error moving to previous question. Please try again.",
      }));
    } finally {
      dispatch(setProcessing(false));
    }
  }, [
    dispatch,
    interviewStarted,
    currentQuestionIndex,
    stopRecording,
    startRecording,
    speakQuestion,
    isProcessing,
    localState.isRecording,
  ]);

  // Go to specific question
  const handleGoToQuestion = useCallback(
    async (index) => {
      if (
        !interviewStarted ||
        index === currentQuestionIndex ||
        index < 0 ||
        index >= questions.length ||
        isProcessing
      )
        return;

      try {
        dispatch(setProcessing(true));

        // Arrêter l'enregistrement en cours
        if (localState.isRecording) {
          await stopRecording();
        }

        // Annuler toute synthèse vocale en cours
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
          dispatch(setSpeaking(false));
        }

        // Attendre un court instant pour s'assurer que tout est arrêté
        await new Promise((resolve) => setTimeout(resolve, 100));

        dispatch(setState({ currentQuestionIndex: index }));

        // Attendre un court instant avant de démarrer l'enregistrement et la synthèse vocale
        await new Promise((resolve) => setTimeout(resolve, 300));

        startRecording();
        speakQuestion();
      } catch (error) {
        console.error("Error in handleGoToQuestion:", error);
        setLocalState((prev) => ({
          ...prev,
          errorMessage: "Error moving to question. Please try again.",
        }));
      } finally {
        dispatch(setProcessing(false));
      }
    },
    [
      dispatch,
      interviewStarted,
      currentQuestionIndex,
      questions.length,
      stopRecording,
      startRecording,
      speakQuestion,
      isProcessing,
      localState.isRecording,
    ]
  );

  const timePercentage = (localState.callTime / maxDuration) * 100;

  useEffect(() => {
    if (localRef.current && localState.localStream) {
      localRef.current.srcObject = localState.localStream;
    }
  }, [localState.localStream]);

  return (
    <div className="flex flex-col items-center min-h-screen w-full bg-white">
      <header className="w-full max-w-6xl p-2 text-center">
        <div className="flex justify-between items-start">
          {!localState.webcamActive && (
            <button
              onClick={setupSources}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md mb-6"
              disabled={loading}
            >
              {loading ? "Loading..." : "Start Interview"}
            </button>
          )}
          <div className="flex-grow text-center">
            <div className="text-blue-500 mt-2">
              Question {currentQuestionIndex + 1} of {questions.length} (
              {formatTime(localState.callTime)} elapsed)
            </div>
            <div className="w-full max-w-6xl mb-4">
              <div className="relative pt-1">
                <div className="overflow-hidden h-2 mb-1 text-xs flex rounded bg-blue-100">
                  <div
                    style={{ width: `${timePercentage}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-300"
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-blue-500">
                  <span>0:00</span>
                  <span>{formatTime(localState.callTime)}</span>
                  <span>{formatTime(maxDuration)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full max-w-6xl flex flex-col md:flex-row gap-6">
        <div className="md:w-1/2 bg-blue-50 rounded-xl p-6 shadow-md border border-blue-100">
          <div className="aspect-video bg-black rounded-lg relative">
            {localState.webcamActive ? (
              localState.cameraError ? (
                <div className="w-full h-full flex items-center justify-center text-white">
                  Camera access denied
                </div>
              ) : (
                <>
                  <video
                    ref={localRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover rounded-lg"
                  />
                  {localState.isRecording && (
                    <div className="absolute top-4 right-4 flex items-center bg-red-600 text-white px-3 py-1 rounded-full text-sm">
                      <span className="animate-pulse w-3 h-3 bg-white rounded-full mr-2"></span>
                      Recording
                    </div>
                  )}
                </>
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                Camera Off
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-center space-x-4">
            {localState.webcamActive && (
              <>
                <button
                  onClick={toggleMute}
                  className={`p-4 rounded-full transition-all shadow-md flex items-center justify-center ${
                    localState.isMuted
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-blue-500 hover:bg-blue-600"
                  } text-white`}
                >
                  {localState.isMuted ? (
                    <MicOff size={24} />
                  ) : (
                    <Mic size={24} />
                  )}
                </button>

                <button
                  onClick={hangUp}
                  className="bg-red-600 text-white p-4 rounded-full hover:bg-red-700 transition-all shadow-md flex items-center justify-center"
                >
                  <PhoneOff size={24} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="md:w-1/2 flex flex-col gap-6">
          <div className="bg-blue-500 rounded-xl mb-4 p-6 shadow-lg">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-white">
                Question {currentQuestionIndex + 1}
              </h3>
              {isSpeaking && (
                <div className="flex items-center text-white text-sm">
                  <span className="mr-2">Speaking</span>
                  <div className="flex space-x-1">
                    <span className="w-2 h-2 bg-white rounded-full animate-bounce"></span>
                    <span
                      className="w-2 h-2 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></span>
                    <span
                      className="w-2 h-2 bg-white rounded-full animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    ></span>
                  </div>
                </div>
              )}
            </div>
            <p className="text-white text-lg">
              {questions[currentQuestionIndex]?.question ||
                "Loading question..."}
            </p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={speakQuestion}
                className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 flex items-center"
                disabled={!interviewStarted}
              >
                <Volume2 size={18} className="mr-2" />
                {isSpeaking ? "Stop Speaking" : "Speak Question"}
              </button>
            </div>
            <div className="mt-6 bg-white rounded-lg p-4 max-h-48 overflow-y-auto text-black">
              <h4 className="font-semibold mb-2">
                Transcription de la réponse :
              </h4>
              {localState.currentTranscription ? (
                <p className="whitespace-pre-wrap">
                  {localState.currentTranscription}
                </p>
              ) : (
                <p className="italic text-gray-600">
                  En attente de votre réponse...
                </p>
              )}
            </div>

            <div className="mt-4 bg-white rounded-lg p-4 max-h-48 overflow-y-auto text-black">
              <h4 className="font-semibold mb-2">Historique des réponses :</h4>
              {localState.transcriptions.length > 0 ? (
                <div className="space-y-4">
                  {localState.transcriptions.map((transcription, index) => (
                    <div key={index} className="border-b pb-2">
                      <p className="font-medium text-blue-600">
                        Question {transcription.questionIndex + 1}:
                      </p>
                      <p className="text-gray-700 mb-1">
                        {transcription.question}
                      </p>
                      <p className="text-gray-900">{transcription.answer}</p>
          </div>
                  ))}
                </div>
              ) : (
                <p className="italic text-gray-600">
                  Aucune réponse enregistrée pour le moment.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full max-w-6xl flex justify-between mt-4">
        <button
          onClick={handlePreviousQuestion}
          className={`px-6 py-3 rounded-lg ${
            currentQuestionIndex === 0 || !interviewStarted
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-blue-100 text-blue-700 hover:bg-blue-200"
          }`}
          disabled={
            currentQuestionIndex === 0 || !interviewStarted || isProcessing
          }
        >
          Précédent
        </button>

        <div className="flex">
          {questions.map((_, index) => (
            <button
              key={index}
              className={`w-8 h-8 rounded-full mx-1 ${
                !interviewStarted
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : index === currentQuestionIndex
                  ? "bg-blue-500 text-white"
                  : "bg-blue-100 text-blue-700"
              }`}
              onClick={() => handleGoToQuestion(index)}
              disabled={!interviewStarted || isProcessing}
            >
              {index + 1}
            </button>
          ))}
        </div>

        <button
          onClick={handleNextQuestion}
          className={`px-6 py-3 rounded-lg ${
            !interviewStarted
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : currentQuestionIndex === questions.length - 1
              ? "bg-green-500 text-white hover:bg-green-600"
              : "bg-blue-100 text-blue-700 hover:bg-blue-200"
          }`}
          disabled={!interviewStarted || isProcessing}
        >
          {currentQuestionIndex === questions.length - 1
            ? "Terminer"
            : "Suivant"}
        </button>
      </div>

      {localState.errorMessage && (
        <p className="text-red-600 mt-4 text-center">
          {localState.errorMessage}
        </p>
      )}

      {localState.showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-11/12 max-w-md">
            <h3 className="text-xl font-bold text-red-600 mb-4">
              Permission Denied
            </h3>
            <p className="text-gray-700 mb-4">
              Permission to access the microphone or camera has been denied.
              Please allow access in your browser settings to continue.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() =>
                  setLocalState((prev) => ({ ...prev, showModal: false }))
                }
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Interview;
