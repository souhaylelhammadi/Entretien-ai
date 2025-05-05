import React from "react";
import { Bar, Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
} from "chart.js";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement,
  Filler
);

const DashboardGraphs = ({ graphData, selectedPeriod }) => {
  // Prepare data for the activity chart
  const activityData = {
    labels: Object.keys(graphData?.candidatesByDate || {}).sort(),
    datasets: [
      {
        label: "Candidats",
        data: Object.keys(graphData?.candidatesByDate || {})
          .sort()
          .map((date) => graphData.candidatesByDate[date] || 0),
        backgroundColor: "rgba(54, 162, 235, 0.5)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 1,
      },
      {
        label: "Entretiens",
        data: Object.keys(graphData?.interviewsByDate || {})
          .sort()
          .map((date) => graphData.interviewsByDate[date] || 0),
        backgroundColor: "rgba(255, 99, 132, 0.5)",
        borderColor: "rgba(255, 99, 132, 1)",
        borderWidth: 1,
      },
    ],
  };

  // Prepare data for the status distribution chart
  const statusData = {
    labels: Object.keys(graphData?.statusDistribution || {}),
    datasets: [
      {
        data: Object.values(graphData?.statusDistribution || {}),
        backgroundColor: [
          "rgba(54, 162, 235, 0.7)",
          "rgba(255, 206, 86, 0.7)",
          "rgba(75, 192, 192, 0.7)",
          "rgba(153, 102, 255, 0.7)",
          "rgba(255, 99, 132, 0.7)",
        ],
      },
    ],
  };

  // Prepare data for the interview status chart
  const interviewStatusData = {
    labels: Object.keys(graphData?.interviewStatusDistribution || {}),
    datasets: [
      {
        data: Object.values(graphData?.interviewStatusDistribution || {}),
        backgroundColor: [
          "rgba(54, 162, 235, 0.7)",
          "rgba(255, 206, 86, 0.7)",
          "rgba(75, 192, 192, 0.7)",
          "rgba(153, 102, 255, 0.7)",
          "rgba(255, 99, 132, 0.7)",
        ],
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      tooltip: {
        mode: "index",
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Activity Chart */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Activité récente</h3>
        <div className="h-64">
          <Line data={activityData} options={chartOptions} />
        </div>
      </div>

      {/* Status Distribution Chart */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Distribution des statuts</h3>
        <div className="h-64">
          <Pie data={statusData} options={chartOptions} />
        </div>
      </div>

      {/* Interview Status Chart */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Statut des entretiens</h3>
        <div className="h-64">
          <Pie data={interviewStatusData} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};

export default DashboardGraphs;
