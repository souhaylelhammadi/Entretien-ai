import React from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Plus,
  Edit,
  Trash2,
  Building,
  MapPin,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  addJob,
  editJob,
  deleteJob,
  setIsAddingJob,
  setIsEditingJob,
  setNewJob,
  addRequirement,
  removeRequirement,
  updateRequirement,
  setSort,
  showAlert,
} from "../../store/recruteur/addjobsSlice";
import { fetchInitialData } from "../../store/recruteur/dashboardSlice";

const JobsSection = () => {
  const dispatch = useDispatch();
  const { jobs } = useSelector((state) => state.dashboard);
  const { isAddingJob, isEditingJob, alert, sortField, sortDirection, newJob } =
    useSelector((state) => state.addjob);

  const validateJob = () => {
    if (!newJob.title || !newJob.department || !newJob.location) {
      dispatch(
        showAlert({
          type: "error",
          message:
            "Please fill in all required fields (Title, Department, Location)",
        })
      );
      return false;
    }
    return true;
  };

  const handleAddJob = async () => {
    if (!validateJob()) return;
    try {
      await dispatch(addJob(newJob)).unwrap();
      dispatch(fetchInitialData());
      dispatch(
        showAlert({
          type: "success",
          message: "Job added successfully",
        })
      );
    } catch (error) {
      dispatch(
        showAlert({
          type: "error",
          message: error.message || "Failed to add job",
        })
      );
    }
  };

  const handleEditJob = async (jobId) => {
    if (!validateJob()) return;
    try {
      await dispatch(editJob({ jobId, jobData: newJob })).unwrap();
      dispatch(fetchInitialData());
      dispatch(
        showAlert({
          type: "success",
          message: "Job updated successfully",
        })
      );
    } catch (error) {
      dispatch(
        showAlert({
          type: "error",
          message: error.message || "Failed to update job",
        })
      );
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm("Are you sure you want to delete this job?")) return;
    try {
      await dispatch(deleteJob(jobId)).unwrap();
      dispatch(fetchInitialData());
      dispatch(
        showAlert({
          type: "success",
          message: "Job deleted successfully",
        })
      );
    } catch (error) {
      dispatch(
        showAlert({
          type: "error",
          message: error.message || "Failed to delete job",
        })
      );
    }
  };
const sortedJobs = [...(jobs || [])]
  .map((job) => ({
    ...job,
    id: String(job._id || job.id),
  }))
  .sort((a, b) => {
    const aValue = a[sortField] || "";
    const bValue = b[sortField] || "";
    const direction = sortDirection === "asc" ? 1 : -1;
    if (typeof aValue === "string") {
      return direction * aValue.localeCompare(bValue);
    }
    return direction * (aValue - bValue);
  });
  const handleSort = (field) => {
    const newDirection =
      sortField === field && sortDirection === "asc" ? "desc" : "asc";
    dispatch(setSort({ field, direction: newDirection }));
  };

 

  return (
    <div className="space-y-6">
      {alert.show && (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`p-4 rounded-lg shadow-lg ${
              alert.type === "success"
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            <div className="flex items-center">
              {alert.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 mr-2" />
              ) : (
                <AlertCircle className="h-5 w-5 mr-2" />
              )}
              <span className="font-medium">{alert.message}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Offres</h2>
        <button
          onClick={() => dispatch(setIsAddingJob(true))}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Job
        </button>
      </div>

      {(isAddingJob || isEditingJob) && (
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">
            {isEditingJob ? "Edit Job" : "Add Job"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField
              label="Job Title *"
              value={newJob.titre}
              onChange={(e) => dispatch(setNewJob({ title: e.target.value }))}
            />
            <InputField
              label="Department *"
              value={newJob.department}
              onChange={(e) =>
                dispatch(setNewJob({ department: e.target.value }))
              }
            />
            <InputField
              label="Location *"
              value={newJob.location}
              onChange={(e) =>
                dispatch(setNewJob({ location: e.target.value }))
              }
            />
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={newJob.description}
                onChange={(e) =>
                  dispatch(setNewJob({ description: e.target.value }))
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                rows="4"
              />
            </div>
            <div className="col-span-2">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Required Skills
                </label>
                <button
                  onClick={() => dispatch(addRequirement())}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2">
                {newJob.requirements.map((req, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={req}
                      onChange={(e) =>
                        dispatch(
                          updateRequirement({ index, value: e.target.value })
                        )
                      }
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder="Add a skill"
                    />
                    <button
                      onClick={() => dispatch(removeRequirement(index))}
                      className="text-red-600 hover:text-red-800"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-4 mt-6">
            <button
              onClick={() => {
                dispatch(setIsAddingJob(false));
                dispatch(setIsEditingJob({ jobId: null }));
                dispatch(
                  setNewJob({
                    title: "",
                    department: "",
                    location: "",
                    description: "",
                    requirements: [],
                    status: "open",
                  })
                );
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                isEditingJob ? handleEditJob(isEditingJob) : handleAddJob()
              }
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {isEditingJob ? "Update" : "Add"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["title", "department", "location"].map((field) => (
                <th
                  key={field}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort(field)}
                >
                  <div className="flex items-center">
                    {field.charAt(0).toUpperCase() + field.slice(1)}
                    {sortField === field &&
                      (sortDirection === "asc" ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      ))}
                  </div>
                </th>
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Skills
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedJobs.map((job) => (
              <tr key={job._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Building className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-sm font-medium text-gray-900">
                      {job.title}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-gray-600">
                    {job.department}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">
                      {job.location}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-2">
                    {Array.isArray(job.requirements) &&
                    job.requirements.length > 0 ? (
                      job.requirements.map((req, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800"
                        >
                          {req}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-500">
                        No skills specified
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-4">
                    <button
                      onClick={() =>
                        dispatch(
                          setIsEditingJob({ jobId: job._id, jobData: job })
                        )
                      }
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteJob(job._id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const InputField = ({ label, value, onChange }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={onChange}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
    />
  </div>
);

export default JobsSection;
