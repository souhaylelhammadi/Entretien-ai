import React from "react";
import { Volume2 } from "lucide-react";

const QuestionCard = ({
  currentQuestion,
  currentIndex,
  isSpeaking,
  transcript,
  onSpeakQuestion,
  interviewStarted,
  totalQuestions = 0,
}) => (
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
  </div>
);

export default QuestionCard;
