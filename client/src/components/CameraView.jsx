import React, { useEffect, useCallback } from "react";
import { Loader2, Mic, MicOff, PhoneOff } from "lucide-react";

const CameraView = ({
  isProcessing,
  onStartRecording,
  onStopRecording,
  onToggleMute,
  onEndCall,
  setLocalState,
  localState,
  mediaRecorderRef,
  recordedChunksRef,
  videoRef,
}) => {
  // Toggle mute
  const handleToggleMute = useCallback(() => {
    if (localState.localStream) {
      const audioTracks = localState.localStream.getAudioTracks();
      const newMuteState = !localState.isMuted;
      audioTracks.forEach((track) => {
        track.enabled = !newMuteState;
      });
      setLocalState((prev) => ({
        ...prev,
        isMuted: newMuteState,
      }));
      onToggleMute();
    }
  }, [localState.localStream, localState.isMuted, setLocalState, onToggleMute]);

  // End call
  const handleEndCall = useCallback(async () => {
    console.log("Arrêt de l'entretien...");
    try {
      if (localState.isRecording && mediaRecorderRef.current) {
        if (mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        onStopRecording();
      }

      if (localState.localStream) {
        localState.localStream.getTracks().forEach((track) => track.stop());
      }

      if (localState.recordedVideoURL) {
        URL.revokeObjectURL(localState.recordedVideoURL);
      }

      setLocalState((prev) => ({
        ...prev,
        webcamActive: false,
        localStream: null,
        isMuted: false,
        isVideoEnabled: false,
        isRecording: false,
        recordedBlob: null,
        recordedVideoURL: "",
        cameraError: null,
      }));

      onEndCall();
    } catch (error) {
      console.error("Erreur lors de l'arrêt de l'entretien:", error);
    }
  }, [
    localState.isRecording,
    localState.localStream,
    localState.recordedVideoURL,
    setLocalState,
    mediaRecorderRef,
    onStopRecording,
    onEndCall,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    const currentMediaRecorder = mediaRecorderRef.current;
    const currentVideoURL = localState.recordedVideoURL;
    const currentStream = localState.localStream;

    return () => {
      console.log("Nettoyage de CameraView...");
      try {
        if (currentStream) {
          currentStream.getTracks().forEach((track) => {
            console.log("Arrêt de la piste:", track.kind);
            track.stop();
          });
        }

        if (
          currentMediaRecorder &&
          currentMediaRecorder.state === "recording"
        ) {
          currentMediaRecorder.stop();
        }

        if (currentVideoURL) {
          URL.revokeObjectURL(currentVideoURL);
          console.log("URL de la vidéo révoquée");
        }
      } catch (error) {
        console.error("Erreur lors du nettoyage:", error);
      }
    };
  }, [localState.localStream, localState.recordedVideoURL, mediaRecorderRef]);

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
              title={
                localState.isMuted
                  ? "Activer le microphone"
                  : "Désactiver le microphone"
              }
            >
              {localState.isMuted ? <MicOff size={24} /> : <Mic size={24} />}
            </button>

            <button
              onClick={handleEndCall}
              className="bg-red-600 text-white p-4 rounded-full hover:bg-red-700 transition-all shadow-md flex items-center justify-center"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <PhoneOff size={24} />
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CameraView;
