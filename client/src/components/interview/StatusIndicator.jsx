import React from "react";

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

export default StatusIndicator;
