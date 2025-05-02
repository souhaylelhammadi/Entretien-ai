import React, { useEffect, useMemo } from "react";
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
  X,
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
  clearAlert,
} from "../../store/recruteur/addjobsSlice";
import { fetchInitialData } from "../../store/recruteur/dashboardSlice";

const JobsSection = () => {
  const dispatch = useDispatch();
  const { jobs } = useSelector((state) => state.dashboard);
  const {
    isAddingJob,
    isEditingJob,
    alert,
    sortField,
    sortDirection,
    newJob,
    loading,
  } = useSelector((state) => state.addjob);
  const { user, token } = useSelector((state) => state.auth);

  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => {
        dispatch(clearAlert());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, dispatch]);

  useEffect(() => {
    console.log("Received jobs:", jobs);
    console.log("Token:", token);
    console.log("User:", user);
  }, [jobs, token, user]);

  const prepareJobData = () => {
    const competences = newJob.competences_requises.filter((req) => req.trim());
    return {
      titre: newJob.titre.trim(),
      description: newJob.description.trim(),
      localisation: newJob.localisation.trim(),
      departement: newJob.departement.trim(),
      competences_requises: competences,
      status: newJob.status,
      recruteur_id: String(user?._id || user?.id || ""),
      entreprise_id: String(user?.entreprise_id || ""),
      candidature_ids: [],
      date_creation: new Date().toISOString(),
      date_maj: new Date().toISOString(),
    };
  };

  const validateJob = () => {
    if (
      !newJob.titre ||
      !newJob.departement ||
      !newJob.localisation ||
      !newJob.description ||
      newJob.competences_requises.length === 0 ||
      newJob.competences_requises.every((req) => !req.trim()) ||
      !["open", "closed"].includes(newJob.status) ||
      !user?.entreprise_id ||
      !user?.id
    ) {
      dispatch(
        showAlert({
          type: "error",
          message:
            "Please fill all required fields (Title, Department, Location, Description, at least one skill) and check your connection",
        })
      );
      return false;
    }
    return true;
  };

  const handleAddJob = async () => {
    if (!validateJob()) return;
    try {
      const jobData = prepareJobData();
      console.log("Data sent for addition:", jobData);

      if (!token) {
        const localToken = localStorage.getItem("token");
        if (!localToken) {
          throw new Error("Please log in again, session expired");
        }
        await dispatch(addJob({ jobData, token: localToken })).unwrap();
      } else {
        await dispatch(addJob({ jobData, token })).unwrap();
      }

      dispatch(fetchInitialData({ page: 1, limit: 10, token }));
      dispatch(
        showAlert({
          type: "success",
          message: "Job offer added successfully",
        })
      );
    } catch (error) {
      console.error("Error during addition:", error);
      dispatch(
        showAlert({
          type: "error",
          message: error.message || "Failed to add job offer",
        })
      );
    }
  };

  const handleEditJob = async (jobId) => {
    if (!validateJob()) return;
    try {
      jobId = String(jobId);
      if (!jobId || jobId === "undefined") {
        dispatch(
          showAlert({
            type: "error",
            message: "Cannot edit job offer: Invalid ID",
          })
        );
        return;
      }

      const jobData = prepareJobData();
      console.log("Data sent for modification:", jobData);

      await dispatch(editJob({ jobId, jobData, token })).unwrap();
      dispatch(fetchInitialData({ page: 1, limit: 10, token }));
      dispatch(
        showAlert({
          type: "success",
          message: "Job offer updated successfully",
        })
      );
    } catch (error) {
      console.error("Error during modification:", error);
      dispatch(
        showAlert({
          type: "error",
          message: error.message || "Failed to edit job offer",
        })
      );
    }
  };

  const handleDeleteJob = async (jobId) => {
    jobId = String(jobId);
    if (!jobId || jobId === "undefined") {
      dispatch(
        showAlert({
          type: "error",
          message: "Cannot delete job offer: Invalid ID",
        })
      );
      return;
    }

    if (!window.confirm("Are you sure you want to delete this job offer?"))
      return;

    try {
      console.log("Deleting job ID:", jobId);
      await dispatch(deleteJob({ jobId, token })).unwrap();
      dispatch(fetchInitialData({ page: 1, limit: 10, token }));
      dispatch(
        showAlert({
          type: "success",
          message: "Job offer deleted successfully",
        })
      );
    } catch (error) {
      console.error("Error during deletion:", error);
      dispatch(
        showAlert({
          type: "error",
          message: error.message || "Failed to delete job offer",
        })
      );
    }
  };

  const normalizeJobs = (jobs) => {
    if (!jobs) return [];

    if (Array.isArray(jobs)) {
      return jobs.map((job) => ({
        id: String(job.id),
        titre: job.titre || "",
        description: job.description || "",
        entreprise_id: String(job.entreprise_id || ""),
        recruteur_id: String(job.recruteur_id || ""),
        localisation: job.localisation || "",
        departement: job.departement || "",
        competences_requises: job.competences_requises || [],
        candidature_ids: job.candidature_ids || [],
        date_creation: job.date_creation || new Date().toISOString(),
        date_maj: job.date_maj || new Date().toISOString(),
        status: job.status || "open",
      }));
    }

    if (jobs.offres && Array.isArray(jobs.offres)) {
      return jobs.offres.map((job) => ({
        id: String(job.id),
        titre: job.titre || "",
        description: job.description || "",
        entreprise_id: String(job.entreprise_id || ""),
        recruteur_id: String(job.recruteur_id || ""),
        localisation: job.localisation || "",
        departement: job.departement || "",
        competences_requises: job.competences_requises || [],
        candidature_ids: job.candidature_ids || [],
        date_creation: job.date_creation || new Date().toISOString(),
        date_maj: job.date_maj || new Date().toISOString(),
        status: job.status || "open",
      }));
    }

    return [];
  };

  const sortedJobs = useMemo(() => {
    const normalizedJobs = normalizeJobs(jobs);
    console.log("Normalized jobs:", normalizedJobs);

    return [...normalizedJobs].sort((a, b) => {
      const aValue = a[sortField] || "";
      const bValue = b[sortField] || "";
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortField === "date_creation") {
        return direction * (new Date(aValue) - new Date(bValue));
      }

      if (typeof aValue === "string") {
        return (
          direction *
          aValue.localeCompare(bValue, undefined, { sensitivity: "base" })
        );
      }

      return direction * (aValue - bValue);
    });
  }, [jobs, sortField, sortDirection]);

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
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <Building className="w-6 h-6 mr-2 text-blue-600" />
          Job Offer Management
        </h2>
        <button
          onClick={() => dispatch(setIsAddingJob(true))}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          disabled={loading}
        >
          <Plus className="w-5 h-5 mr-2" />
          New Offer
        </button>
      </div>

      {(isAddingJob || isEditingJob) && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-10 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-screen overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                {isEditingJob ? (
                  <>
                    <Edit className="w-6 h-6 mr-3 text-blue-600" />
                    Edit Job Offer
                  </>
                ) : (
                  <>
                    <Plus className="w-6 h-6 mr-3 text-blue-600" />
                    New Job Offer
                  </>
                )}
              </h3>
              <button
                onClick={() => {
                  dispatch(setIsAddingJob(false));
                  dispatch(setIsEditingJob({ jobId: null }));
                  dispatch(
                    setNewJob({
                      titre: "",
                      departement: "",
                      localisation: "",
                      description: "",
                      competences_requises: [],
                      status: "open",
                    })
                  );
                }}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(100vh-140px)]">
              <div className="grid grid-cols-1 gap-6">
                <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Building className="w-5 h-5 mr-2 text-blue-600" />
                    Main Information
                  </h4>

                  <div className="space-y-4">
                    <InputField
                      label="Job Title *"
                      value={newJob.titre}
                      onChange={(e) =>
                        dispatch(setNewJob({ titre: e.target.value }))
                      }
                      placeholder="Ex: Full Stack Developer"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField
                        label="Department *"
                        value={newJob.departement}
                        onChange={(e) =>
                          dispatch(setNewJob({ departement: e.target.value }))
                        }
                        placeholder="Ex: IT"
                      />
                      <InputField
                        label="Location *"
                        value={newJob.localisation}
                        onChange={(e) =>
                          dispatch(setNewJob({ localisation: e.target.value }))
                        }
                        placeholder="Ex: Paris"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-green-600" />
                    Job Description
                  </h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Job Details *
                    </label>
                    <textarea
                      value={newJob.description}
                      onChange={(e) =>
                        dispatch(setNewJob({ description: e.target.value }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                      rows="5"
                      placeholder="Describe the responsibilities, missions, and other important job information..."
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold text-gray-800 flex items-center">
                      <CheckCircle2 className="w-5 h-5 mr-2 text-blue-600" />
                      Required Skills
                    </h4>
                    <button
                      onClick={() => dispatch(addRequirement())}
                      className="text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-3 py-2 rounded-lg transition-colors border border-blue-100 hover:border-blue-200"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Skill
                    </button>
                  </div>

                  <div className="space-y-3">
                    {newJob.competences_requises.length === 0 && (
                      <div className="bg-white p-4 rounded-lg border border-dashed border-gray-300 text-center">
                        <MapPin className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">
                          Add at least one required skill for this position
                        </p>
                      </div>
                    )}

                    {newJob.competences_requises.map((req, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-2 bg-white p-3 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                      >
                        <input
                          type="text"
                          value={req}
                          onChange={(e) =>
                            dispatch(
                              updateRequirement({
                                index,
                                value: e.target.value,
                              })
                            )
                          }
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="Ex: React.js, Python, Management..."
                        />
                        <button
                          onClick={() => dispatch(removeRequirement(index))}
                          className="text-red-600 hover:text-red-800 bg-red-50 p-2 rounded-lg hover:bg-red-100 transition-colors"
                          title="Remove this skill"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50 flex items-center justify-end space-x-4">
              <button
                onClick={() => {
                  dispatch(setIsAddingJob(false));
                  dispatch(setIsEditingJob({ jobId: null }));
                  dispatch(
                    setNewJob({
                      titre: "",
                      departement: "",
                      localisation: "",
                      description: "",
                      competences_requises: [],
                      status: "open",
                    })
                  );
                }}
                className="py-2 px-4 text-gray-700 bg-white hover:bg-gray-100 rounded-lg transition-colors flex justify-center items-center border border-gray-300"
                disabled={loading}
              >
                <XCircle className="w-5 h-5 mr-2" />
                Cancel
              </button>

              <button
                onClick={() => {
                  if (isEditingJob) {
                    console.log("Edit mode, ID:", isEditingJob);
                    handleEditJob(isEditingJob);
                  } else {
                    handleAddJob();
                  }
                }}
                className={`py-2 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center shadow-sm ${
                  loading ? "opacity-70 cursor-not-allowed" : ""
                }`}
                disabled={loading}
              >
                {loading ? (
                  <span className="inline-block mr-2 h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : isEditingJob ? (
                  <Edit className="w-5 h-5 mr-2" />
                ) : (
                  <Plus className="w-5 h-5 mr-2" />
                )}
                {isEditingJob ? "Update Offer" : "Publish Offer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        {sortedJobs.length === 0 ? (
          <div className="p-8 text-center">
            <Building className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-lg">No job offers available</p>
            <p className="text-gray-400 mt-1">
              Click "New Offer" to create your first offer
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  { id: "titre", label: "Title" },
                  { id: "departement", label: "Department" },
                  { id: "localisation", label: "Location" },
                  { id: "date_creation", label: "Creation Date" },
                  { id: "status", label: "Status" },
                ].map((field) => (
                  <th
                    key={field.id}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleSort(field.id)}
                  >
                    <div className="flex items-center">
                      {field.label}
                      {sortField === field.id && (
                        <span className="ml-1">
                          {sortDirection === "asc" ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedJobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building className="h-5 w-5 text-blue-500 mr-2" />
                      <span className="text-sm font-medium text-gray-900">
                        {job.titre}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600">
                      {job.departement}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <MapPin className="h-5 w-5 text-green-500 mr-2" />
                      <span className="text-sm text-gray-600">
                        {job.localisation}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-600">
                      {new Date(job.date_creation).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        job.status === "open"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {job.status === "open" ? "Open" : "Closed"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => {
                          const jobId = String(job.id);
                          dispatch(
                            setIsEditingJob({
                              jobId,
                              jobData: job,
                            })
                          );
                        }}
                        className="text-blue-600 hover:text-blue-800 bg-blue-50 p-2 rounded-lg transition-colors"
                        disabled={loading}
                        title="Edit this offer"
                      >
                        <Edit className="h-5 w-5" />
                        {job.id}
                      </button>
                      <button
                        onClick={() => handleDeleteJob(job.id)}
                        className="text-red-600 hover:text-red-800 bg-red-50 p-2 rounded-lg transition-colors"
                        disabled={loading}
                        title="Delete this offer"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const InputField = ({ label, value, onChange, type = "text", placeholder }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-colors shadow-sm"
      placeholder={placeholder}
    />
  </div>
);

export default JobsSection;
