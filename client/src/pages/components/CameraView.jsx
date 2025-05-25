import React, { useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, PhoneOff } from "lucide-react";

const CameraView = ({
  interviewStarted,
  isProcessing,
  onStartRecording,
  onStopRecording,
  onToggleMute,
  onEndCall,
  transcript,
  currentQuestionIndex,
  setLocalState,
  localState,
  mediaRecorderRef,
  recordedChunksRef,
  videoRef,
  recognitionRef,
}) => {
  // Initialize camera and microphone
  const initializeCamera = useCallback(async () => {
    try {
      console.log("Initialisation de la caméra...");
      setLocalState((prev) => ({ ...prev, cameraError: null }));

      // Stop existing resources
      if (localState.localStream) {
        localState.localStream.getTracks().forEach((track) => track.stop());
      }
      if (recognitionRef.current && localState.isTranscribing) {
        recognitionRef.current.stop();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      const constraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Stream obtenu:", stream.getVideoTracks()[0].getSettings());

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
          console.log("Vidéo démarrée avec succès");
        } catch (error) {
          console.error("Erreur lors de la lecture de la vidéo:", error);
          throw new Error("Impossible de démarrer la vidéo");
        }
      }

      const mediaRecorder = new MediaRecorder(stream, {
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
        const url = URL.createObjectURL(blob);
        setLocalState((prev) => ({
          ...prev,
          recordedBlob: blob,
          recordedVideoURL: url,
          isRecording: false,
        }));
        recordedChunksRef.current = [];
      };

      mediaRecorderRef.current = mediaRecorder;
      setLocalState((prev) => ({
        ...prev,
        localStream: stream,
        cameraError: null,
        webcamActive: true,
      }));

      // Start recording if interview has started
      if (interviewStarted) {
        setTimeout(() => {
          onStartRecording();
        }, 1000);
      }
    } catch (error) {
      console.error("Erreur lors de l'initialisation:", error);
      let errorMessage = "Impossible d'accéder à la caméra ou au microphone. ";

      if (error.name === "NotAllowedError") {
        errorMessage +=
          "Veuillez autoriser l'accès à la caméra et au microphone.";
      } else if (error.name === "NotFoundError") {
        errorMessage += "Aucune caméra ou microphone détecté.";
      } else if (error.name === "NotReadableError") {
        errorMessage +=
          "La caméra ou le microphone est utilisé par une autre application.";
      } else {
        errorMessage += `Erreur: ${error.message}`;
      }

      setLocalState((prev) => ({
        ...prev,
        cameraError: errorMessage,
        webcamActive: false,
      }));
    }
  }, [
    interviewStarted,
    localState.localStream,
    localState.isTranscribing,
    setLocalState,
    videoRef,
    mediaRecorderRef,
    recordedChunksRef,
    recognitionRef,
    onStartRecording,
  ]);

  // Start recording
  const handleStartRecording = useCallback(() => {
    if (mediaRecorderRef.current && !localState.isRecording) {
      recordedChunksRef.current = [];
      mediaRecorderRef.current.start();
      setLocalState((prev) => ({ ...prev, isRecording: true }));
      onStartRecording();
    }
  }, [
    mediaRecorderRef,
    localState.isRecording,
    setLocalState,
    onStartRecording,
  ]);

  // Stop recording
  const handleStopRecording = useCallback(() => {
    if (mediaRecorderRef.current && localState.isRecording) {
      mediaRecorderRef.current.stop();
      setLocalState((prev) => ({ ...prev, isRecording: false }));
      onStopRecording();
    }
  }, [
    mediaRecorderRef,
    localState.isRecording,
    setLocalState,
    onStopRecording,
  ]);

  // Toggle mute
  const handleToggleMute = useCallback(() => {
    if (localState.localStream) {
      const audioTracks = localState.localStream.getAudioTracks();
      audioTracks.forEach((track) => (track.enabled = !track.enabled));
      setLocalState((prev) => ({ ...prev, isMuted: !prev.isMuted }));
      onToggleMute();
    }
  }, [localState.localStream, setLocalState, onToggleMute]);

  // End call
  const handleEndCall = useCallback(() => {
    console.log("Arrêt de l'entretien...");
    if (localState.isRecording) {
      handleStopRecording();
    }
    if (localState.localStream) {
      localState.localStream.getTracks().forEach((track) => track.stop());
    }
    if (recognitionRef.current && localState.isTranscribing) {
      recognitionRef.current.stop();
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (localState.recordedVideoURL) {
      URL.revokeObjectURL(localState.recordedVideoURL);
    }
    setLocalState((prev) => ({
      ...prev,
      webcamActive: false,
      localStream: null,
      isMuted: false,
      isRecording: false,
      recordedBlob: null,
      recordedVideoURL: "",
      cameraError: null,
    }));
    onEndCall();
  }, [
    localState.isRecording,
    localState.localStream,
    localState.isTranscribing,
    localState.recordedVideoURL,
    setLocalState,
    recognitionRef,
    handleStopRecording,
    onEndCall,
  ]);

  // Initialize camera when interview starts
  useEffect(() => {
    if (
      interviewStarted &&
      !localState.webcamActive &&
      !localState.cameraError
    ) {
      initializeCamera();
    }
  }, [
    interviewStarted,
    localState.webcamActive,
    localState.cameraError,
    initializeCamera,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("Nettoyage de CameraView...");
      if (localState.localStream) {
        localState.localStream.getTracks().forEach((track) => {
          console.log("Arrêt de la piste:", track.kind);
          track.stop();
        });
      }
      if (localState.recordedVideoURL) {
        URL.revokeObjectURL(localState.recordedVideoURL);
        console.log("URL de la vidéo révoquée");
      }
      if (recognitionRef.current && localState.isTranscribing) {
        recognitionRef.current.stop();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [
    localState.localStream,
    localState.recordedVideoURL,
    localState.isTranscribing,
    recognitionRef,
  ]);

  return (
    <div className="md:w-1/2 bg-blue-50 rounded-xl p-6 shadow-md border border-blue-100">
      <div className="aspect-video bg-black rounded-lg relative">
        {localState.webcamActive ? (
          localState.cameraError ? (
            <div className="w-full h-full flex items-center justify-center text-white">
              {localState.cameraError}
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover rounded-lg"
              />
              {localState.isRecording && (
                <div className="absolute top-4 right-4 flex items-center bg-red-600 text-white px-3 py-1 rounded-full text-sm">
                  <span className="animate-pulse w-3 h-3 bg-white rounded-full mr-2"></span>
                  Enregistrement
                </div>
              )}
            </>
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white">
            Caméra inactive
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-center space-x-4">
        {localState.webcamActive && (
          <>
            <button
              onClick={handleToggleMute}
              className={`p-4 rounded-full transition-all shadow-md flex items-center justify-center ${
                localState.isMuted
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-blue-500 hover:bg-blue-600"
              } text-white`}
              disabled={isProcessing}
            >
              {localState.isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <button
              onClick={handleEndCall}
              className="bg-red-600 text-white p-4 rounded-full hover:bg-red-700 transition-all shadow-md flex items-center justify-center"
              disabled={isProcessing}
            >
              <PhoneOff size={24} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CameraView;
