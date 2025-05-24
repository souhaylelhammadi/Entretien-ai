import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import {
  fetchInterviewDetails,
  saveInterviewToDatabase,
  setState,
  goToNextQuestion,
  goToPreviousQuestion,
  startInterview,
  setProcessing,
  setConfirmModal,
} from "./store/entretienpourcSlice";

// Mock toast for notifications
const toast = {
  error: (msg) => console.error("Toast Error:", msg),
  success: (msg) => console.log("Toast Success:", msg),
  info: (msg) => console.log("Toast Info:", msg),
};

// Status Indicator Component
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

// Progress Bar Component
const ProgressBar = ({ current, total }) => (
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

// Question Card Component
const QuestionCard = ({
  currentQuestion,
  currentIndex,
  isSpeaking,
  transcript,
  interviewStarted,
  totalQuestions,
  onNext,
  onPrevious,
  onFinish,
  isLastQuestion,
}) => {
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
            {currentQuestion?.type || "Technique"}
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
        {isLastQuestion ? (
          <button
            onClick={onFinish}
            disabled={!interviewStarted}
            className={`flex items-center px-4 py-2 rounded-lg transition-all shadow-sm ${
              !interviewStarted
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            Terminer et sauvegarder
          </button>
        ) : (
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
        )}
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

// Error Modal Component
const ErrorModal = ({ onClose, errorMessage }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
      <div className="bg-red-50 p-5 border-b border-red-100">
        <h3 className="text-xl font-bold text-red-600">Erreur d'accès</h3>
      </div>
      <div className="p-6">
        <p className="text-gray-700 mb-6">{errorMessage}</p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  </div>
);

// Confirm Modal Component
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

// Main Interview Component
const Interview = () => {
  const { interviewId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    currentQuestionIndex,
    transcript,
    isSpeaking,
    showModal,
    errorMessage,
    interviewStarted,
    questions,
    loading,
    savingInterview,
    error,
    interviewDetails,
    showConfirmModal,
    isProcessing,
  } = useSelector((state) => state.interview);

  const recognitionRef = useRef(null);
  const [localIsSpeaking, setLocalIsSpeaking] = useState(false);

  useEffect(() => {
    if (interviewId) {
      console.log("Chargement des détails de l'entretien:", interviewId);
      dispatch(fetchInterviewDetails(interviewId));
    }
  }, [dispatch, interviewId]);

  useEffect(() => {
    if (error) {
      console.error("Erreur détectée:", error);
      toast.error(error);
    }
  }, [error]);

  // Fonction pour lire une question avec synthèse vocale
  const speakQuestion = useCallback(
    (questionText) => {
      if (!window.speechSynthesis || !questionText) {
        return;
      }

      // Arrêter toute lecture en cours
      window.speechSynthesis.cancel();

      const speech = new SpeechSynthesisUtterance(questionText);
      speech.lang = "fr-FR";
      speech.rate = 0.9;
      speech.pitch = 1;
      speech.volume = 1;

      speech.onstart = () => {
        setLocalIsSpeaking(true);
        dispatch(setState({ isSpeaking: true }));
      };

      speech.onend = () => {
        setLocalIsSpeaking(false);
        dispatch(setState({ isSpeaking: false }));
      };

      speech.onerror = (e) => {
        console.error("Erreur de synthèse vocale:", e);
        toast.error("Erreur lors de la lecture");
        setLocalIsSpeaking(false);
        dispatch(setState({ isSpeaking: false }));
      };

      window.speechSynthesis.speak(speech);
    },
    [dispatch]
  );

  // Effet pour lire automatiquement la question courante quand elle change
  useEffect(() => {
    if (
      interviewStarted &&
      questions.length > 0 &&
      questions[currentQuestionIndex]
    ) {
      const currentQuestion = questions[currentQuestionIndex];
      const questionText =
        currentQuestion?.text || currentQuestion?.question || "";

      if (questionText) {
        // Délai court pour permettre à l'interface de se mettre à jour
        setTimeout(() => {
          speakQuestion(questionText);
        }, 500);
      }
    }
  }, [currentQuestionIndex, interviewStarted, questions, speakQuestion]);

  // Ajouter un nouvel useEffect pour gérer les transcriptions
  useEffect(() => {
    if (interviewDetails?.qa_pairs) {
      const currentQA = interviewDetails.qa_pairs[currentQuestionIndex];
      if (currentQA) {
        dispatch(
          setState({
            transcript: {
              ...transcript,
              [currentQuestionIndex]: currentQA.answer || "",
            },
          })
        );
      }
    }
  }, [currentQuestionIndex, interviewDetails]);

  const handleStartInterview = async () => {
    try {
      dispatch(setProcessing(true));
      console.log("Démarrage de l'entretien...");

      dispatch(startInterview());

      // Démarrer la reconnaissance vocale
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
          dispatch(
            setState({
              transcript: {
                ...transcript,
                [currentQuestionIndex]: transcriptions,
              },
            })
          );
        };
        recognitionRef.current.start();
      }

      // La lecture de la première question sera automatiquement déclenchée
      // par l'useEffect ci-dessus quand interviewStarted devient true
    } catch (error) {
      console.error("Erreur lors du démarrage:", error);
      dispatch(setState({ errorMessage: error.message, showModal: true }));
    } finally {
      dispatch(setProcessing(false));
    }
  };

  const handleNextQuestion = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      dispatch(goToNextQuestion());
      // La lecture automatique sera déclenchée par l'useEffect
    }
  }, [dispatch, currentQuestionIndex, questions.length]);

  const handlePreviousQuestion = useCallback(() => {
    if (currentQuestionIndex > 0) {
      dispatch(goToPreviousQuestion());
      // La lecture automatique sera déclenchée par l'useEffect
    }
  }, [dispatch, currentQuestionIndex]);

  const handleFinishInterview = useCallback(() => {
    dispatch(setConfirmModal(true));
  }, [dispatch]);

  const handleEndCall = useCallback(async () => {
    try {
      dispatch(setProcessing(true));
      dispatch(setState({ savingInterview: true }));
      console.log("Fin de l'entretien...");

      // Arrêter la reconnaissance vocale
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      // Préparer les données pour la sauvegarde
      const formData = new FormData();

      // Créer un objet pour les enregistrements
      const recordings = questions.map((question, index) => {
        const transcriptText = transcript[index] || "";
        return {
          questionIndex: index,
          question: question?.text || question?.question || "",
          transcript: transcriptText,
          timestamp: new Date().toISOString(),
        };
      });

      // Créer l'objet metadata avec les enregistrements
      const metadata = {
        recordings: recordings,
      };

      // Ajouter les données au FormData
      formData.append("metadata", JSON.stringify(metadata));

      // Log des données envoyées pour le débogage
      console.log("Données envoyées:", {
        interviewId,
        metadata: JSON.parse(formData.get("metadata")),
      });

      // Envoyer les données au serveur
      const response = await dispatch(
        saveInterviewToDatabase({ interviewId, formData })
      ).unwrap();

      console.log("Réponse du serveur:", response);

      toast.success("Entretien sauvegardé avec succès");
      console.log("Entretien terminé et sauvegardé");
      dispatch(setConfirmModal(false));
      dispatch(
        setState({
          currentQuestionIndex: 0,
          transcript: {},
          interviewStarted: false,
        })
      );
      navigate("/mesinterview"); // Redirect to dashboard after saving
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde de l'entretien");
    } finally {
      dispatch(setState({ savingInterview: false }));
      dispatch(setProcessing(false));
    }
  }, [dispatch, interviewId, transcript, questions, navigate]);

  // Nettoyer la synthèse vocale lors du démontage du composant
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
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
            {interviewStarted && (
              <StatusIndicator isActive={interviewStarted} />
            )}
          </div>
          {interviewStarted && (
            <ProgressBar
              current={currentQuestionIndex}
              total={questions.length}
            />
          )}
        </div>
      </div>

      <div className="flex-1 p-3 md:p-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-3">
              <div className="bg-white rounded-lg shadow-lg p-3 h-[calc(100vh-12rem)] overflow-y-auto">
                {!interviewStarted ? (
                  <div className="text-center py-6">
                    <h2 className="text-lg font-bold mb-4 text-gray-800">
                      Prêt à commencer votre entretien ?
                    </h2>
                    <p className="text-gray-500 mb-6 text-sm">
                      {loading ? (
                        <span className="flex items-center justify-center">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Chargement des questions...
                        </span>
                      ) : error ? (
                        <span className="text-red-500 flex flex-col items-center">
                          <span className="mb-2">{error}</span>
                          <button
                            onClick={() =>
                              dispatch(fetchInterviewDetails(interviewId))
                            }
                            className="text-blue-600 hover:text-blue-700 underline"
                          >
                            Réessayer
                          </button>
                        </span>
                      ) : questions.length === 0 ? (
                        "Aucune question disponible pour cet entretien"
                      ) : (
                        `${questions.length} questions techniques vous attendent. Les questions seront lues automatiquement.`
                      )}
                    </p>
                    <button
                      onClick={handleStartInterview}
                      disabled={loading || !questions.length || isProcessing}
                      className={`bg-blue-600 text-white px-6 py-3 rounded-lg transition-all text-lg font-medium ${
                        loading || !questions.length || isProcessing
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-blue-700 shadow-lg hover:shadow-xl"
                      }`}
                    >
                      {loading ? (
                        <span className="flex items-center">
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Chargement...
                        </span>
                      ) : isProcessing ? (
                        <span className="flex items-center">
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Démarrage...
                        </span>
                      ) : (
                        "Démarrer l'entretien"
                      )}
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-lg font-bold mb-3 text-gray-800">
                      Questions d'entretien
                    </h2>
                    {questions.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-red-500 mb-3 text-sm">
                          Aucune question n'a été chargée.
                        </p>
                        <button
                          onClick={() =>
                            dispatch(fetchInterviewDetails(interviewId))
                          }
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all text-sm"
                        >
                          Réessayer de charger les questions
                        </button>
                      </div>
                    ) : (
                      <>
                        <QuestionCard
                          currentQuestion={questions[currentQuestionIndex]}
                          currentIndex={currentQuestionIndex}
                          isSpeaking={localIsSpeaking}
                          transcript={transcript}
                          interviewStarted={interviewStarted}
                          totalQuestions={questions.length}
                          onNext={handleNextQuestion}
                          onPrevious={handlePreviousQuestion}
                          onFinish={handleFinishInterview}
                          isLastQuestion={isLastQuestion}
                        />
                        <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
                          <div className="flex items-center text-xs text-blue-700">
                            <div className="flex items-center">
                              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                              <span>
                                Entretien en cours - Questions lues
                                automatiquement
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-blue-600">
                            <p>• Écoutez attentivement chaque question</p>
                            <p>
                              • Utilisez les boutons pour naviguer entre les
                              questions
                            </p>
                            <p>• Chaque question sera lue automatiquement</p>
                            <p>
                              • Cliquez sur "Terminer et sauvegarder" à la
                              dernière question
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => dispatch(setConfirmModal(false))}
        onConfirm={handleEndCall}
        isSaving={savingInterview || isProcessing}
      />

      {showModal && (
        <ErrorModal
          onClose={() => dispatch(setState({ showModal: false }))}
          errorMessage={errorMessage}
        />
      )}
    </div>
  );
};

export default Interview;
