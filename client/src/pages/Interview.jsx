import React, { useRef, useEffect, useCallback } from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  ChevronLeft,
  ChevronRight,
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
} from "./store/interviewsSlice";
import { toast } from "react-toastify";

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
}) => (
  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl shadow-lg border border-blue-100/50">
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center">
        <h3 className="text-lg font-bold text-blue-800">
          Question {currentIndex + 1}
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
        {currentQuestion || "Chargement..."}
      </p>
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
    <div
      id="interim-transcript"
      className="mt-2 text-gray-500 italic text-sm"
    ></div>
  </div>
);

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
  const { applicationId } = useParams();
  const localRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const {
    webcamActive,
    isMuted,
    callTime,
    localStream,
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
  } = useSelector((state) => state.interview);

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
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          dispatch(setState({ showModal: true }));
        }
      };

      return recognition;
    }, [dispatch, transcript]);

    const startTranscription = useCallback(() => {
      if (recognitionRef.current && !isTranscribing) {
        recognitionRef.current.start();
        dispatch(setState({ isTranscribing: true }));
      }
    }, [isTranscribing]);

    const stopTranscription = useCallback(() => {
      if (recognitionRef.current && isTranscribing) {
        recognitionRef.current.stop();
        dispatch(setState({ isTranscribing: false }));
      }
    }, [isTranscribing]);

    return { setupRecognition, startTranscription, stopTranscription };
  };

  const { setupRecognition, startTranscription, stopTranscription } =
    useSpeechRecognition();

  // Fetch Questions
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/questions", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
        });
        const data = await response.json();
        if (data.success) {
          dispatch(setState({ questions: data.questions.map((q) => q.text) }));
        } else {
          throw new Error(
            data.error || "Erreur lors de la récupération des questions"
          );
        }
      } catch (err) {
        console.error(err);
        dispatch(setState({ errorMessage: err.message }));
        toast.error(err.message);
      }
    };
    fetchQuestions();
  }, [dispatch]);

  // Timer
  useEffect(() => {
    let interval = null;
    if (webcamActive) {
      interval = setInterval(() => dispatch(incrementCallTime()), 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [webcamActive, dispatch]);

  // Handle Interview Completion
  useEffect(() => {
    if (interviewCompleted) {
      dispatch(saveInterviewToDatabase({ applicationId }));
      navigate("/mes-entretiens");
    }
  }, [interviewCompleted, navigate, dispatch, applicationId]);

  // Setup Video Stream
  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream;
      localRef.current
        .play()
        .catch((e) => console.error("Erreur de lecture vidéo:", e));
    }
  }, [localStream]);

  // Fetch Previous Recordings
  useEffect(() => {
    dispatch(fetchRecordings({ applicationId }));
  }, [dispatch, applicationId]);

  const setupSources = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (stream.getVideoTracks().length === 0) {
        throw new Error("Aucune piste vidéo disponible");
      }

      dispatch(
        setState({
          localStream: stream,
          webcamActive: true,
          cameraError: false,
          interviewStarted: true,
        })
      );

      const recognition = setupRecognition();
      if (recognition) {
        recognitionRef.current = recognition;
        recognition.start();
        dispatch(setState({ isTranscribing: true }));
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm",
      });
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: "video/webm",
        });
        dispatch(setRecordedBlob({ blob, url: URL.createObjectURL(blob) }));
        recordedChunksRef.current = [];
      };
      mediaRecorderRef.current = mediaRecorder;

      setTimeout(() => {
        dispatch(startRecording());
        mediaRecorder.start();
        speakQuestion();
      }, 1000);
    } catch (error) {
      console.error(
        "Erreur lors de la configuration des sources média:",
        error
      );
      dispatch(
        setState({
          cameraError: true,
          webcamActive: true,
          showModal:
            error.name === "NotAllowedError" ||
            error.name === "PermissionDeniedError",
        })
      );
      toast.error("Échec de l'accès à la caméra/microphone");
    }
  }, [dispatch, setupRecognition]);

  const speakQuestion = useCallback(() => {
    if (!window.speechSynthesis) {
      toast.error("Synthèse vocale non supportée par ce navigateur");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      dispatch(setState({ isSpeaking: false }));
      return;
    }

    const speech = new SpeechSynthesisUtterance(
      questions[currentQuestionIndex] || ""
    );
    speech.lang = "fr-FR";
    speech.rate = 0.9;
    speech.pitch = 1;

    speech.onstart = () => dispatch(setState({ isSpeaking: true }));
    speech.onend = () => dispatch(setState({ isSpeaking: false }));
    speech.onerror = (event) => {
      console.error("Erreur de synthèse vocale:", event);
      dispatch(setState({ isSpeaking: false }));
      toast.error("Erreur lors de la lecture de la question");
    };

    window.speechSynthesis.speak(speech);
  }, [isSpeaking, questions, currentQuestionIndex, dispatch]);

  const handleNextQuestion = useCallback(() => {
    dispatch(goToNextQuestion());
    setTimeout(speakQuestion, 500);
  }, [dispatch, speakQuestion]);

  const handlePreviousQuestion = useCallback(() => {
    dispatch(goToPreviousQuestion());
    setTimeout(speakQuestion, 500);
  }, [dispatch, speakQuestion]);

  const handleGoToQuestion = useCallback(
    (index) => {
      dispatch(goToQuestion(index));
      setTimeout(speakQuestion, 500);
    },
    [dispatch, speakQuestion]
  );

  const handleToggleMute = useCallback(() => {
    dispatch(toggleMute());
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

  const handleEndCall = useCallback(() => {
    if (isRecording) {
      dispatch(stopRecording());
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    }
    dispatch(hangUp());
  }, [dispatch, isRecording]);

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Video Feed */}
            <div className="flex flex-col">
              <div className="aspect-w-16 aspect-h-9 bg-gray-900 rounded-xl overflow-hidden shadow-lg relative">
                <VideoPlayer
                  localRef={localRef}
                  isActive={webcamActive}
                  isRecording={isRecording}
                  cameraError={cameraError}
                />
              </div>
              <div className="flex justify-center mt-6 space-x-4">
                {webcamActive && (
                  <>
                    <button
                      onClick={handleToggleMute}
                      className={`p-4 rounded-full shadow-lg transition-all hover:shadow-xl ${
                        isMuted
                          ? "bg-red-500 hover:bg-red-600"
                          : "bg-blue-500 hover:bg-blue-600"
                      } text-white transform hover:scale-105 active:scale-95`}
                      aria-label={
                        isMuted ? "Activer le micro" : "Couper le micro"
                      }
                    >
                      {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>
                    <button
                      onClick={handleEndCall}
                      className="bg-red-500 text-white p-4 rounded-full hover:bg-red-600 shadow-lg transition-all transform hover:scale-105 active:scale-95"
                      aria-label="Terminer l'appel"
                    >
                      <PhoneOff size={24} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Question Card */}
            <QuestionCard
              currentQuestion={questions[currentQuestionIndex]}
              currentIndex={currentQuestionIndex}
              isSpeaking={isSpeaking}
              transcript={transcript}
              onSpeakQuestion={speakQuestion}
              interviewStarted={interviewStarted}
            />
          </div>

          {/* Navigation */}
          <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button
              onClick={handlePreviousQuestion}
              className={`flex items-center px-5 py-2.5 rounded-lg transition-all ${
                currentQuestionIndex === 0 || !interviewStarted
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 shadow-sm"
              }`}
              disabled={currentQuestionIndex === 0 || !interviewStarted}
            >
              <ChevronLeft size={18} className="mr-1" />
              <span className="hidden sm:inline">Précédent</span>
            </button>
            <div className="flex space-x-2">
              {questions.map((_, index) => (
                <button
                  key={index}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all ${
                    !interviewStarted
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : index === currentQuestionIndex
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white border border-blue-200 text-blue-600 hover:bg-blue-50"
                  }`}
                  onClick={() => handleGoToQuestion(index)}
                  disabled={!interviewStarted}
                  aria-label={`Question ${index + 1}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <button
              onClick={handleNextQuestion}
              className={`flex items-center px-5 py-2.5 rounded-lg transition-all ${
                !interviewStarted
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : currentQuestionIndex === questions.length - 1
                  ? "bg-green-500 text-white hover:bg-green-600 shadow-sm"
                  : "bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 shadow-sm"
              }`}
              disabled={!interviewStarted}
            >
              {currentQuestionIndex === questions.length - 1 ? (
                <span>Terminer l'entretien</span>
              ) : (
                <>
                  <span className="hidden sm:inline">Suivant</span>
                  <ChevronRight size={18} className="ml-1" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-4 py-3 px-4 bg-red-50 text-red-600 rounded-lg border border-red-100 max-w-6xl w-full">
          {errorMessage}
        </div>
      )}

      {showModal && (
        <PermissionDeniedModal
          onClose={() => dispatch(setState({ showModal: false }))}
          onRetry={() => {
            dispatch(setState({ showModal: false }));
            setupSources();
          }}
          onNavigate={() => navigate("/mes-entretiens")}
        />
      )}
    </div>
  );
};

export default Interview;
