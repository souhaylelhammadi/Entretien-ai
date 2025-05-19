import React from "react";

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

export default ProgressBar;
