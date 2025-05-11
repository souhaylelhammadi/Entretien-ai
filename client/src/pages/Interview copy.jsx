import React, { useRef, useState, useEffect } from "react";
import { Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TECHNICAL_QUESTIONS = [
  "Can you explain how you would implement a microservices architecture in a .NET environment and what benefits it would bring to a project?",
  "Describe your experience with containerization and how you would use Docker with .NET applications.",
  "How would you implement authentication and authorization in a distributed system?",
  "Explain your approach to testing in a microservices architecture.",
  "What strategies would you use for data management across microservices?",
];

const API_BASE_URL = "http://localhost:5000";

const Interview = () => {
  const localRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const navigate = useNavigate();

  const [state, setState] = useState({
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
  });

  const [recognition, setRecognition] = useState(null);
  const maxDuration = 1800; // 30 minutes

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  useEffect(() => {
    let interval;
    if (state.webcamActive) {
      interval = setInterval(() => {
        setState((prev) => {
          const newTime = prev.callTime + 1;
          if (newTime >= maxDuration) {
            completeInterview();
          }
          return { ...prev, callTime: newTime };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state.webcamActive]);

  useEffect(() => {
    if (state.interviewCompleted) {
      navigate("/home");
    }
  }, [state.interviewCompleted, navigate]);

  const completeInterview = () => {
    if (state.isRecording) stopRecording();
    hangUp();
    saveInterviewToDatabase();
    setState((prev) => ({ ...prev, interviewCompleted: true }));
  };

  const setupSources = async () => {
    try {
      const constraints = { video: true, audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (stream.getVideoTracks().length === 0) {
        throw new Error("No video track available");
      }

      setState((prev) => ({ ...prev, localStream: stream }));

      setTimeout(() => {
        if (localRef.current) {
          localRef.current.srcObject = stream;
          localRef.current
            .play()
            .catch((e) => console.error("Error playing video:", e));
        }
      }, 100);

      setState((prev) => ({
        ...prev,
        webcamActive: true,
        cameraError: false,
        interviewStarted: true,
      }));

      setupSpeechRecognition();

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
        setState((prev) => ({
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
      setState((prev) => ({
        ...prev,
        cameraError: true,
        webcamActive: true,
        showModal:
          error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError",
      }));
    }
  };

  const setupSpeechRecognition = () => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();

      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = "fr-FR";

      recognitionInstance.onresult = (event) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setState((prev) => ({
              ...prev,
              transcript: prev.transcript + " " + transcriptPart,
            }));
          } else {
            interimTranscript += transcriptPart;
          }
        }
        const interimElement = document.getElementById("interim-transcript");
        if (interimElement) interimElement.textContent = interimTranscript;
      };

      recognitionInstance.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          setState((prev) => ({ ...prev, showModal: true }));
        }
      };

      setRecognition(recognitionInstance);
    } else {
      console.error("Speech recognition not supported");
      alert("Speech recognition is not supported by this browser");
    }
  };

  const startTranscription = () => {
    if (recognition && !state.isTranscribing) {
      recognition.start();
      setState((prev) => ({ ...prev, isTranscribing: true }));
    }
  };

  const stopTranscription = () => {
    if (recognition && state.isTranscribing) {
      recognition.stop();
      setState((prev) => ({ ...prev, isTranscribing: false }));
    }
  };

  const toggleMute = () => {
    if (state.localStream) {
      const audioTracks = state.localStream.getAudioTracks();
      audioTracks.forEach((track) => (track.enabled = !track.enabled));
      setState((prev) => ({
        ...prev,
        isMuted: !prev.isMuted,
      }));
      if (!state.isMuted && state.isTranscribing) stopTranscription();
      else if (state.isMuted && !state.isTranscribing) startTranscription();
    }
  };

  const hangUp = () => {
    if (state.isRecording) stopRecording();
    if (state.localStream)
      state.localStream.getTracks().forEach((track) => track.stop());
    if (recognition && state.isTranscribing) {
      recognition.stop();
      setState((prev) => ({ ...prev, isTranscribing: false }));
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setState((prev) => ({ ...prev, isSpeaking: false }));
    }
    setState((prev) => ({
      ...prev,
      webcamActive: false,
      localStream: null,
      callTime: 0,
      cameraError: false,
      transcript: "",
      interviewStarted: false,
    }));
  };

  const startRecording = () => {
    if (mediaRecorderRef.current && !state.isRecording) {
      recordedChunksRef.current = [];
      mediaRecorderRef.current.start();
      setState((prev) => ({ ...prev, isRecording: true }));
      startTranscription();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
      setState((prev) => ({ ...prev, isRecording: false }));
      stopTranscription();
    }
  };

  const saveInterviewToDatabase = async () => {
    if (!state.recordedBlob) return;

    try {
      const formData = new FormData();
      formData.append(
        "video",
        state.recordedBlob,
        `interview_${Date.now()}.webm`
      );
      state.recordings.forEach((rec, index) => {
        formData.append(`transcript_${index}`, rec.transcript || "");
        formData.append(`questionIndex_${index}`, rec.questionIndex);
        formData.append(`question_${index}`, rec.question);
        formData.append(`timestamp_${index}`, rec.timestamp);
      });

      const response = await fetch(`${API_BASE_URL}/api/save-recording`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to save recording");
      }
      console.log("Interview saved successfully:", data);
      setState((prev) => ({ ...prev, errorMessage: "" }));
    } catch (error) {
      console.error("Error saving interview:", error);
      setState((prev) => ({
        ...prev,
        errorMessage: "Failed to save interview. Please try again.",
      }));
    }
  };

  const fetchRecordings = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/recordings`);
      const data = await response.json();
      if (data.success) {
        setState((prev) => ({
          ...prev,
          recordings: data.data.map((rec) => ({
            questionIndex: rec.questionIndex,
            transcript: rec.transcript,
            url: rec.videoUrl,
            timestamp: rec.timestamp,
            question: rec.question,
          })),
        }));
      }
    } catch (error) {
      console.error("Error fetching recordings:", error);
      setState((prev) => ({
        ...prev,
        errorMessage: "Failed to load previous recordings.",
      }));
    }
  };

  const speakQuestion = () => {
    if ("speechSynthesis" in window) {
      if (state.isSpeaking) {
        window.speechSynthesis.cancel();
        setState((prev) => ({ ...prev, isSpeaking: false }));
        return;
      }

      const speech = new SpeechSynthesisUtterance(
        TECHNICAL_QUESTIONS[state.currentQuestionIndex]
      );
      speech.lang = "en-US";
      speech.rate = 0.9;
      speech.pitch = 1;

      window.speechSynthesis.onvoiceschanged = () => {
        const voices = window.speechSynthesis.getVoices();
        const englishVoices = voices.filter((voice) =>
          voice.lang.includes("en-")
        );
        if (englishVoices.length > 0) speech.voice = englishVoices[0];
      };

      speech.onstart = () =>
        setState((prev) => ({ ...prev, isSpeaking: true }));
      speech.onend = () => setState((prev) => ({ ...prev, isSpeaking: false }));
      speech.onerror = (event) => {
        console.error("Text-to-speech error:", event);
        setState((prev) => ({ ...prev, isSpeaking: false }));
      };

      window.speechSynthesis.speak(speech);
    } else {
      alert("Text-to-speech is not supported by this browser");
    }
  };

  const goToNextQuestion = () => {
    if (!state.interviewStarted) return;

    if (state.currentQuestionIndex < TECHNICAL_QUESTIONS.length - 1) {
      setState((prev) => ({
        ...prev,
        recordings: [
          ...prev.recordings,
          {
            questionIndex: prev.currentQuestionIndex,
            transcript: prev.transcript,
            question: TECHNICAL_QUESTIONS[prev.currentQuestionIndex],
            timestamp: new Date().toISOString(),
          },
        ],
        transcript: "",
        currentQuestionIndex: prev.currentQuestionIndex + 1,
      }));

      if (state.isSpeaking) {
        window.speechSynthesis.cancel();
        setState((prev) => ({ ...prev, isSpeaking: false }));
      }

      setTimeout(() => {
        const speech = new SpeechSynthesisUtterance(
          TECHNICAL_QUESTIONS[state.currentQuestionIndex + 1]
        );
        speech.lang = "en-US";
        speech.rate = 0.9;
        speech.pitch = 1;

        speech.onstart = () =>
          setState((prev) => ({ ...prev, isSpeaking: true }));
        speech.onend = () =>
          setState((prev) => ({ ...prev, isSpeaking: false }));
        speech.onerror = (event) => {
          console.error("Text-to-speech error:", event);
          setState((prev) => ({ ...prev, isSpeaking: false }));
        };

        window.speechSynthesis.speak(speech);
      }, 300);
    } else {
      setState((prev) => ({
        ...prev,
        recordings: [
          ...prev.recordings,
          {
            questionIndex: prev.currentQuestionIndex,
            transcript: prev.transcript,
            question: TECHNICAL_QUESTIONS[prev.currentQuestionIndex],
            timestamp: new Date().toISOString(),
          },
        ],
      }));
      completeInterview();
    }
  };

  const goToPreviousQuestion = () => {
    if (!state.interviewStarted || state.currentQuestionIndex === 0) return;

    setState((prev) => ({
      ...prev,
      recordings: [
        ...prev.recordings,
        {
          questionIndex: prev.currentQuestionIndex,
          transcript: prev.transcript,
          question: TECHNICAL_QUESTIONS[prev.currentQuestionIndex],
          timestamp: new Date().toISOString(),
        },
      ],
      transcript: "",
      currentQuestionIndex: prev.currentQuestionIndex - 1,
    }));

    if (state.isSpeaking) {
      window.speechSynthesis.cancel();
      setState((prev) => ({ ...prev, isSpeaking: false }));
    }

    setTimeout(() => {
      const speech = new SpeechSynthesisUtterance(
        TECHNICAL_QUESTIONS[state.currentQuestionIndex - 1]
      );
      speech.lang = "en-US";
      speech.rate = 0.9;
      speech.pitch = 1;

      speech.onstart = () =>
        setState((prev) => ({ ...prev, isSpeaking: true }));
      speech.onend = () => setState((prev) => ({ ...prev, isSpeaking: false }));
      speech.onerror = (event) => {
        console.error("Text-to-speech error:", event);
        setState((prev) => ({ ...prev, isSpeaking: false }));
      };

      window.speechSynthesis.speak(speech);
    }, 300);
  };

  const goToQuestion = (index) => {
    if (
      !state.interviewStarted ||
      index === state.currentQuestionIndex ||
      index < 0 ||
      index >= TECHNICAL_QUESTIONS.length
    )
      return;

    setState((prev) => ({
      ...prev,
      recordings: [
        ...prev.recordings,
        {
          questionIndex: prev.currentQuestionIndex,
          transcript: prev.transcript,
          question: TECHNICAL_QUESTIONS[prev.currentQuestionIndex],
          timestamp: new Date().toISOString(),
        },
      ],
      transcript: "",
      currentQuestionIndex: index,
    }));

    if (state.isSpeaking) {
      window.speechSynthesis.cancel();
      setState((prev) => ({ ...prev, isSpeaking: false }));
    }

    setTimeout(() => {
      const speech = new SpeechSynthesisUtterance(TECHNICAL_QUESTIONS[index]);
      speech.lang = "en-US";
      speech.rate = 0.9;
      speech.pitch = 1;

      speech.onstart = () =>
        setState((prev) => ({ ...prev, isSpeaking: true }));
      speech.onend = () => setState((prev) => ({ ...prev, isSpeaking: false }));
      speech.onerror = (event) => {
        console.error("Text-to-speech error:", event);
        setState((prev) => ({ ...prev, isSpeaking: false }));
      };

      window.speechSynthesis.speak(speech);
    }, 300);
  };

  const timePercentage = (state.callTime / maxDuration) * 100;

  useEffect(() => {
    if (localRef.current && state.localStream) {
      localRef.current.srcObject = state.localStream;
    }
  }, [state.localStream]);

  useEffect(() => {
    if (state.webcamActive && recognition && !state.isTranscribing) {
      startTranscription();
    }
  }, [state.webcamActive, recognition, state.isTranscribing]);

  useEffect(() => {
    fetchRecordings();
  }, []);

  return (
    <div className="flex flex-col items-center min-h-screen w-full bg-white">
      <header className="w-full max-w-6xl p-2 text-center">
        <div className="flex justify-between items-start">
          {!state.webcamActive && (
            <button
              onClick={setupSources}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-all shadow-md mb-6"
            >
              Start Interview
            </button>
          )}
          <div className="flex-grow text-center">
            <h2 className="text-3xl font-bold text-blue-600">
              Technical Interview Simulation
            </h2>
            <div className="text-blue-500 mt-2">
              Question {state.currentQuestionIndex + 1} of{" "}
              {TECHNICAL_QUESTIONS.length} ({formatTime(state.callTime)}{" "}
              elapsed)
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
                  <span>{formatTime(state.callTime)}</span>
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
            {state.webcamActive ? (
              state.cameraError ? (
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
                  {state.isRecording && (
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
            {state.webcamActive && (
              <>
                <button
                  onClick={toggleMute}
                  className={`p-4 rounded-full transition-all shadow-md flex items-center justify-center ${
                    state.isMuted
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-blue-500 hover:bg-blue-600"
                  } text-white`}
                >
                  {state.isMuted ? <MicOff size={24} /> : <Mic size={24} />}
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
                Question {state.currentQuestionIndex + 1}
              </h3>
              {state.isSpeaking && (
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
              {TECHNICAL_QUESTIONS[state.currentQuestionIndex]}
            </p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={speakQuestion}
                className="bg-white text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50 flex items-center"
                disabled={!state.interviewStarted}
              >
                <Volume2 size={18} className="mr-2" />
                {state.isSpeaking ? "Stop Speaking" : "Speak Question"}
              </button>
            </div>
          </div>

          
        </div>
      </div>

      <div className="w-full max-w-6xl flex justify-between mt-4">
        <button
          onClick={goToPreviousQuestion}
          className={`px-6 py-3 rounded-lg ${
            state.currentQuestionIndex === 0 || !state.interviewStarted
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-blue-100 text-blue-700 hover:bg-blue-200"
          }`}
          disabled={state.currentQuestionIndex === 0 || !state.interviewStarted}
        >
          Previous
        </button>

        <div className="flex">
          {TECHNICAL_QUESTIONS.map((_, index) => (
            <button
              key={index}
              className={`w-8 h-8 rounded-full mx-1 ${
                !state.interviewStarted
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : index === state.currentQuestionIndex
                  ? "bg-blue-500 text-white"
                  : "bg-blue-100 text-blue-700"
              }`}
              onClick={() => goToQuestion(index)}
              disabled={!state.interviewStarted}
            >
              {index + 1}
            </button>
          ))}
        </div>

        <button
          onClick={goToNextQuestion}
          className={`px-6 py-3 rounded-lg ${
            !state.interviewStarted
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : state.currentQuestionIndex === TECHNICAL_QUESTIONS.length - 1
              ? "bg-green-500 text-white hover:bg-green-600"
              : "bg-blue-100 text-blue-700 hover:bg-blue-200"
          }`}
          disabled={!state.interviewStarted}
        >
          {state.currentQuestionIndex === TECHNICAL_QUESTIONS.length - 1
            ? "Finish"
            : "Next"}
        </button>
      </div>

      {state.errorMessage && (
        <p className="text-red-600 mt-4 text-center">{state.errorMessage}</p>
      )}

      {state.showModal && (
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
                  setState((prev) => ({ ...prev, showModal: false }))
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
