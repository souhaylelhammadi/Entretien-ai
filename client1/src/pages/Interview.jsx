import React, { useRef, useEffect } from "react";
import { Mic, MicOff, PhoneOff, Volume2, ChevronLeft, ChevronRight } from "lucide-react";
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

const Interview = () => {
  const { offerId } = useParams(); // Récupérer l'offerId depuis l'URL
  const localRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const state = useSelector((state) => state.interview);
  const recognitionRef = useRef(null);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Récupérer les questions depuis le backend
  useEffect(() => {
    fetch("http://localhost:5000/api/questions")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          dispatch(setState({ questions: data.questions }));
        } else {
          throw new Error(data.error || "Erreur lors de la récupération des questions");
        }
      })
      .catch((err) => {
        console.error(err);
        dispatch(setState({ errorMessage: err.message }));
      });
  }, [dispatch]);

  useEffect(() => {
    let interval;
    if (state.webcamActive) {
      interval = setInterval(() => dispatch(incrementCallTime()), 1000);
    }
    return () => clearInterval(interval);
  }, [state.webcamActive, dispatch]);

  useEffect(() => {
    if (state.interviewCompleted) {
      dispatch(saveInterviewToDatabase({ offerId }));
      navigate("/");
    }
  }, [state.interviewCompleted, navigate, dispatch, offerId]);

  useEffect(() => {
    if (localRef.current && state.localStream) {
      localRef.current.srcObject = state.localStream;
    }
  }, [state.localStream]);

  useEffect(() => {
    dispatch(fetchRecordings({ offerId }));
  }, [dispatch, offerId]);

  const setupSources = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (stream.getVideoTracks().length === 0) throw new Error("No video track available");

      dispatch(setState({ localStream: stream, webcamActive: true, cameraError: false, interviewStarted: true }));

      setTimeout(() => {
        if (localRef.current) {
          localRef.current.srcObject = stream;
          localRef.current.play().catch((e) => console.error("Error playing video:", e));
        }
      }, 100);

      setupSpeechRecognition();

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        dispatch(setRecordedBlob({ blob, url: URL.createObjectURL(blob) }));
        recordedChunksRef.current = [];
      };
      mediaRecorderRef.current = mediaRecorder;

      setTimeout(() => {
        dispatch(startRecording());
        speakQuestion();
      }, 1000);
    } catch (error) {
      console.error("Error setting up media sources:", error);
      dispatch(
        setState({
          cameraError: true,
          webcamActive: true,
          showModal: error.name === "NotAllowedError" || error.name === "PermissionDeniedError",
        })
      );
    }
  };

  const setupSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech recognition not supported");
      alert("Speech recognition is not supported by this browser");
      return;
    }

    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = "fr-FR";

    recognitionInstance.onresult = (event) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          dispatch(setState({ transcript: state.transcript + " " + transcriptPart }));
        } else {
          interimTranscript += transcriptPart;
        }
      }
      const interimElement = document.getElementById("interim-transcript");
      if (interimElement) interimElement.textContent = interimTranscript;
    };

    recognitionInstance.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        dispatch(setState({ showModal: true }));
      }
    };

    recognitionRef.current = recognitionInstance;
    if (state.webcamActive && !state.isTranscribing) {
      recognitionInstance.start();
      dispatch(setState({ isTranscribing: true }));
    }
  };

  const startTranscription = () => {
    if (recognitionRef.current && !state.isTranscribing) {
      recognitionRef.current.start();
      dispatch(setState({ isTranscribing: true }));
    }
  };

  const stopTranscription = () => {
    if (recognitionRef.current && state.isTranscribing) {
      recognitionRef.current.stop();
      dispatch(setState({ isTranscribing: false }));
    }
  };

  const speakQuestion = () => {
    if (!window.speechSynthesis) {
      alert("Text-to-speech is not supported by this browser");
      return;
    }

    if (state.isSpeaking) {
      window.speechSynthesis.cancel();
      dispatch(setState({ isSpeaking: false }));
      return;
    }

    const speech = new SpeechSynthesisUtterance(state.questions[state.currentQuestionIndex]);
    speech.lang = "en-US";
    speech.rate = 0.9;
    speech.pitch = 1;

    speech.onstart = () => dispatch(setState({ isSpeaking: true }));
    speech.onend = () => dispatch(setState({ isSpeaking: false }));
    speech.onerror = (event) => {
      console.error("Text-to-speech error:", event);
      dispatch(setState({ isSpeaking: false }));
    };

    window.speechSynthesis.speak(speech);
  };

  const handleNextQuestion = () => {
    dispatch(goToNextQuestion());
    setTimeout(speakQuestion, 500); // Délai pour s'assurer que la question est mise à jour
  };

  const handlePreviousQuestion = () => {
    dispatch(goToPreviousQuestion());
    setTimeout(speakQuestion, 500); // Délai pour s'assurer que la question est mise à jour
  };

  const handleGoToQuestion = (index) => {
    dispatch(goToQuestion(index));
    setTimeout(speakQuestion, 500); // Délai pour s'assurer que la question est mise à jour
  };

  const timePercentage = Math.min((state.callTime / 1800) * 100, 100);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">Simulation d'entretien technique</h1>
              <p className="text-blue-100 mt-1">Répondez aux questions pour vous entraîner</p>
            </div>
            {!state.webcamActive ? (
              <button
                onClick={setupSources}
                className="bg-white text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition-all shadow-md flex items-center font-medium whitespace-nowrap"
              >
                Commencer l'entretien
              </button>
            ) : (
              <div className="flex items-center space-x-2 bg-blue-700/30 px-4 py-2 rounded-full">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-sm">En cours</span>
              </div>
            )}
          </div>
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">
                Question {state.currentQuestionIndex + 1}/{state.questions?.length || 0}
              </span>
              <span className="font-medium">Temps écoulé: {formatTime(state.callTime)}</span>
            </div>
            <div className="relative h-2.5 bg-blue-300/30 rounded-full overflow-hidden">
              <div
                style={{ width: `${timePercentage}%` }}
                className="absolute top-0 left-0 h-full bg-white transition-all duration-300 rounded-full"
              ></div>
            </div>
            <div className="flex justify-between text-xs mt-1 opacity-80">
              <span>0:00</span>
              <span>{formatTime(1800)}</span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Video feed */}
            <div className="flex flex-col">
              <div className="aspect-w-16 aspect-h-9 bg-gray-900 rounded-xl overflow-hidden shadow-lg relative">
                {state.webcamActive ? (
                  state.cameraError ? (
                    <div className="flex flex-col items-center justify-center h-full text-white p-6 text-center">
                      <div className="bg-red-100/20 p-4 rounded-full mb-4">
                        <MicOff className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-medium mb-2">Accès à la caméra refusé</h3>
                      <p className="text-gray-300 text-sm max-w-xs">
                        Veuillez autoriser l'accès à la caméra et au microphone dans les paramètres de votre navigateur
                      </p>
                    </div>
                  ) : (
                    <>
                      <video
                        ref={localRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      {state.isRecording && (
                        <div className="absolute top-4 right-4 flex items-center bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-md">
                          <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></span>
                          Enregistrement
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <div className="bg-gray-200/30 p-4 rounded-full mb-4">
                      <MicOff className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-500 mb-1">Prêt à commencer</h3>
                    <p className="text-gray-400 text-sm">Cliquez sur "Commencer l'entretien" pour démarrer</p>
                  </div>
                )}
              </div>
              <div className="flex justify-center mt-6 space-x-4">
                {state.webcamActive && (
                  <>
                    <button
                      onClick={() => {
                        dispatch(toggleMute());
                        if (state.isMuted && !state.isTranscribing) startTranscription();
                        else if (!state.isMuted && state.isTranscribing) stopTranscription();
                      }}
                      className={`p-4 rounded-full shadow-lg transition-all hover:shadow-xl ${
                        state.isMuted ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"
                      } text-white transform hover:scale-105 active:scale-95`}
                      aria-label={state.isMuted ? "Activer le micro" : "Couper le micro"}
                    >
                      {state.isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>
                    <button
                      onClick={() => {
                        if (state.isRecording) dispatch(stopRecording());
                        dispatch(hangUp());
                      }}
                      className="bg-red-500 text-white p-4 rounded-full hover:bg-red-600 shadow-lg transition-all transform hover:scale-105 active:scale-95"
                      aria-label="Terminer l'appel"
                    >
                      <PhoneOff size={24} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Question card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl shadow-lg border border-blue-100/50">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <h3 className="text-lg font-bold text-blue-800">
                    Question {state.currentQuestionIndex + 1}
                  </h3>
                  <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Technique</span>
                </div>
                {state.isSpeaking && (
                  <div className="flex items-center bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                    <span className="mr-2">Lecture en cours</span>
                    <div className="flex space-x-1">
                      <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                      <span className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></span>
                    </div>
                  </div>
                )}
              </div>
              <div className="bg-white p-5 rounded-lg shadow-sm mb-6 border border-gray-100">
                <p className="text-gray-800 leading-relaxed">
                  {state.questions?.[state.currentQuestionIndex] || "Chargement..."}
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={speakQuestion}
                  className={`flex items-center px-5 py-2.5 rounded-lg transition-all shadow-sm ${
                    !state.interviewStarted ? "bg-gray-300 text-gray-500 cursor-not-allowed" : state.isSpeaking ? "bg-blue-700 text-white hover:bg-blue-800" : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                  disabled={!state.interviewStarted}
                >
                  <Volume2 size={18} className="mr-2" />
                  {state.isSpeaking ? "Arrêter la lecture" : "Écouter la question"}
                </button>
              </div>
              {state.transcript && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Votre réponse:</h4>
                  <div className="bg-white p-4 rounded-lg border border-gray-200 text-gray-700">{state.transcript}</div>
                </div>
              )}
              <div id="interim-transcript" className="mt-2 text-gray-500 italic text-sm"></div>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <button
              onClick={handlePreviousQuestion}
              className={`flex items-center px-5 py-2.5 rounded-lg transition-all ${
                state.currentQuestionIndex === 0 || !state.interviewStarted ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 shadow-sm"
              }`}
              disabled={state.currentQuestionIndex === 0 || !state.interviewStarted}
            >
              <ChevronLeft size={18} className="mr-1" />
              <span className="hidden sm:inline">Précédent</span>
            </button>
            <div className="flex space-x-2">
              {(state.questions || []).map((_, index) => (
                <button
                  key={index}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm transition-all ${
                    !state.interviewStarted ? "bg-gray-100 text-gray-400 cursor-not-allowed" : index === state.currentQuestionIndex ? "bg-blue-600 text-white shadow-sm" : "bg-white border border-blue-200 text-blue-600 hover:bg-blue-50"
                  }`}
                  onClick={() => handleGoToQuestion(index)}
                  disabled={!state.interviewStarted}
                  aria-label={`Question ${index + 1}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <button
              onClick={handleNextQuestion}
              className={`flex items-center px-5 py-2.5 rounded-lg transition-all ${
                !state.interviewStarted ? "bg-gray-100 text-gray-400 cursor-not-allowed" : state.currentQuestionIndex === (state.questions?.length - 1 || 0) ? "bg-green-500 text-white hover:bg-green-600 shadow-sm" : "bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 shadow-sm"
              }`}
              disabled={!state.interviewStarted}
            >
              {state.currentQuestionIndex === (state.questions?.length - 1 || 0) ? (
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

      {state.errorMessage && (
        <div className="mt-4 py-3 px-4 bg-red-50 text-red-600 rounded-lg border border-red-100 max-w-6xl w-full">{state.errorMessage}</div>
      )}

      {state.showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-red-50 p-5 border-b border-red-100">
              <h3 className="text-xl font-bold text-red-600">Accès refusé</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-6">
                L'accès au microphone ou à la caméra a été refusé. Veuillez autoriser l'accès dans les paramètres de votre navigateur pour continuer.
              </p>
              <div className="flex justify-end space-x-3">
                <button onClick={() => navigate("/home")} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
                  Annuler
                </button>
                <button
                  onClick={() => {
                    dispatch(setState({ showModal: false }));
                    setupSources();
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all"
                >
                  Réessayer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Interview;