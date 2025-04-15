import React from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Video,
  Download,
  Check,
  X,
  Edit,
  FileText,
  User,
  Calendar,
  Eye,
  Star,
  Save,
  MessageSquare,
} from "lucide-react";
import { setSelectedInterview,closeCard } from "../../store/recruteur/candidatesinterviewsSlice";

const InterviewsSection = () => {
  const dispatch = useDispatch();
  const { interviews, candidates } = useSelector((state) => state.dashboard);
  const { selectedInterview, showCard } = useSelector(
    (state) => state.interviews
  );

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
          }`}
        />
      );
    }
    return stars;
  };

  return (
    <div className="relative bg-white rounded-lg shadow-sm border">
      <div className="p-5 flex justify-between items-center border-b">
        <h2 className="text-lg font-semibold">Entretiens</h2>
      </div>

      <table className="w-full divide-y">
        <thead className="bg-gray-50">
          <tr>
            {["Candidat", "", "Date", "Statut", "Actions"].map((header) => (
              <th
                key={header}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {interviews.map((interview) => {
            const candidate = candidates.find(
              (c) => c._id === interview.candidateId
            );
            return (
              <tr key={interview._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium">
                  <div className="flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    {interview.candidateName || candidate?.name || "Inconnu"}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm">{interview.position}</td>
                <td className="px-6 py-4 text-sm">
                  {new Date(interview.date).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      interview.status === "Terminé"
                        ? "bg-green-100 text-green-800"
                        : interview.status === "Annulé"
                        ? "bg-red-100 text-red-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {interview.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex space-x-2">
                    <button
                      className="flex items-center text-blue-600 hover:text-blue-800"
                      title="Voir les détails"
                      onClick={() => dispatch(setSelectedInterview(interview))}
                    >
                      <Eye className="h-5 w-5 mr-1" />
                      <span className="text-xs">Détails</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {showCard && selectedInterview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-auto py-10">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-full overflow-y-auto">
            <div className="sticky top-0 bg-white border-b z-10">
              <div className="flex justify-between items-center p-4">
                <div className="flex items-center">
                  <span className="text-xs text-blue-600">
                    Interview Summary
                  </span>
                </div>
                <button
                  onClick={() => dispatch(closeCard())}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6 border-b">
              <div className="flex justify-between mb-4">
                <h3 className="font-semibold text-lg">
                  Question & Response List
                </h3>
                <button className="text-gray-400">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="19" cy="12" r="1" />
                    <circle cx="5" cy="12" r="1" />
                  </svg>
                </button>
              </div>
              <div className="mb-8">
                <h4 className="font-medium text-lg mb-1">Question 1</h4>
                <p className="text-sm text-gray-600 mb-3">
                  When inspired you to apply for this position?
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm">
                    I've always been passionate about technology and innovation.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-lg mb-1">Question 3</h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Can you describe a challenging project?
                  </p>
                  <div className="bg-gray-50 p-4 rounded-lg h-24">
                    <p className="text-sm">
                      I had to develop a web software application within a short
                      timeframe...
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <div className="flex justify-between">
                    <h4 className="font-medium text-lg mb-1">Question 6</h4>
                    <button className="text-gray-400">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="1" />
                        <circle cx="19" cy="12" r="1" />
                        <circle cx="5" cy="12" r="1" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Where do you see yourself in 5 years?
                  </p>
                  <div className="bg-indigo-100 border border-indigo-400 p-4 rounded-lg h-24">
                    <p className="text-sm">
                      I hope to have grown into a leadership role where I can
                      guide other developers...
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-b">
              <h3 className="font-semibold text-lg mb-4">Interview Rating</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Rating by AI</h4>
                  <div className="flex mb-2">{renderStars(4)}</div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm">
                      <span className="font-medium">AI Comments:</span> The
                      candidate showed exceptional skills in problem-solving and
                      communication.
                    </p>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Rating by Recruiter</h4>
                  <div className="flex mb-2">{renderStars(4)}</div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm">
                      <span className="font-medium">Recruiter Comments:</span>{" "}
                      The candidate is a good fit for the position. I recommend
                      to go to the next steps.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium">
                    <FileText className="h-4 w-4 inline mr-2" />
                    Media Report - Nov 2023
                  </h4>
                  <button className="text-gray-500 hover:text-gray-700">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
                  <p className="text-xs text-gray-700 mb-2">
                    During our in-depth interview, the candidate demonstrated an
                    in-depth understanding of software development principles...
                  </p>
                  <p className="text-xs text-gray-700 mb-2">
                    When discussing teamwork scenarios, the candidate showed
                    collaborative approaches and an ability to adapt to
                    different working styles...
                  </p>
                  <p className="text-xs text-gray-700">
                    Overall, I believe this candidate would be a valuable
                    addition to our development team...
                  </p>
                </div>
              </div>
              <div>
                <h4 className="font-medium mb-4">Recording</h4>
                <div className="relative bg-gray-800 rounded-lg overflow-hidden">
                  <div className="aspect-w-16 aspect-h-9">
                    <img
                      src="/api/placeholder/400/300"
                      alt="Interview recording preview"
                      className="w-full h-64 object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <button className="bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-3">
                        <Video className="h-6 w-6 text-blue-600" />
                      </button>
                    </div>
                  </div>
                  <div className="absolute bottom-4 right-4">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 rounded-md flex items-center">
                      <Video className="h-4 w-4 mr-1" />
                      View Recording
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end">
              <button
                onClick={() => dispatch(closeCard())}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InterviewsSection;
