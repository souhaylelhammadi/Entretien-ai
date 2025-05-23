import React, { useRef, useEffect, useCallback, useState } from "react";
import { Mic, MicOff, Volume2, Loader2, CheckCircle2 } from "lucide-react";
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
import { Button, Card, Progress, Modal } from "antd";
import { BASE_URL } from "../config";

// Composants d'interface
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
        <span>{formatTime(1800)}</span>
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
    <div className="relative w-full h-full bg-black">
      <video
        ref={localRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover rounded-lg"
        style={{ transform: "scaleX(-1)" }}
      />
      {isRecording && (
        <div className="absolute top-4 right-4 flex items-center bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-md">
          <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
          Enregistrement
        </div>
      )}
    </div>
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
  const handleSpeak = useCallback(() => {
    if (!window.speechSynthesis) {
      toast.error("Synthèse vocale non supportée par ce navigateur");
      return;
    }

    // Arrêter toute lecture en cours
    window.speechSynthesis.cancel();

    const questionText =
      currentQuestion?.text || currentQuestion?.question || "";
    if (!questionText) {
      console.error("Texte de la question vide");
      return;
    }

    // Créer un nouvel objet SpeechSynthesisUtterance
    const speech = new SpeechSynthesisUtterance(questionText);
    speech.lang = "fr-FR";
    speech.rate = 0.9;
    speech.pitch = 1;
    speech.volume = 1;

    // Attendre que les voix soient chargées
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        voices = window.speechSynthesis.getVoices();
        const frenchVoice = voices.find(
          (voice) => voice.lang.includes("fr") || voice.lang.includes("FR")
        );
        if (frenchVoice) {
          speech.voice = frenchVoice;
        }
        window.speechSynthesis.speak(speech);
      };
    } else {
      const frenchVoice = voices.find(
        (voice) => voice.lang.includes("fr") || voice.lang.includes("FR")
      );
      if (frenchVoice) {
        speech.voice = frenchVoice;
      }
      window.speechSynthesis.speak(speech);
    }

    // Gérer les événements de la synthèse vocale
    speech.onstart = () => {
      console.log("Lecture démarrée");
      onSpeakQuestion(true);
    };

    speech.onend = () => {
      console.log("Lecture terminée");
      onSpeakQuestion(false);
    };

    speech.onerror = (event) => {
      console.error("Erreur de synthèse vocale:", event);
      if (event.error === "interrupted") {
        console.log("Lecture interrompue");
      } else {
        toast.error("Erreur lors de la lecture de la question");
      }
      onSpeakQuestion(false);
    };

    speech.onpause = () => {
      console.log("Lecture en pause");
    };

    speech.onresume = () => {
      console.log("Lecture reprise");
    };

    speech.onboundary = (event) => {
      console.log("Limite atteinte:", event.name);
    };
  }, [currentQuestion, onSpeakQuestion]);

  // Effet pour charger les voix au montage du composant
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        const voices = window.speechSynthesis.getVoices();
        console.log(
          "Voix disponibles:",
          voices.map((v) => `${v.name} (${v.lang})`)
        );
      };
    }
  }, []);

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
        <p className="text-gray-800 leading-relaxed">
          {currentQuestion?.text ||
            currentQuestion?.question ||
            "Chargement..."}
        </p>
      </div>
      <div className="flex justify-end">
        <button
          onClick={handleSpeak}
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

// Composant principal
const Interview = () => {
  const { interviewId } = useParams();
  const localRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
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
    isSpeaking,
    recordings,
    interviewCompleted,
    showModal,
    errorMessage,
    interviewStarted,
    questions,
    loading,
    error: interviewError,
    interviewDetails,
  } = useSelector((state) => state.interview);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [interviewTimer, setInterviewTimer] = useState(900); // 15 minutes
  const [questionTimer, setQuestionTimer] = useState(40);
  const [canProceed, setCanProceed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const hasFetchedRef = useRef(false);
  const recordedBlobsRef = useRef([]); // Stocke les blobs pour chaque question

  useEffect(() => {
    if (!hasFetchedRef.current && interviewId) {
      hasFetchedRef.current = true;
      dispatch(fetchInterviewDetails(interviewId));
      dispatch(fetchRecordings(interviewId));
    }
  }, [interviewId, dispatch]);

  // Handle errors (401, 403, 404)
  useEffect(() => {
    if (interviewError) {
      toast.error(interviewError);
      if (interviewError.includes("Session expirée")) {
        navigate("/login");
      } else {
        navigate("/mesinterview");
      }
    }
  }, [interviewError, navigate]);

  // Speech Recognition Hook
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

    recognition.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          dispatch(setState({ transcript: transcript + " " + transcriptPart }));
        } else {
          interimTranscript += transcriptPart;
        }
      }
    };

    recognition.onerror = (event) => {
      console.error("Erreur de reconnaissance vocale:", event.error);
      if (event.error === "not-allowed") {
        dispatch(setState({ showModal: true }));
      }
    };

    recognition.onend = () => {
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

  const setupSources = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Votre navigateur ne supporte pas l'accès à la caméra");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (!stream) {
        throw new Error("Impossible d'accéder à la caméra");
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
        recordedBlobsRef.current[currentQuestionIndex] = blob;
        dispatch(setRecordedBlob(blob));
        recordedChunksRef.current = [];
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      dispatch(startRecording());

      const recognition = setupRecognition();
      if (recognition) {
        recognitionRef.current = recognition;
        recognition.start();
        dispatch(setState({ isTranscribing: true }));
      }
    } catch (error) {
      dispatch(
        setState({
          cameraError: true,
          showModal: true,
          errorMessage:
            "Erreur lors de l'accès à la caméra ou au microphone: " +
            error.message,
        })
      );
    }
  }, [dispatch, setupRecognition, currentQuestionIndex]);

  const handleEndCall = useCallback(async () => {
    try {
      setIsSaving(true);

      // Arrêter l'enregistrement en cours
      if (isRecording && mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current.stop();
        dispatch(stopRecording());
      }

      // Arrêter le flux média
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Arrêter la transcription
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        dispatch(setState({ isTranscribing: false }));
      }

      // Sauvegarder les enregistrements
      if (recordedBlobsRef.current.length > 0) {
        const recordingsData = questions.map((question, index) => {
          const blob = recordedBlobsRef.current[index];
          return {
            questionIndex: index,
            question: question.text || question.question,
            transcript: recordings[index]?.transcript || transcript || "",
            timestamp: new Date().toISOString(),
            blob: blob
              ? {
                  size: blob.size,
                  type: blob.type,
                  data: blob, // Le Blob sera envoyé directement dans le FormData
                }
              : null,
          };
        });

        console.log("Sauvegarde des enregistrements:", recordingsData);

        const formData = new FormData();
        formData.append(
          "metadata",
          JSON.stringify({
            recordings: recordingsData.map(({ blob, ...rest }) => rest),
            completedAt: new Date().toISOString(),
          })
        );

        // Ajouter les Blobs au FormData
        recordingsData.forEach((recording, index) => {
          if (recording.blob?.data) {
            formData.append(
              `video_${index}`,
              recording.blob.data,
              `question_${index}.webm`
            );
          }
        });

        const result = await dispatch(
          saveInterviewToDatabase({ interviewId, formData })
        ).unwrap();

        if (result.success) {
          toast.success("Entretien sauvegardé avec succès");
          dispatch(hangUp());
          navigate("/mesinterview", { replace: true });
        } else {
          throw new Error(result.error || "Erreur lors de la sauvegarde");
        }
      } else {
        toast.error("Aucune vidéo enregistrée");
        navigate("/mesinterview", { replace: true });
      }
    } catch (error) {
      console.error("Erreur lors de la fin de l'entretien:", error);
      toast.error(
        error.message || "Erreur lors de la sauvegarde de l'entretien"
      );
      navigate("/mesinterview", { replace: true });
    } finally {
      setIsSaving(false);
    }
  }, [
    dispatch,
    isRecording,
    questions,
    transcript,
    recordings,
    interviewId,
    navigate,
  ]);

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
        dispatch(incrementCallTime());
      }, 1000);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [webcamActive, handleEndCall, dispatch]);

  useEffect(() => {
    if (webcamActive && !isSpeaking) {
      setQuestionTimer(5);
      setCanProceed(false);

      const questionTimerRef = setInterval(() => {
        setQuestionTimer((prev) => {
          if (prev <= 1) {
            clearInterval(questionTimerRef);
            setCanProceed(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(questionTimerRef);
    }
  }, [webcamActive, currentQuestionIndex, isSpeaking]);

  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleNextQuestion = useCallback(() => {
    if (!canProceed) {
      toast.info(
        "Veuillez attendre 5 secondes avant de passer à la question suivante"
      );
      return;
    }

    if (isRecording && mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current.stop();
      dispatch(stopRecording());
    }

    window.speechSynthesis.cancel();

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
          transcript: "",
        })
      );
    }

    if (currentQuestionIndex < questions.length - 1) {
      dispatch(goToNextQuestion());
      setCanProceed(false);
      setQuestionTimer(5);
      // Redémarrer l'enregistrement pour la prochaine question
      if (localStreamRef.current) {
        const mediaRecorder = new MediaRecorder(localStreamRef.current, {
          mimeType: "video/webm;codecs=vp9,opus",
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
          recordedBlobsRef.current[currentQuestionIndex + 1] = blob;
          dispatch(setRecordedBlob(blob));
          recordedChunksRef.current = [];
        };
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(1000);
        dispatch(startRecording());
      }
    } else {
      setShowConfirmModal(true);
    }
  }, [
    dispatch,
    canProceed,
    transcript,
    questions,
    currentQuestionIndex,
    recordings,
    isRecording,
  ]);

  const handlePreviousQuestion = useCallback(() => {
    if (!canProceed) {
      toast.info("Veuillez attendre la fin du temps imparti");
      return;
    }

    if (isRecording && mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current.stop();
      dispatch(stopRecording());
    }

    window.speechSynthesis.cancel();

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
          transcript: "",
        })
      );
    }

    if (currentQuestionIndex > 0) {
      dispatch(goToPreviousQuestion());
      setCanProceed(false);
      setQuestionTimer(5);
      // Redémarrer l'enregistrement pour la question précédente
      if (localStreamRef.current) {
        const mediaRecorder = new MediaRecorder(localStreamRef.current, {
          mimeType: "video/webm;codecs=vp9,opus",
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
          recordedBlobsRef.current[currentQuestionIndex - 1] = blob;
          dispatch(setRecordedBlob(blob));
          recordedChunksRef.current = [];
        };
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.start(1000);
        dispatch(startRecording());
      }
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
    isRecording,
  ]);

  const handleGoToQuestion = useCallback(
    (index) => {
      if (isRecording && mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current.stop();
        dispatch(stopRecording());
      }

      dispatch(goToQuestion(index));
      setTimeout(() => {
        if (localStreamRef.current) {
          const mediaRecorder = new MediaRecorder(localStreamRef.current, {
            mimeType: "video/webm;codecs=vp9,opus",
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
            recordedBlobsRef.current[index] = blob;
            dispatch(setRecordedBlob(blob));
            recordedChunksRef.current = [];
          };
          mediaRecorderRef.current = mediaRecorder;
          mediaRecorder.start(1000);
          dispatch(startRecording());
        }
      }, 500);
    },
    [dispatch, isRecording]
  );

  const handleToggleMute = useCallback(() => {
    dispatch(toggleMute());
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !isMuted;
      });
    }
  }, [dispatch, isMuted]);

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
          <Button
            type="primary"
            onClick={() => navigate("/mesinterview", { replace: true })}
          >
            Retour au tableau de bord
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">
                Simulation d'entretien technique (Ingénieur Informatique)
              </h1>
              <p className="text-blue-100 mt-1">
                Répondez aux questions techniques pour vous entraîner
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

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                  <VideoPlayer
                    localRef={localRef}
                    isActive={webcamActive}
                    isRecording={isRecording}
                    cameraError={cameraError}
                  />
                </div>
              </div>
            </div>

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
                      onSpeakQuestion={(status) =>
                        dispatch(setState({ isSpeaking: status }))
                      }
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
                        onClick={() => setShowConfirmModal(true)}
                        disabled={isSaving}
                        className="w-full mt-4 px-4 py-2 rounded-lg bg-green-500 text-white disabled:opacity-50"
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
        <Modal
          title="Confirmer la fin de l'entretien"
          visible={showConfirmModal}
          onOk={handleEndCall}
          onCancel={() => setShowConfirmModal(false)}
          okText="Terminer"
          cancelText="Annuler"
          okButtonProps={{ disabled: isSaving }}
        >
          <p>
            Êtes-vous sûr de vouloir terminer l'entretien ? Vos réponses et
            enregistrements seront sauvegardés.
          </p>
        </Modal>
      )}
    </div>
  );
};

export default Interview;
