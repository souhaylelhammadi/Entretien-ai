import React, { useRef, useEffect, useCallback, useState } from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
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
  saveInterviewToDatabase,
  fetchRecordings,
  fetchInterviewDetails,
} from "./store/entretienpourcSlice";
import { toast } from "react-toastify";
import Webcam from "react-webcam";
import { Button, Card, Progress, Modal, message } from "antd";
import {
  AudioOutlined,
  AudioMutedOutlined,
  VideoCameraOutlined,
  VideoCameraFilled,
  LeftOutlined,
  RightOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { BASE_URL } from "../config";
import { createAsyncThunk } from "@reduxjs/toolkit";

// Helper Components
const StatusIndicator = ({ isActive }) => (
  <div className="flex items-center space-x-2 bg-blue-700/30 px-4 py-2 rounded-full">
    <span
      className={`w-2 h-2 ${
        isActive ? "bg-green-400 animate-pulse" : "bg-gray-400"
      } rounded-full`}
    ></span>
    <span className="text-sm text-white">En cours</span>
  </div>
);

const ProgressBar = ({ current, total, time }) => {
  const timePercentage = Math.min((time / 1800) * 100, 100);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="mt-6">
      <div className="flex justify-between text-sm mb-1 text-white">
        <span className="font-medium">
          Question {current + 1}/{total || 0}
        </span>
        <span className="font-medium">Temps écoulé: {formatTime(time)}</span>
      </div>
      <div className="relative h-2.5 bg-blue-300/30 rounded-full overflow-hidden">
        <div
          style={{ width: `${timePercentage}%` }}
          className="absolute top-0 left-0 h-full bg-white transition-all duration-300 rounded-full"
        ></div>
      </div>
      <div className="flex justify-between text-xs mt-1 text-blue-200">
        <span>0:00</span>
        <span>{formatTime(1000)}</span>
      </div>
    </div>
  );
};

const VideoPlayer = ({ localRef, isActive, isRecording, cameraError }) => {
  if (!isActive) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="bg-gray-200/30 p-4 rounded-full mb-4">
          <MicOff className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-500 mb-1">
          Prêt à commencer
        </h3>
        <p className="text-gray-400 text-sm">
          Cliquez sur "Commencer l'entretien" pour démarrer
        </p>
      </div>
    );
  }

  if (cameraError) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-white p-6 text-center">
        <div className="bg-red-100/20 p-4 rounded-full mb-4">
          <MicOff className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-medium mb-2">Accès à la caméra refusé</h3>
        <p className="text-gray-300 text-sm max-w-xs">
          Veuillez autoriser l'accès à la caméra et au microphone dans les
          paramètres de votre navigateur
        </p>
      </div>
    );
  }

  return (
    <>
      <video
        ref={localRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      {isRecording && (
        <div className="absolute top-4 right-4 flex items-center bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-md">
          <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
          Enregistrement
        </div>
      )}
    </>
  );
};

const QuestionCard = ({
  currentQuestion,
  currentIndex,
  isSpeaking,
  transcript,
  onSpeakQuestion,
  interviewStarted,
  totalQuestions = 0,
}) => {
  const questionText =
    currentQuestion?.text || currentQuestion?.question || "Chargement...";

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl shadow-lg border border-blue-100/50">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <h3 className="text-lg font-bold text-blue-800">
            Question {currentIndex + 1}/{totalQuestions}
          </h3>
          <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
            Technique
          </span>
        </div>
        {isSpeaking && (
          <div className="flex items-center bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
            <span className="mr-2">Lecture en cours</span>
            <div className="flex space-x-1">
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></span>
              <span
                className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></span>
              <span
                className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                style={{ animationDelay: "0.4s" }}
              ></span>
            </div>
          </div>
        )}
      </div>
      <div className="bg-white p-5 rounded-lg shadow-sm mb-6 border border-gray-100">
        <p className="text-gray-800 leading-relaxed">{questionText}</p>
      </div>
      <div className="flex justify-end">
        <button
          onClick={onSpeakQuestion}
          className={`flex items-center px-5 py-2.5 rounded-lg transition-all shadow-sm ${
            !interviewStarted
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : isSpeaking
              ? "bg-blue-700 text-white hover:bg-blue-800"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
          disabled={!interviewStarted}
        >
          <Volume2 size={18} className="mr-2" />
          {isSpeaking ? "Arrêter la lecture" : "Écouter la question"}
        </button>
      </div>
      {transcript && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-500 mb-2">
            Votre réponse:
          </h4>
          <div className="bg-white p-4 rounded-lg border border-gray-200 text-gray-700">
            {transcript}
          </div>
        </div>
      )}
    </div>
  );
};

const PermissionDeniedModal = ({ onClose, onRetry, onNavigate }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
      <div className="bg-red-50 p-5 border-b border-red-100">
        <h3 className="text-xl font-bold text-red-600">Accès refusé</h3>
      </div>
      <div className="p-6">
        <p className="text-gray-700 mb-6">
          L'accès au microphone ou à la caméra a été refusé. Veuillez autoriser
          l'accès dans les paramètres de votre navigateur pour continuer.
        </p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onNavigate}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            Annuler
          </button>
          <button
            onClick={onRetry}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all"
          >
            Réessayer
          </button>
        </div>
      </div>
    </div>
  </div>
);

// Main Component
const Interview = () => {
  const { interviewId } = useParams();
  const localRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const recognitionRef = useRef(null);
  const localStreamRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const {
    webcamActive,
    isMuted,
    callTime,
    currentQuestionIndex,
    cameraError,
    transcript,
    isTranscribing,
    isRecording,
    recordedBlob,
    isSpeaking,
    recordings,
    interviewCompleted,
    showModal,
    errorMessage,
    interviewStarted,
    questions,
    loading,
    interviewError,
    interviewDetails,
    recordedVideoUrl,
  } = useSelector((state) => state.interview);
  const webcamRef = useRef(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [interviewTimer, setInterviewTimer] = useState(900); // 15 minutes en secondes
  const [questionTimer, setQuestionTimer] = useState(40);
  const [canProceed, setCanProceed] = useState(false);
  const interviewTimerRef = useRef(null);
  const questionTimerRef = useRef(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    dispatch(fetchInterviewDetails(interviewId));
  }, [interviewId, dispatch]);

  // Speech Recognition Hook
  const useSpeechRecognition = () => {
    const setupRecognition = useCallback(() => {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        toast.error("Reconnaissance vocale non supportée par ce navigateur");
        return null;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "fr-FR";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            dispatch(
              setState({ transcript: transcript + " " + transcriptPart })
            );
          } else {
            interimTranscript += transcriptPart;
          }
        }
        const interimElement = document.getElementById("interim-transcript");
        if (interimElement) interimElement.textContent = interimTranscript;
      };

      recognition.onerror = (event) => {
        console.error("Erreur de reconnaissance vocale:", event.error);
        if (event.error === "no-speech") {
          // Redémarrer la reconnaissance si aucune parole n'est détectée
          if (
            recognitionRef.current &&
            recognitionRef.current.state === "inactive"
          ) {
            try {
              recognitionRef.current.start();
            } catch (error) {
              console.error(
                "Erreur lors du redémarrage de la reconnaissance:",
                error
              );
            }
          }
        } else if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          dispatch(setState({ showModal: true }));
        }
      };

      recognition.onend = () => {
        // Redémarrer la reconnaissance si elle s'arrête inopinément
        if (
          isTranscribing &&
          recognitionRef.current &&
          recognitionRef.current.state === "inactive"
        ) {
          try {
            recognitionRef.current.start();
          } catch (error) {
            console.error(
              "Erreur lors du redémarrage de la reconnaissance:",
              error
            );
          }
        }
      };

      return recognition;
    }, [dispatch, transcript, isTranscribing]);

    const startTranscription = useCallback(() => {
      if (
        recognitionRef.current &&
        !isTranscribing &&
        recognitionRef.current.state === "inactive"
      ) {
        try {
          recognitionRef.current.start();
          dispatch(setState({ isTranscribing: true }));
        } catch (error) {
          console.error("Erreur lors du démarrage de la transcription:", error);
        }
      }
    }, [isTranscribing]);

    const stopTranscription = useCallback(() => {
      if (
        recognitionRef.current &&
        isTranscribing &&
        recognitionRef.current.state === "listening"
      ) {
        try {
          recognitionRef.current.stop();
          dispatch(setState({ isTranscribing: false }));
        } catch (error) {
          console.error("Erreur lors de l'arrêt de la transcription:", error);
        }
      }
    }, [isTranscribing]);

    return { setupRecognition, startTranscription, stopTranscription };
  };

  const { setupRecognition, startTranscription, stopTranscription } =
    useSpeechRecognition();

  const speakQuestion = useCallback(() => {
    if (!window.speechSynthesis) {
      toast.error("Synthèse vocale non supportée par ce navigateur");
      return;
    }

    // Arrêter toute lecture en cours
    window.speechSynthesis.cancel();

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) {
      console.error("Aucune question disponible");
      return;
    }

    const questionText =
      currentQuestion?.text || currentQuestion?.question || "";
    if (!questionText) {
      console.error("Texte de la question vide");
      return;
    }

    // Créer une nouvelle instance de SpeechSynthesisUtterance
    const speech = new SpeechSynthesisUtterance(questionText);

    // Configurer les paramètres de la voix
    speech.lang = "fr-FR";
    speech.rate = 0.9; // Vitesse de lecture légèrement plus lente
    speech.pitch = 1;
    speech.volume = 1;

    // Sélectionner une voix française si disponible
    const voices = window.speechSynthesis.getVoices();
    const frenchVoice = voices.find((voice) => voice.lang.includes("fr"));
    if (frenchVoice) {
      speech.voice = frenchVoice;
    }

    // Gérer le début de la lecture
    speech.onstart = () => {
      console.log("Début de la lecture de la question");
      dispatch(setState({ isSpeaking: true }));
    };

    // Gérer la fin de la lecture
    speech.onend = () => {
      console.log("Fin de la lecture de la question");
      dispatch(setState({ isSpeaking: false }));
      // Réinitialiser le timer de la question après la lecture
      setQuestionTimer(5);
      setCanProceed(false);
    };

    // Gérer les erreurs
    speech.onerror = (event) => {
      console.error("Erreur de synthèse vocale:", event);
      if (event.error !== "interrupted") {
        toast.error("Erreur lors de la lecture de la question");
      }
      dispatch(setState({ isSpeaking: false }));
    };

    // S'assurer que les voix sont chargées avant de parler
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        const updatedVoices = window.speechSynthesis.getVoices();
        const frenchVoice = updatedVoices.find((voice) =>
          voice.lang.includes("fr")
        );
        if (frenchVoice) {
          speech.voice = frenchVoice;
        }
        window.speechSynthesis.speak(speech);
      };
    } else {
      window.speechSynthesis.speak(speech);
    }
  }, [currentQuestionIndex, questions, dispatch]);

  // Modifier l'effet pour la lecture des questions
  useEffect(() => {
    let timeoutId;

    if (
      webcamActive &&
      !isSpeaking &&
      currentQuestionIndex >= 0 &&
      currentQuestionIndex < questions.length
    ) {
      // Attendre que la page soit complètement chargée avant de lire la question
      timeoutId = setTimeout(() => {
        // Vérifier si la synthèse vocale est disponible
        if (window.speechSynthesis) {
          speakQuestion();
        } else {
          console.error("Synthèse vocale non disponible");
          toast.error(
            "La lecture des questions n'est pas supportée par votre navigateur"
          );
        }
      }, 1000);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // Arrêter proprement toute lecture en cours lors du démontage
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [
    currentQuestionIndex,
    webcamActive,
    isSpeaking,
    speakQuestion,
    questions.length,
  ]);

  const setupSources = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: true,
      });

      if (stream.getVideoTracks().length === 0) {
        throw new Error("Aucune piste vidéo disponible");
      }

      localStreamRef.current = stream;

      if (localRef.current) {
        localRef.current.srcObject = stream;
        await localRef.current.play();
      }

      dispatch(
        setState({
          webcamActive: true,
          cameraError: false,
          interviewStarted: true,
        })
      );

      // Initialiser le MediaRecorder
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
        // Stocker l'URL au lieu du Blob
        const url = URL.createObjectURL(blob);
        dispatch(setState({ recordedVideoUrl: url }));
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorderRef.current.start(1000); // Démarrer l'enregistrement automatiquement
      dispatch(startRecording());

      // Démarrer la reconnaissance vocale
      const recognition = setupRecognition();
      if (recognition) {
        recognitionRef.current = recognition;
        recognition.start();
        dispatch(setState({ isTranscribing: true }));
      }

      // Lire la première question
      setTimeout(speakQuestion, 1000);
    } catch (error) {
      console.error("Erreur lors de la configuration des sources:", error);
      dispatch(
        setState({
          cameraError: true,
          errorMessage: "Erreur lors de l'accès à la caméra",
        })
      );
    }
  }, [dispatch, setupRecognition, speakQuestion]);

  const handleEndCall = useCallback(async () => {
    try {
      // Arrêter l'enregistrement
      if (isRecording) {
        dispatch(stopRecording());
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        ) {
          mediaRecorderRef.current.stop();
        }
      }

      // Arrêter le flux vidéo
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Sauvegarder l'entretien
      if (recordedChunksRef.current.length > 0) {
        // Créer le blob avec une qualité réduite
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm;codecs=vp8,opus",
        });

        // Convertir le blob en base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64Video = reader.result;

          // Récupérer les transcripts de chaque question
          const recordings = questions.map((question, index) => {
            const currentTranscript = transcript || "";
            const questionText = question.text || question.question || "";

            return {
              questionIndex: index,
              question: questionText,
              transcript: currentTranscript,
              timestamp: new Date().toISOString(),
            };
          });

          try {
            // Envoyer les données au serveur
            const token = localStorage.getItem("token");
            if (!token) {
              throw new Error("Token d'authentification manquant");
            }

            const cleanToken = token.replace(/^Bearer\s+/i, "");

            const recordingsData = {
              video: base64Video,
              recordings: recordings,
              interviewId: interviewId,
              completedAt: new Date().toISOString(),
            };

            console.log("Données à envoyer:", {
              videoSize: blob.size,
              recordingsCount: recordings.length,
              interviewId: interviewId,
            });

            const response = await axios.post(
              `${BASE_URL}/api/candidates/entretiens/${interviewId}/recordings`,
              recordingsData,
              {
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${cleanToken}`,
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

            if (response.data.success) {
              // Mettre à jour le statut de la candidature
              const statusResponse = await axios.put(
                `${BASE_URL}/api/candidates/${interviewId}/status`,
                {
                  status: "completed",
                  completedAt: new Date().toISOString(),
                },
                {
                  headers: {
                    Authorization: `Bearer ${cleanToken}`,
                  },
                }
              );

              if (statusResponse.data.success) {
                // Nettoyer les ressources
                if (recordedVideoUrl) {
                  URL.revokeObjectURL(recordedVideoUrl);
                }

                // Mettre à jour le state et rediriger
                dispatch(
                  setState({
                    interviewCompleted: true,
                    loading: false,
                    error: null,
                  })
                );

                toast.success("Entretien terminé et sauvegardé avec succès");
                navigate("/mesinterview", { replace: true });
              } else {
                throw new Error("Erreur lors de la mise à jour du statut");
              }
            } else {
              throw new Error(
                response.data.error ||
                  "Erreur lors de la sauvegarde de l'entretien"
              );
            }
          } catch (error) {
            console.error("Erreur lors de l'envoi des données:", error);
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
            if (error.response?.status === 401) {
              toast.error("Session expirée. Veuillez vous reconnecter.");
              navigate("/login");
            } else {
              toast.error(
                error.response?.data?.error ||
                  "Erreur lors de l'envoi des données au serveur"
              );
            }
          }
        };
      }

      dispatch(hangUp());
      navigate("/mesinterview", { replace: true });
    } catch (error) {
      console.error("Erreur lors de la fin de l'entretien:", error);
      toast.error("Erreur lors de la sauvegarde de l'entretien");
      navigate("/mesinterview", { replace: true });
    }
  }, [
    dispatch,
    isRecording,
    recordedChunksRef,
    questions,
    transcript,
    interviewId,
    navigate,
    recordedVideoUrl,
  ]);

  // Timer pour l'entretien complet (15 minutes)
  useEffect(() => {
    let timer = null;
    if (webcamActive) {
      timer = setInterval(() => {
        setInterviewTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleEndCall();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [webcamActive, handleEndCall]);

  // Timer pour chaque question (40 secondes)
  useEffect(() => {
    if (webcamActive && !isSpeaking) {
      setQuestionTimer(5);
      setCanProceed(false);

      questionTimerRef.current = setInterval(() => {
        setQuestionTimer((prev) => {
          if (prev <= 1) {
            clearInterval(questionTimerRef.current);
            setCanProceed(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (questionTimerRef.current) {
        clearInterval(questionTimerRef.current);
      }
    };
  }, [webcamActive, currentQuestionIndex, isSpeaking]);

  // Handle Interview Completion
  useEffect(() => {
    if (interviewCompleted) {
      dispatch(saveInterviewToDatabase({ interviewId }));
      navigate("/mesinterview");
    }
  }, [interviewCompleted, navigate, dispatch, interviewId]);

  // Setup Video Stream
  useEffect(() => {
    const setupVideo = async () => {
      if (localRef.current && localStreamRef.current) {
        try {
          localRef.current.srcObject = localStreamRef.current;
          await localRef.current.play();
        } catch (error) {
          console.error("Erreur lors de la configuration de la vidéo:", error);
        }
      }
    };

    setupVideo();
  }, [localStreamRef.current]);

  // Nettoyage des ressources lors du démontage
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, [recordedVideoUrl]);

  // Fetch Previous Recordings
  useEffect(() => {
    if (interviewId) {
      dispatch(fetchRecordings(interviewId));
    }
  }, [dispatch, interviewId]);

  // Modifier la fonction handleNextQuestion
  const handleNextQuestion = useCallback(() => {
    if (!canProceed) {
      toast.info(
        "Veuillez attendre 5 secondes avant de passer à la question suivante"
      );
      return;
    }

    // Arrêter toute lecture en cours
    window.speechSynthesis.cancel();

    // Sauvegarder la transcription actuelle avant de passer à la question suivante
    const currentTranscript = transcript;
    const currentQuestion = questions[currentQuestionIndex];

    if (currentTranscript && currentQuestion) {
      const updatedRecordings = [...recordings];
      updatedRecordings[currentQuestionIndex] = {
        questionIndex: currentQuestionIndex,
        question: currentQuestion.text || currentQuestion.question,
        transcript: currentTranscript,
        timestamp: new Date().toISOString(),
      };
      dispatch(
        setState({
          recordings: updatedRecordings,
          transcript: "", // Réinitialiser la transcription pour la prochaine question
        })
      );
    }

    // Vérifier si nous ne sommes pas à la dernière question
    if (currentQuestionIndex < questions.length - 1) {
      dispatch(goToNextQuestion());
      setCanProceed(false);
      setQuestionTimer(5); // Réinitialiser le timer à 5 secondes
    } else {
      toast.info("Vous avez atteint la dernière question");
    }
  }, [
    dispatch,
    canProceed,
    transcript,
    questions,
    currentQuestionIndex,
    recordings,
  ]);

  // Modifier la fonction handlePreviousQuestion
  const handlePreviousQuestion = useCallback(() => {
    if (!canProceed) {
      toast.info("Veuillez attendre la fin du temps imparti");
      return;
    }

    // Arrêter toute lecture en cours
    window.speechSynthesis.cancel();

    // Sauvegarder la transcription actuelle avant de revenir à la question précédente
    const currentTranscript = transcript;
    const currentQuestion = questions[currentQuestionIndex];

    if (currentTranscript && currentQuestion) {
      const updatedRecordings = [...recordings];
      updatedRecordings[currentQuestionIndex] = {
        questionIndex: currentQuestionIndex,
        question: currentQuestion.text || currentQuestion.question,
        transcript: currentTranscript,
        timestamp: new Date().toISOString(),
      };
      dispatch(
        setState({
          recordings: updatedRecordings,
          transcript: "", // Réinitialiser la transcription pour la prochaine question
        })
      );
    }

    if (currentQuestionIndex > 0) {
      dispatch(goToPreviousQuestion());
      setCanProceed(false);
      setQuestionTimer(5);
    } else {
      toast.info("Vous êtes à la première question");
    }
  }, [
    dispatch,
    canProceed,
    transcript,
    questions,
    currentQuestionIndex,
    recordings,
  ]);

  const handleGoToQuestion = useCallback(
    (index) => {
      dispatch(goToQuestion(index));
      setTimeout(speakQuestion, 500);
    },
    [dispatch, speakQuestion]
  );

  const handleToggleMute = useCallback(() => {
    dispatch(toggleMute());
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
    }
    if (isMuted && !isTranscribing) {
      startTranscription();
    } else if (!isMuted && isTranscribing) {
      stopTranscription();
    }
  }, [
    dispatch,
    isMuted,
    isTranscribing,
    startTranscription,
    stopTranscription,
  ]);

  const handleSaveInterview = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);

      // Convertir la vidéo en base64
      const videoBlob = await new Promise((resolve) => {
        const canvas = document.createElement("canvas");
        canvas.width = localRef.current.videoWidth;
        canvas.height = localRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(localRef.current, 0, 0);
        canvas.toBlob(resolve, "video/webm");
      });

      const reader = new FileReader();
      const videoBase64 = await new Promise((resolve) => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(videoBlob);
      });

      // Préparer les données à envoyer
      const data = {
        video: videoBase64,
        recordings: recordings.map((recording) => ({
          questionIndex: recording.questionIndex,
          question: recording.question,
          transcript: recording.transcript,
          timestamp: recording.timestamp,
        })),
      };

      // Récupérer le token d'authentification
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Token d'authentification manquant");
      }

      // Envoyer les données au serveur
      const response = await fetch(
        `${BASE_URL}/candidates/entretiens/${interviewId}/save`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(data),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Erreur lors de la sauvegarde de l'entretien"
        );
      }

      const result = await response.json();
      if (result.success) {
        setSuccessMessage("Entretien sauvegardé avec succès");
        // Rediriger vers la page de confirmation ou la liste des entretiens
        navigate("/candidates/interviews");
      } else {
        throw new Error(
          result.error || "Erreur lors de la sauvegarde de l'entretien"
        );
      }
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      setSaveError(
        error.message ||
          "Une erreur est survenue lors de la sauvegarde de l'entretien"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteInterview = async () => {
    setShowConfirmModal(false);
    await handleEndCall();
  };

  const handleFinishInterview = async () => {
    try {
      if (!recordedChunksRef.current.length) {
        toast.error("Aucun enregistrement disponible");
        return;
      }

      // Arrêter l'enregistrement si en cours
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }

      // Convertir les chunks en Blob
      const videoBlob = new Blob(recordedChunksRef.current, {
        type: "video/webm",
      });

      // Convertir le Blob en base64
      const reader = new FileReader();
      reader.readAsDataURL(videoBlob);
      reader.onloadend = async () => {
        const base64Video = reader.result;

        // Préparer les données des enregistrements
        const recordings = questions.map((question, index) => ({
          questionIndex: index,
          question: question.text || question.question,
          transcript: transcript || "",
          timestamp: new Date().toISOString(),
        }));

        try {
          // Envoyer les données au serveur
          const response = await axios.post(
            `${BASE_URL}/api/candidates/${interviewId}/recordings`,
            {
              video: base64Video,
              recordings: recordings,
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: localStorage.getItem("token"),
              },
            }
          );

          if (response.data.success) {
            // Mettre à jour le statut de la candidature
            await axios.put(
              `${BASE_URL}/api/candidates/${interviewId}/status`,
              { status: "completed" },
              {
                headers: {
                  Authorization: localStorage.getItem("token"),
                },
              }
            );

            toast.success("Entretien terminé avec succès");
            navigate("/mes-entretiens");
          } else {
            toast.error(
              response.data.error ||
                "Erreur lors de la sauvegarde de l'entretien"
            );
          }
        } catch (error) {
          console.error("Erreur lors de l'envoi des données:", error);
          toast.error("Erreur lors de l'envoi des données au serveur");
        }
      };
    } catch (error) {
      console.error("Erreur lors de la fin de l'entretien:", error);
      toast.error("Erreur lors de la sauvegarde de l'entretien");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex items-center space-x-2">
          <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
          <span className="text-gray-600">Chargement de l'entretien...</span>
        </div>
      </div>
    );
  }

  if (interviewError) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <CheckCircle2 className="h-12 w-12 text-red-500 mx-auto" />
          <p className="mt-2 text-gray-600">{interviewError}</p>
          <button
            onClick={() => navigate("/mesinterview")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retour aux entretiens
          </button>
        </div>
      </div>
    );
  }

  if (!interviewDetails) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <CheckCircle2 className="h-12 w-12 text-red-500 mx-auto" />
          <p className="mt-2 text-gray-600">Entretien non trouvé</p>
          <button
            onClick={() => navigate("/mesinterview")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Retour aux entretiens
          </button>
        </div>
      </div>
    );
  }

  if (showModal) {
    return (
      <PermissionDeniedModal
        onClose={() => dispatch(setState({ showModal: false }))}
        onRetry={() => {
          dispatch(setState({ showModal: false }));
          setupSources();
        }}
        onNavigate={() => navigate("/mesinterview")}
      />
    );
  }

  if (interviewCompleted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card title="Entretien terminé" className="w-96">
          <p>Votre entretien a été enregistré avec succès.</p>
          <Button type="primary" onClick={handleCompleteInterview}>
            Retour au tableau de bord
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Simulation d'entretien technique
              </h1>
              <p className="text-blue-100 mt-1">
                Répondez aux questions pour vous entraîner
              </p>
            </div>
            {!webcamActive ? (
              <button
                onClick={setupSources}
                className="bg-white text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition-all shadow-md flex items-center font-medium"
              >
                Commencer l'entretien
              </button>
            ) : (
              <StatusIndicator isActive={webcamActive} />
            )}
          </div>
          <ProgressBar
            current={currentQuestionIndex}
            total={questions.length}
            time={callTime}
          />
        </div>

        {/* Main Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Video Feed */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  {webcamActive ? (
                    <>
                      <video
                        ref={localRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        style={{ transform: "scaleX(-1)" }}
                      />
                      {/* Overlay pour les contrôles */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                        <div className="flex justify-center items-center space-x-6">
                          <button
                            onClick={handleToggleMute}
                            className={`p-4 rounded-full ${
                              isMuted
                                ? "bg-red-500 hover:bg-red-600"
                                : "bg-white/20 hover:bg-white/30"
                            } text-white transition-all duration-300 backdrop-blur-sm`}
                          >
                            {isMuted ? (
                              <MicOff className="w-6 h-6" />
                            ) : (
                              <Mic className="w-6 h-6" />
                            )}
                          </button>
                          <button
                            onClick={handleEndCall}
                            className="p-4 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-300 backdrop-blur-sm"
                          >
                            <PhoneOff className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                      {/* Indicateur d'enregistrement */}
                      {isRecording && (
                        <div className="absolute top-4 right-4 flex items-center bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-md backdrop-blur-sm">
                          <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
                          Enregistrement
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-white">
                      <VideoCameraOutlined className="text-4xl mb-4" />
                      <p className="text-lg">
                        Cliquez sur "Commencer l'entretien" pour démarrer
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Question Card */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-lg p-4">
                <h2 className="text-xl font-bold mb-4">Questions</h2>
                {!webcamActive ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">
                      Cliquez sur "Commencer l'entretien" pour voir les
                      questions
                    </p>
                  </div>
                ) : (
                  <>
                    <QuestionCard
                      currentQuestion={questions[currentQuestionIndex]}
                      currentIndex={currentQuestionIndex}
                      isSpeaking={isSpeaking}
                      transcript={transcript}
                      onSpeakQuestion={speakQuestion}
                      interviewStarted={interviewStarted}
                      totalQuestions={questions.length}
                    />

                    <div className="flex justify-between mt-4">
                      <button
                        onClick={handlePreviousQuestion}
                        disabled={currentQuestionIndex === 0 || !canProceed}
                        className="px-4 py-2 rounded-lg bg-gray-200 disabled:opacity-50"
                      >
                        Précédente
                      </button>
                      <button
                        onClick={handleNextQuestion}
                        disabled={
                          currentQuestionIndex === questions.length - 1 ||
                          !canProceed
                        }
                        className="px-4 py-2 rounded-lg bg-gray-200 disabled:opacity-50"
                      >
                        Suivante
                      </button>
                    </div>

                    {currentQuestionIndex === questions.length - 1 && (
                      <button
                        onClick={handleSaveInterview}
                        className="w-full mt-4 px-4 py-2 rounded-lg bg-green-500 text-white"
                      >
                        Terminer et sauvegarder
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-4 py-3 px-4 bg-red-50 text-red-600 rounded-lg border border-red-100 max-w-6xl w-full">
          {errorMessage}
        </div>
      )}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Entretien terminé</h2>
            <p className="mb-4">
              Votre entretien a été enregistré avec succès.
            </p>
            <p className="mb-6">
              Vous pouvez maintenant retourner à votre tableau de bord.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-200"
              >
                Fermer
              </button>
              <button
                onClick={handleCompleteInterview}
                className="px-4 py-2 rounded-lg bg-blue-500 text-white"
              >
                Retour au tableau de bord
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Afficher l'erreur de sauvegarde si elle existe */}
      {saveError && (
        <div className="mt-4 py-3 px-4 bg-red-50 text-red-600 rounded-lg border border-red-100 max-w-6xl w-full">
          {saveError}
        </div>
      )}
    </div>
  );
};

export default Interview;
