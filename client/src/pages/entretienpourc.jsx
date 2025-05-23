import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from "react";
import {
  Mic,
  MicOff,
  Volume2,
  Loader2,
  CheckCircle2,
  PhoneOff,
  Camera,
  CameraOff,
} from "lucide-react";

// Mock Redux hooks pour la démonstration
const useSelector = (selector) => {
  return {
    webcamActive: false,
    currentQuestionIndex: 0,
    cameraError: false,
    transcript: {},
    isRecording: false,
    isSpeaking: false,
    showModal: false,
    errorMessage: "",
    interviewStarted: false,
    loading: false,
    error: null,
    interviewDetails: { id: "1", title: "Entretien technique React" },
  };
};

// Définition des questions en dehors du mock
const mockQuestions = [
  { id: 1, text: "Parlez-moi de votre expérience en développement React." },
  {
    id: 2,
    text: "Comment gérez-vous l'état dans une application React complexe ?",
  },
  {
    id: 3,
    text: "Expliquez la différence entre useEffect et useLayoutEffect.",
  },
  {
    id: 4,
    text: "Comment optimisez-vous les performances d'une application React ?",
  },
  {
    id: 5,
    text: "Décrivez votre approche pour tester les composants React.",
  },
];

const useDispatch = () => (action) => console.log("Dispatch:", action);
const useNavigate = () => (path) => console.log("Navigate to:", path);
const useParams = () => ({ interviewId: "1" });

// Mock toast
const toast = {
  error: (msg) => console.error("Toast Error:", msg),
  success: (msg) => console.log("Toast Success:", msg),
  info: (msg) => console.log("Toast Info:", msg),
};

// Interface Components
const StatusIndicator = ({ isActive }) => (
  <div className="flex items-center space-x-2 bg-blue-700/30 px-4 py-2 rounded-full w-full md:w-auto justify-center md:justify-start">
    <span
      className={`w-2 h-2 ${
        isActive ? "bg-green-400 animate-pulse" : "bg-gray-400"
      } rounded-full`}
    />
    <span className="text-sm text-white">
      {isActive ? "En cours" : "Hors ligne"}
    </span>
  </div>
);

const ProgressBar = ({ current, total }) => {
  return (
    <div className="mt-4">
      <div className="flex justify-between text-sm mb-1 text-white">
        <span className="font-medium">
          Question {current + 1}/{total || 0}
        </span>
      </div>
      <div className="relative h-2 bg-blue-300/30 rounded-full overflow-hidden">
        <div
          style={{ width: `${((current + 1) / total) * 100}%` }}
          className="absolute top-0 left-0 h-full bg-white transition-all duration-300 rounded-full"
        />
      </div>
    </div>
  );
};

const VideoPlayer = ({
  localRef,
  isActive,
  isRecording,
  cameraError,
  onEndCall,
  onToggleCamera,
}) => {
  useEffect(() => {
    // Vérifier si la vidéo est bien attachée
    if (localRef.current && localRef.current.srcObject) {
      console.log("Vidéo source object:", localRef.current.srcObject);
    }
  }, [localRef]);

  if (cameraError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-white bg-gray-800">
        <CameraOff className="w-16 h-16 mb-4 text-red-400" />
        <p className="text-lg mb-2">Accès à la caméra refusé</p>
        <p className="text-sm text-gray-300 text-center px-4">
          Veuillez autoriser l'accès à la caméra et rafraîchir la page
        </p>
      </div>
    );
  }

  if (!isActive) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-white bg-gray-800">
        <Camera className="w-16 h-16 mb-4 text-gray-400" />
        <p className="text-lg">Caméra désactivée</p>
        <button
          onClick={onToggleCamera}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all"
        >
          Activer la caméra
        </button>
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
        className="w-full h-full object-cover"
        style={{ transform: "scaleX(-1)" }}
        onLoadedMetadata={(e) => {
          console.log("Métadonnées vidéo chargées");
          e.target
            .play()
            .catch((err) => console.error("Erreur de lecture:", err));
        }}
        onError={(e) => {
          console.error("Erreur vidéo:", e.target.error);
        }}
      />

      {/* Indicateur d'enregistrement */}
      {isRecording && (
        <div className="absolute top-4 right-4 flex items-center bg-red-600 text-white px-3 py-1 rounded-full text-sm animate-pulse">
          <div className="w-3 h-3 bg-white rounded-full mr-2 animate-pulse"></div>
          REC
        </div>
      )}

      {/* Contrôles */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-4 bg-black/50 px-4 py-2 rounded-full">
        <button
          onClick={onToggleCamera}
          className="flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-full transition-all shadow-lg"
          title="Activer/Désactiver la caméra"
        >
          {isActive ? (
            <Camera className="w-5 h-5" />
          ) : (
            <CameraOff className="w-5 h-5" />
          )}
        </button>

        <button
          onClick={onEndCall}
          className="flex items-center justify-center bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transition-all shadow-lg"
          title="Terminer l'entretien"
        >
          <PhoneOff className="w-5 h-5" />
        </button>
      </div>
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
  totalQuestions,
  onNext,
  onPrevious,
}) => {
  const handleSpeak = useCallback(() => {
    if (!window.speechSynthesis) {
      toast.error("Synthèse vocale non supportée");
      return;
    }

    // Arrêter toute synthèse en cours
    window.speechSynthesis.cancel();

    const questionText =
      currentQuestion?.text || currentQuestion?.question || "";
    if (!questionText) {
      toast.error("Aucune question disponible");
      return;
    }

    const speech = new SpeechSynthesisUtterance(questionText);
    speech.lang = "fr-FR";
    speech.rate = 0.9;
    speech.pitch = 1;
    speech.volume = 1;

    speech.onstart = () => onSpeakQuestion(true);
    speech.onend = () => onSpeakQuestion(false);
    speech.onerror = (e) => {
      console.error("Erreur de synthèse vocale:", e);
      toast.error("Erreur lors de la lecture");
      onSpeakQuestion(false);
    };

    window.speechSynthesis.speak(speech);
  }, [currentQuestion, onSpeakQuestion]);

  // Convertir le transcript en chaîne de caractères
  const transcriptText = useMemo(() => {
    if (!transcript) return "";
    if (typeof transcript === "object") {
      return transcript[currentIndex] || "";
    }
    return String(transcript);
  }, [transcript, currentIndex]);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl shadow-sm border border-blue-100/50">
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
              <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
              <span
                className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              />
              <span
                className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
                style={{ animationDelay: "0.4s" }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-100">
        <p className="text-gray-800 leading-relaxed">
          {currentQuestion?.text ||
            currentQuestion?.question ||
            "Chargement..."}
        </p>
      </div>

      <div className="flex justify-between gap-2">
        <button
          onClick={onPrevious}
          disabled={currentIndex === 0 || !interviewStarted}
          className={`flex items-center px-4 py-2 rounded-lg transition-all shadow-sm ${
            currentIndex === 0 || !interviewStarted
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          Précédent
        </button>

        <button
          onClick={handleSpeak}
          className={`flex items-center px-4 py-2 rounded-lg transition-all shadow-sm ${
            !interviewStarted
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : isSpeaking
              ? "bg-blue-700 text-white hover:bg-blue-800"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
          disabled={!interviewStarted}
        >
          <Volume2 size={18} className="mr-2" />
          {isSpeaking ? "Arrêter" : "Écouter"}
        </button>

        <button
          onClick={onNext}
          disabled={currentIndex === totalQuestions - 1 || !interviewStarted}
          className={`flex items-center px-4 py-2 rounded-lg transition-all shadow-sm ${
            currentIndex === totalQuestions - 1 || !interviewStarted
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          Suivant
        </button>
      </div>

      {transcriptText && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-500 mb-2">
            Votre réponse:
          </h4>
          <div className="bg-white p-3 rounded-lg border border-gray-200 text-gray-700 text-sm">
            {transcriptText}
          </div>
        </div>
      )}
    </div>
  );
};

const ErrorModal = ({ onClose, onRetry, errorMessage }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
      <div className="bg-red-50 p-5 border-b border-red-100">
        <h3 className="text-xl font-bold text-red-600">Erreur d'accès</h3>
      </div>
      <div className="p-6">
        <p className="text-gray-700 mb-6">{errorMessage}</p>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            Annuler
          </button>
          <button
            onClick={onRetry}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-all"
          >
            Réessayer
          </button>
        </div>
      </div>
    </div>
  </div>
);

const ConfirmModal = ({ isOpen, onClose, onConfirm, isSaving }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="bg-blue-50 p-5 border-b border-blue-100">
          <h3 className="text-xl font-bold text-blue-600">Confirmer la fin</h3>
        </div>
        <div className="p-6">
          <p className="text-gray-700 mb-6">
            Êtes-vous sûr de vouloir terminer l'entretien ? Vos réponses seront
            sauvegardées.
          </p>
          {isSaving && (
            <div className="mb-4 flex items-center text-blue-600">
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              <span>Sauvegarde en cours...</span>
            </div>
          )}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={onConfirm}
              disabled={isSaving}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-all disabled:opacity-50"
            >
              {isSaving ? "Sauvegarde..." : "Terminer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Interview = () => {
  const { interviewId } = useParams();
  const localRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // États locaux
  const [webcamActive, setWebcamActive] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [cameraError, setCameraError] = useState(false);
  const [transcript, setTranscript] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callTime, setCallTime] = useState(0);
  const maxDuration = 1800; // 30 minutes

  // Utiliser les questions mockées
  const questions = mockQuestions;

  // Formatage du temps
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Arrêter la caméra
  const stopCamera = useCallback(() => {
    console.log("Arrêt de la caméra...");

    // Arrêter l'enregistrement
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }

    // Arrêter le flux média
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log("Piste arrêtée:", track.kind);
      });
      streamRef.current = null;
    }

    // Nettoyer l'élément vidéo
    if (localRef.current) {
      localRef.current.srcObject = null;
    }

    // Arrêter la reconnaissance vocale
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Arrêter la synthèse vocale
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setWebcamActive(false);
    setIsRecording(false);
    setInterviewStarted(false);
    setCallTime(0);

    console.log("Caméra arrêtée");
  }, []);

  // Timer pour l'entretien
  useEffect(() => {
    let interval;
    if (webcamActive) {
      interval = setInterval(() => {
        setCallTime((prev) => {
          const newTime = prev + 1;
          if (newTime >= maxDuration) {
            handleEndCall();
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [webcamActive]);

  // Configuration de l'enregistrement
  const setupSources = useCallback(async () => {
    try {
      console.log("Tentative d'accès à la caméra...");

      const constraints = {
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: "user",
          frameRate: { ideal: 30, min: 15 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (!stream) {
        throw new Error("Aucun flux média obtenu");
      }

      streamRef.current = stream;

      if (localRef.current) {
        localRef.current.srcObject = stream;
        await new Promise((resolve, reject) => {
          localRef.current.onloadedmetadata = resolve;
          localRef.current.onerror = reject;
          setTimeout(reject, 5000);
        });
        await localRef.current.play();
      }

      // Configuration de l'enregistreur multimédia
      let mimeType = "video/webm;codecs=vp8,opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        const supportedTypes = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8",
          "video/webm",
          "video/mp4",
        ];
        mimeType =
          supportedTypes.find((type) => MediaRecorder.isTypeSupported(type)) ||
          "";
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (recordedChunksRef.current.length > 0) {
          const blob = new Blob(recordedChunksRef.current, {
            type: mimeType || "video/webm",
          });
          setRecordedBlob(blob);
          console.log("Enregistrement terminé, taille:", blob.size);
          await saveRecording(blob);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);

      // Configuration de la reconnaissance vocale
      if (window.SpeechRecognition || window.webkitSpeechRecognition) {
        const SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "fr-FR";

        recognitionRef.current.onresult = (event) => {
          const transcriptions = Array.from(event.results)
            .map((result) => result[0])
            .map((result) => result.transcript)
            .join("");

          setTranscript((prev) => ({
            ...prev,
            [currentQuestionIndex]: transcriptions,
          }));
        };

        recognitionRef.current.start();
      }

      setWebcamActive(true);
      setCameraError(false);
      setInterviewStarted(true);
      setShowModal(false);
    } catch (error) {
      console.error("Erreur lors de l'accès à la caméra:", error);
      handleCameraError(error);
    }
  }, [currentQuestionIndex]);

  // Fonction pour sauvegarder l'enregistrement
  const saveRecording = async (blob) => {
    try {
      setIsUploading(true);

      const formData = new FormData();
      formData.append("video", blob, `interview_${Date.now()}.webm`);
      formData.append("interviewId", interviewId);
      formData.append("questionIndex", currentQuestionIndex);

      if (transcript[currentQuestionIndex]) {
        formData.append("transcript", transcript[currentQuestionIndex]);
      }

      const response = await fetch("/api/interviews/save-recording", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la sauvegarde");
      }

      const data = await response.json();
      console.log("Enregistrement sauvegardé:", data);
      toast.success("Enregistrement sauvegardé avec succès");
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde de l'enregistrement");
    } finally {
      setIsUploading(false);
    }
  };

  // Fonction pour gérer les erreurs de la caméra
  const handleCameraError = useCallback((error) => {
    let errorMsg = "Erreur d'accès à la caméra";

    if (error.name === "NotAllowedError") {
      errorMsg =
        "L'accès à la caméra a été refusé. Veuillez autoriser l'accès à la caméra dans les paramètres de votre navigateur et rafraîchir la page.";
    } else if (error.name === "NotFoundError") {
      errorMsg =
        "Aucune caméra n'a été trouvée sur votre appareil. Veuillez vérifier que votre caméra est correctement connectée.";
    } else if (error.name === "NotReadableError") {
      errorMsg =
        "La caméra est actuellement utilisée par une autre application. Veuillez fermer les autres applications qui utilisent la caméra et réessayer.";
    } else if (error.name === "OverconstrainedError") {
      errorMsg =
        "Les paramètres de la caméra ne sont pas supportés. Veuillez utiliser un autre navigateur ou une autre caméra.";
    } else if (error.name === "SecurityError") {
      errorMsg =
        "Accès à la caméra bloqué pour des raisons de sécurité. Veuillez vérifier les paramètres de votre navigateur.";
    } else if (error.name === "TypeError") {
      errorMsg =
        "Votre navigateur ne supporte pas l'accès à la caméra. Veuillez utiliser un navigateur moderne comme Chrome, Firefox ou Edge.";
    }

    setCameraError(true);
    setShowModal(true);
    setErrorMessage(errorMsg);
    setWebcamActive(false);
    toast.error(errorMsg);
  }, []);

  // Fonction pour basculer le son
  const toggleMute = useCallback(() => {
    if (streamRef.current) {
      const audioTracks = streamRef.current.getAudioTracks();
      audioTracks.forEach((track) => (track.enabled = !track.enabled));
      setIsMuted((prev) => !prev);
    }
  }, []);

  // Terminer l'entretien
  const handleEndCall = useCallback(async () => {
    try {
      setIsSaving(true);
      console.log("Fin de l'entretien...");

      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }

    if (recordedBlob) {
      await saveRecording(recordedBlob);
    }

    stopCamera();

      toast.success("Entretien sauvegardé avec succès");
      console.log("Entretien terminé et sauvegardé");

      setShowConfirmModal(false);
      setCurrentQuestionIndex(0);
      setTranscript({});
      setRecordedBlob(null);
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde de l'entretien");
    } finally {
      setIsSaving(false);
    }
  }, [stopCamera, recordedBlob, saveRecording]);

  // Toggle caméra
  const toggleCamera = useCallback(() => {
    if (webcamActive) {
      stopCamera();
    } else {
      setupSources();
    }
  }, [webcamActive, stopCamera, setupSources]);

  // Gestionnaires de questions
  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);

      // Auto-speak la question suivante
      setTimeout(() => {
        const nextQuestion = questions[currentQuestionIndex + 1];
        if (nextQuestion && interviewStarted) {
          const speech = new SpeechSynthesisUtterance(nextQuestion.text);
          speech.lang = "fr-FR";
          speech.rate = 0.9;
          speech.onstart = () => setIsSpeaking(true);
          speech.onend = () => setIsSpeaking(false);
          window.speechSynthesis.speak(speech);
        }
      }, 100);
    }
  }, [currentQuestionIndex, questions.length, interviewStarted]);

  const handlePreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  }, [currentQuestionIndex]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Vérifier la compatibilité
  useEffect(() => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage(
        "Votre navigateur ne supporte pas l'accès à la caméra. Veuillez utiliser un navigateur moderne."
      );
      setCameraError(true);
      setShowModal(true);
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-3 sticky top-0 z-10 shadow-md">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-2">
            <div className="w-full md:w-auto">
              <h1 className="text-lg md:text-xl font-bold">
                Simulation d'entretien technique
              </h1>
              <p className="text-blue-100 text-xs md:text-sm">
                Répondez aux questions techniques pour vous entraîner
              </p>
            </div>
            {!webcamActive ? (
              <button
                type="button"
                onClick={setupSources}
                className="w-full md:w-auto bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 transition-all shadow-md text-sm font-medium"
              >
                <Camera className="w-4 h-4 inline mr-2" />
                Commencer l'entretien
              </button>
            ) : (
              <StatusIndicator isActive={webcamActive} />
            )}
          </div>
          <ProgressBar
            current={currentQuestionIndex}
            total={questions.length}
          />
        </div>
      </div>

      {/* Contenu principal */}
      <div className="flex-1 p-3 md:p-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Zone vidéo */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden h-[calc(100vh-12rem)]">
                <div className="relative h-full bg-black">
                  <VideoPlayer
                    localRef={localRef}
                    isActive={webcamActive}
                    isRecording={isRecording}
                    cameraError={cameraError}
                    onEndCall={() => setShowConfirmModal(true)}
                    onToggleCamera={toggleCamera}
                  />
                </div>
              </div>
            </div>

            {/* Zone des questions */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-lg p-3 h-[calc(100vh-12rem)] overflow-y-auto">
                <h2 className="text-lg font-bold mb-3 text-gray-800">
                  Questions
                </h2>
                {!webcamActive ? (
                  <div className="text-center py-6">
                    <Camera className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 mb-3 text-sm">
                      Cliquez sur "Commencer l'entretien" pour voir les
                      questions
                    </p>
                    <button
                      onClick={setupSources}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all text-sm"
                    >
                      Démarrer maintenant
                    </button>
                  </div>
                ) : (
                  <>
                    <QuestionCard
                      currentQuestion={questions[currentQuestionIndex]}
                      currentIndex={currentQuestionIndex}
                      isSpeaking={isSpeaking}
                      transcript={transcript}
                      onSpeakQuestion={setIsSpeaking}
                      interviewStarted={interviewStarted}
                      totalQuestions={questions.length}
                      onNext={handleNextQuestion}
                      onPrevious={handlePreviousQuestion}
                    />

                    {/* Bouton de fin d'entretien */}
                    <div className="mt-4">
                      <button
                        onClick={() => setShowConfirmModal(true)}
                        disabled={isSaving}
                        className="w-full px-3 py-2 rounded-lg bg-green-600 text-white disabled:opacity-50 hover:bg-green-700 transition-colors text-sm font-medium shadow-sm"
                      >
                        {isSaving ? (
                          <span className="flex items-center justify-center">
                            <Loader2 className="animate-spin mr-2 h-4 w-4" />
                            Sauvegarde en cours...
                          </span>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 inline mr-2" />
                            Terminer et sauvegarder
                          </>
                        )}
                      </button>
                    </div>

                    {/* Informations sur l'entretien */}
                    <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="flex items-center text-xs text-blue-700">
                        <div className="flex items-center">
                          {isRecording && (
                            <>
                              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></div>
                              <span className="font-medium">
                                Enregistrement en cours
                              </span>
                            </>
                          )}
                          {!isRecording && webcamActive && (
                            <>
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                              <span>Caméra active</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-blue-600">
                        <p>• Répondez naturellement aux questions</p>
                        <p>• Votre vidéo et audio sont enregistrés</p>
                        <p>• Utilisez les boutons pour naviguer</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Statistiques de l'entretien */}
          {webcamActive && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    <Volume2 className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-600">
                      Questions
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      {currentQuestionIndex + 1}/{questions.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-600">
                      Progression
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      {Math.round(
                        ((currentQuestionIndex + 1) / questions.length) * 100
                      )}
                      %
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div
                    className={`p-2 rounded-lg ${
                      isRecording ? "bg-red-100" : "bg-gray-100"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full ${
                        isRecording ? "bg-red-500 animate-pulse" : "bg-gray-400"
                      }`}
                    />
                  </div>
                  <div className="ml-3">
                    <p className="text-xs font-medium text-gray-600">Statut</p>
                    <p className="text-sm font-bold text-gray-900">
                      {isRecording ? "REC" : "Pause"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleEndCall}
        isSaving={isSaving}
      />

      {showModal && (
        <ErrorModal
          onClose={() => setShowModal(false)}
          onRetry={setupSources}
          errorMessage={errorMessage}
        />
      )}
    </div>
  );
};

export default Interview;
