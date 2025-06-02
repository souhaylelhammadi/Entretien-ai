import React, { useRef, useState, useEffect, useCallback } from "react";
import { Mic, MicOff, PhoneOff, Volume2, Loader2, VolumeX } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchInterviewDetails,
  saveInterviewToDatabase,
  setState,
  startInterview,
  stopInterview,
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
  if ("webkitSpeechRecognition" in window) {
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "fr-FR";
    return recognition;
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechSynthesisRef = useRef(null);

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
    isSaving: false,
  });

  const maxDuration = 1800; // 30 minutes

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const saveTranscription = useCallback(() => {
    if (localState.currentTranscription) {
      setLocalState((prev) => {
        const newTranscriptions = [...prev.transcriptions];
        const existingIndex = newTranscriptions.findIndex(
          (t) => t.questionIndex === currentQuestionIndex
        );

        if (existingIndex !== -1) {
          // Mettre à jour la transcription existante
          newTranscriptions[existingIndex] = {
            questionIndex: currentQuestionIndex,
            question: questions[currentQuestionIndex]?.question || "",
            answer: prev.currentTranscription,
          };
        } else {
          // Ajouter une nouvelle transcription
          newTranscriptions.push({
            questionIndex: currentQuestionIndex,
            question: questions[currentQuestionIndex]?.question || "",
            answer: prev.currentTranscription,
          });
        }

        return {
          ...prev,
          transcriptions: newTranscriptions,
          currentTranscription: "", // Réinitialiser la transcription courante
        };
      });
    }
  }, [currentQuestionIndex, questions, localState.currentTranscription]);

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
      setLocalState((prev) => ({ ...prev, isSaving: true }));
      dispatch(setProcessing(true));
      console.log("Starting interview completion process...");

      // Arrêter la reconnaissance vocale
      if (recognitionRef.current) {
        try {
          console.log("Stopping speech recognition...");
          recognitionRef.current.stop();
          recognitionRef.current = null;
          setLocalState((prev) => ({ ...prev, isListening: false }));
        } catch (error) {
          console.error("Error stopping speech recognition:", error);
        }
      }

      // Save final transcription if there is one
      if (localState.currentTranscription) {
        console.log("Saving final transcription...");
        saveTranscription();
      }

      // Vérifier l'état de l'enregistrement
      console.log("Recording state:", {
        isRecording: localState.isRecording,
        hasStream: !!localState.localStream,
        hasBlob: !!localState.recordedBlob,
        blobSize: localState.recordedBlob?.size || 0,
        chunksCount: recordedChunksRef.current.length,
      });

      // Arrêter l'enregistrement si actif
      if (localState.isRecording && mediaRecorderRef.current) {
        console.log("Stopping final recording...");
        try {
          mediaRecorderRef.current.stop();
          // Attendre que l'événement onstop soit déclenché
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          console.error("Error stopping recording:", error);
        }
      }

      // Vérifier que nous avons un blob vidéo
      if (!localState.recordedBlob) {
        console.error("No video recording available");
        throw new Error("No video recording available");
      }

      // Vérifier la taille du blob
      if (localState.recordedBlob.size === 0) {
        console.error("Video recording is empty");
        throw new Error("Video recording is empty");
      }

      console.log("Video blob details:", {
        size: localState.recordedBlob.size,
        type: localState.recordedBlob.type,
        lastModified: new Date().toISOString(),
      });

      const metadata = {
        interviewId,
        duration: Math.floor((Date.now() - localState.startTime) / 1000),
        questionCount: questions.length,
        completedQuestions: currentQuestionIndex + 1,
        transcriptions: localState.transcriptions,
        questions: questions.map((q, index) => ({
          id: q._id || `q_${index}`,
          question: q.question,
          type: q.type || "text",
          order: index,
          answer:
            localState.transcriptions.find((t) => t.questionIndex === index)
              ?.answer || "",
        })),
      };

      console.log("Preparing to save interview with metadata:", metadata);

      const formData = new FormData();
      formData.append("metadata", JSON.stringify(metadata));
      formData.append(
        "questions_list",
        JSON.stringify(
          questions.map((q, index) => ({
            id: q._id || `q_${index}`,
            question: q.question,
            type: q.type || "text",
            order: index,
          }))
        )
      );

      // Ajouter la vidéo avec un nom de fichier unique
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const videoFileName = `interview_${interviewId}_${timestamp}.webm`;
      console.log("Appending video to FormData:", {
        fileName: videoFileName,
        size: localState.recordedBlob.size,
      });
      formData.append("video", localState.recordedBlob, videoFileName);

      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No authentication token found");
        throw new Error("No authentication token found");
      }

      const cleanToken = token.replace(/^Bearer\s+/i, "").trim();
      console.log("Token available:", !!cleanToken);

      console.log("Sending save request to server...");
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

      console.log("Server response status:", response.status);
      const responseData = await response.json();
      console.log("Server response data:", responseData);

      if (!response.ok) {
        console.error("Server error response:", responseData);
        throw new Error(responseData.error || "Failed to save interview");
      }

      // Vérifier que les transcriptions ont été sauvegardées
      if (!responseData.data?.recordings) {
        console.warn("No recordings found in server response");
      } else {
        console.log(
          "Recordings saved successfully:",
          responseData.data.recordings
        );
      }

      // Vérifier que la vidéo a été sauvegardée
      if (!responseData.data?.videoUrl) {
        console.warn("No video URL in server response");
      } else {
        console.log("Video saved successfully:", responseData.data.videoUrl);
      }

      dispatch(
        setState({
          interviewDetails: {
            ...interviewDetails,
            videoUrl: responseData.data.videoUrl,
            status: "completed",
            transcriptions: localState.transcriptions,
            completed_at: new Date().toISOString(),
            last_updated_by: responseData.data.last_updated_by,
          },
        })
      );

      // Arrêter le stream vidéo
      if (localState.localStream) {
        console.log("Stopping webcam stream...");
        localState.localStream.getTracks().forEach((track) => track.stop());
      }

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

      console.log(
        "Interview saved successfully, navigating to mesinterview..."
      );
      navigate("/mesinterview");
    } catch (error) {
      console.error("Error saving interview:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      setLocalState((prev) => ({
        ...prev,
        errorMessage: `Failed to save interview: ${error.message}`,
      }));
    } finally {
      dispatch(setProcessing(false));
      setLocalState((prev) => ({ ...prev, isSaving: false }));
    }
  };

  // Fonction pour lire le texte
  const speakText = (text) => {
    if (!text) return;

    // Arrêter toute lecture en cours
    if (speechSynthesisRef.current) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "fr-FR";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      // Démarrer la reconnaissance vocale après la lecture
      startSpeechRecognition();
    };

    speechSynthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
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

      if (localRef.current) {
        localRef.current.srcObject = stream;
        await localRef.current
          .play()
          .catch((e) => console.error("Error playing video:", e));
      }

      setLocalState((prev) => ({
        ...prev,
        webcamActive: true,
        cameraError: false,
      }));

      dispatch(startInterview());

      // Lire la première question
      if (questions.length > 0) {
        speakText(questions[0].question);
      }

      // Attendre que le stream soit complètement initialisé
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Initialiser le MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8,opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log("Received data chunk:", event.data.size, "bytes");
          recordedChunksRef.current.push(event.data);

          // Mettre à jour le blob à chaque nouveau chunk
          const blob = new Blob(recordedChunksRef.current, {
            type: "video/webm;codecs=vp8,opus",
          });
          console.log("Updated blob size:", blob.size, "bytes");

          setLocalState((prev) => ({
            ...prev,
            recordedBlob: blob,
            recordedVideoURL: URL.createObjectURL(blob),
          }));
        }
      };

      mediaRecorder.onstop = () => {
        console.log("Recording stopped, creating final blob...");
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm;codecs=vp8,opus",
        });
        console.log("Final blob created:", blob.size, "bytes");

        if (blob.size === 0) {
          console.error("Created blob is empty");
          return;
        }

        setLocalState((prev) => ({
          ...prev,
          recordedBlob: blob,
          recordedVideoURL: URL.createObjectURL(blob),
          isRecording: false,
        }));
      };

      // Démarrer l'enregistrement
      mediaRecorder.start(1000); // Collect data every second
      console.log("MediaRecorder started");

      setLocalState((prev) => ({
        ...prev,
        isRecording: true,
      }));

      // Démarrer la reconnaissance vocale
      startSpeechRecognition();
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

  const startSpeechRecognition = () => {
    // S'assurer que l'ancienne instance est arrêtée
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      } catch (error) {
        console.error("Error stopping previous speech recognition:", error);
      }
    }

    // Créer une nouvelle instance
    recognitionRef.current = initializeSpeechRecognition();
    if (recognitionRef.current) {
      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join("");

        setLocalState((prev) => ({
          ...prev,
          currentTranscription: transcript,
          isListening: true,
        }));
      };

      recognitionRef.current.onstart = () => {
        console.log("Speech recognition started");
        setLocalState((prev) => ({
          ...prev,
          isListening: true,
          currentTranscription: "", // Réinitialiser la transcription au démarrage
        }));
      };

      recognitionRef.current.onend = () => {
        console.log("Speech recognition ended");
        setLocalState((prev) => ({
          ...prev,
          isListening: false,
        }));

        // Ne pas redémarrer automatiquement la reconnaissance vocale
        // Laisser handleNextQuestion gérer le redémarrage
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setLocalState((prev) => ({
          ...prev,
          isListening: false,
        }));

        // Ne pas redémarrer automatiquement en cas d'erreur
        // Laisser handleNextQuestion gérer le redémarrage
      };

      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Error starting speech recognition:", error);
      }
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
    setLocalState((prev) => ({
      ...prev,
      webcamActive: false,
      localStream: null,
      callTime: 0,
      cameraError: false,
      interviewStarted: false,
    }));
  };

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && localState.isRecording) {
        console.log("Stopping recording...");
        mediaRecorderRef.current.stop();

        // Ne pas arrêter le stream ici
        // localState.localStream.getTracks().forEach((track) => track.stop());

        setLocalState((prev) => ({
          ...prev,
          isRecording: false,
        }));
      }
    } catch (error) {
      console.error("Error stopping recording:", error);
    }
  };

  const startRecording = async () => {
    try {
      if (!localState.localStream) {
        console.error("No local stream available");
        return;
      }

      // Vérifier si l'enregistrement est déjà en cours
      if (localState.isRecording) {
        console.log("Recording is already in progress");
        return;
      }

      console.log("Starting recording...");
      const mediaRecorder = new MediaRecorder(localState.localStream, {
        mimeType: "video/webm;codecs=vp8,opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          console.log("Received data chunk:", event.data.size, "bytes");
          recordedChunksRef.current.push(event.data);

          // Mettre à jour le blob à chaque nouveau chunk
          const blob = new Blob(recordedChunksRef.current, {
            type: "video/webm;codecs=vp8,opus",
          });
          console.log("Updated blob size:", blob.size, "bytes");

          setLocalState((prev) => ({
            ...prev,
            recordedBlob: blob,
            recordedVideoURL: URL.createObjectURL(blob),
          }));
        }
      };

      mediaRecorder.onstop = () => {
        console.log("Recording stopped, creating final blob...");
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm;codecs=vp8,opus",
        });
        console.log("Final blob created:", blob.size, "bytes");

        if (blob.size === 0) {
          console.error("Created blob is empty");
          return;
        }

        setLocalState((prev) => ({
          ...prev,
          recordedBlob: blob,
          recordedVideoURL: URL.createObjectURL(blob),
          isRecording: false,
        }));
      };

      mediaRecorder.start(1000); // Collect data every second
      console.log("MediaRecorder started");

      setLocalState((prev) => ({
        ...prev,
        isRecording: true,
        startTime: Date.now(),
      }));
    } catch (error) {
      console.error("Error starting recording:", error);
      setLocalState((prev) => ({
        ...prev,
        errorMessage: "Failed to start recording. Please try again.",
      }));
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

  const timePercentage = (localState.callTime / maxDuration) * 100;

  useEffect(() => {
    if (localRef.current && localState.localStream) {
      localRef.current.srcObject = localState.localStream;
    }
  }, [localState.localStream]);

  const handleNextQuestion = useCallback(async () => {
    if (!interviewStarted || isProcessing) return;

    try {
      dispatch(setProcessing(true));
      console.log("Moving to next question...");

      // Sauvegarder la transcription actuelle
      if (localState.currentTranscription) {
        console.log("Saving current transcription before moving...");
        saveTranscription();
      }

      // Arrêter la reconnaissance vocale actuelle
      if (recognitionRef.current) {
        try {
          console.log("Stopping speech recognition...");
          recognitionRef.current.stop();
          recognitionRef.current = null;
        } catch (error) {
          console.error("Error stopping speech recognition:", error);
        }
      }

      // Attendre un court instant
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (currentQuestionIndex < questions.length - 1) {
        // Mettre à jour l'index de la question
        dispatch(
          setState({
            currentQuestionIndex: currentQuestionIndex + 1,
          })
        );

        // Réinitialiser la transcription
        setLocalState((prev) => ({
          ...prev,
          currentTranscription: "",
          isListening: false,
        }));

        // Lire la nouvelle question
        const nextQuestion = questions[currentQuestionIndex + 1].question;
        speakText(nextQuestion);
      } else {
        console.log("Last question reached, saving final transcription...");
        // S'assurer que la dernière transcription est sauvegardée
        if (localState.currentTranscription) {
          saveTranscription();
          // Attendre que la transcription soit sauvegardée
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        console.log("Completing interview...");
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
    questions,
    isProcessing,
    localState.currentTranscription,
    completeInterview,
  ]);

  const handlePreviousQuestion = useCallback(async () => {
    if (!interviewStarted || currentQuestionIndex === 0 || isProcessing) return;

    try {
      dispatch(setProcessing(true));

      // Sauvegarder la transcription actuelle
      if (localState.currentTranscription) {
        saveTranscription();
      }

      // Arrêter la reconnaissance vocale
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current = null;
        } catch (error) {
          console.error("Error stopping speech recognition:", error);
        }
      }

      // Attendre un court instant
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mettre à jour l'index de la question
      dispatch(goToPreviousQuestion());

      // Charger la transcription précédente
      setLocalState((prev) => ({
        ...prev,
        currentTranscription:
          prev.transcriptions.find(
            (t) => t.questionIndex === currentQuestionIndex - 1
          )?.answer || "",
        isListening: false,
      }));

      // Lire la question précédente
      const previousQuestion = questions[currentQuestionIndex - 1].question;
      speakText(previousQuestion);
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
    questions,
    isProcessing,
    localState.currentTranscription,
  ]);

  // Ajouter un bouton pour contrôler la lecture vocale
  const toggleSpeech = () => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      speakText(questions[currentQuestionIndex].question);
    }
  };

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
              <button
                onClick={toggleSpeech}
                className={`p-2 rounded-full transition-all ${
                  isSpeaking ? "bg-red-500" : "bg-blue-600"
                } text-white hover:bg-opacity-80`}
              >
                {isSpeaking ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
            </div>
            <p className="text-white text-lg">
              {localState.webcamActive
                ? questions[currentQuestionIndex]?.question
                : "demmarer l'entretien pour voir la question"}
              
            </p>
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

      {localState.isSaving && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-lg flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-4"></div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Sauvegarde en cours
            </h3>
            <p className="text-gray-600">
              Veuillez patienter pendant que nous sauvegardons votre
              entretien...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Interview;
