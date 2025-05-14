import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
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
  fetchJobs,
  resetNewJob,
  addRequirement,
  removeRequirement,
  updateRequirement,
  setSort,
  clearAlert,
  showAlert,
} from "../../store/recruteur/jobsSlice";

const JobsSection = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const {
    jobs,
    loading,
    isAddingJob,
    isEditingJob,
    editingJobId,
    newJob,
    alert = { show: false, type: "", message: "" },
    sortField,
    sortDirection,
  } = useSelector((state) => state.jobs);
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    if (!user) {
      dispatch(
        showAlert({
          type: "error",
          message: "Veuillez vous connecter pour accéder à cette page",
        })
      );
      navigate("/login");
      return;
    }

    dispatch(fetchJobs());
  }, [dispatch, navigate, user]);

  useEffect(() => {
    if (alert?.show) {
      const timer = setTimeout(() => {
        dispatch(clearAlert());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [alert?.show, dispatch]);

  const prepareJobData = () => {
    return {
      titre: newJob.titre.trim(),
      description: newJob.description.trim(),
      localisation: newJob.localisation.trim(),
      departement: newJob.departement.trim(),
      competences_requises: newJob.competences_requises
        .filter((req) => req && req.trim())
        .map((req) => req.trim()),
      statut: newJob.statut,
      date_creation: new Date().toISOString(),
      date_maj: new Date().toISOString(),
    };
  };

  const validateJob = () => {
    const errors = [];
    if (!newJob.titre?.trim()) errors.push("Titre de l'offre");
    if (!newJob.description?.trim()) errors.push("Description");
    if (!newJob.localisation?.trim()) errors.push("Localisation");
    if (!newJob.departement?.trim()) errors.push("Département");
    if (
      !newJob.competences_requises?.length ||
      newJob.competences_requises.every((req) => !req?.trim())
    )
      errors.push("Compétences requises");

    if (errors.length > 0) {
      dispatch(
        showAlert({
          type: "error",
          message: `Champs obligatoires manquants :\n• ${errors.join("\n• ")}`,
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
      await dispatch(addJob(jobData)).unwrap();
      await dispatch(fetchJobs());

      // Définir un flag dans sessionStorage pour indiquer qu'une offre a été ajoutée
      // Ce flag sera vérifié par le dashboard pour forcer le rechargement des données
      sessionStorage.setItem("fromOfferAdd", "true");

      dispatch(resetNewJob());
      dispatch(setIsAddingJob(false));
    } catch (error) {
      dispatch(
        showAlert({
          type: "error",
          message: error.message || "Échec de la création de l'offre",
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
            message: "Impossible de modifier l'offre : ID invalide",
          })
        );
        return;
      }

      const jobData = prepareJobData();
      await dispatch(editJob({ jobId, jobData })).unwrap();
      await dispatch(fetchJobs());
      dispatch(resetNewJob());
      dispatch(setIsEditingJob({ isEditing: false, jobId: null }));
    } catch (error) {
      dispatch(
        showAlert({
          type: "error",
          message: error.message || "Échec de la modification de l'offre",
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
          message: "Impossible de supprimer l'offre : ID invalide",
        })
      );
      return;
    }

    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette offre ?"))
      return;

    try {
      await dispatch(deleteJob(jobId)).unwrap();
      await dispatch(fetchJobs());
    } catch (error) {
      dispatch(
        showAlert({
          type: "error",
          message: error.message || "Échec de la suppression de l'offre",
        })
      );
    }
  };

  const handleSort = (field) => {
    const newDirection =
      sortField === field && sortDirection === "asc" ? "desc" : "asc";
    dispatch(setSort({ field, direction: newDirection }));
  };

  const handleEditClick = (job) => {
    dispatch(
      setIsEditingJob({
        isEditing: true,
        jobId: job.id,
        jobData: {
          titre: job.titre,
          description: job.description,
          localisation: job.localisation,
          departement: job.departement,
          competences_requises: job.competences_requises,
          statut: job.statut,
        },
      })
    );
  };

  const sortedJobs = [...jobs].sort((a, b) => {
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
          Gestion des Offres d'Emploi
        </h2>
        <button
          onClick={() => dispatch(setIsAddingJob(true))}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          disabled={loading}
        >
          <Plus className="w-5 h-5 mr-2" />
          Nouvelle Offre
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
                    Modifier l'Offre d'Emploi
                  </>
                ) : (
                  <>
                    <Plus className="w-6 h-6 mr-3 text-blue-600" />
                    Nouvelle Offre d'Emploi
                  </>
                )}
              </h3>
              <button
                onClick={() => {
                  dispatch(setIsAddingJob(false));
                  dispatch(setIsEditingJob({ isEditing: false, jobId: null }));
                  dispatch(resetNewJob());
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
                    Informations Principales
                  </h4>

                  <div className="space-y-4">
                    <InputField
                      label="Titre de l'Offre *"
                      value={newJob.titre}
                      onChange={(e) =>
                        dispatch(setNewJob({ titre: e.target.value }))
                      }
                      placeholder="Ex: Développeur Full Stack"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField
                        label="Département *"
                        value={newJob.departement}
                        onChange={(e) =>
                          dispatch(setNewJob({ departement: e.target.value }))
                        }
                        placeholder="Ex: Informatique"
                      />
                      <InputField
                        label="Localisation *"
                        value={newJob.localisation}
                        onChange={(e) =>
                          dispatch(setNewJob({ localisation: e.target.value }))
                        }
                        placeholder="Ex: Paris"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Statut *
                      </label>
                      <select
                        value={newJob.statut}
                        onChange={(e) =>
                          dispatch(setNewJob({ statut: e.target.value }))
                        }
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                      >
                        <option value="ouverte">Ouverte</option>
                        <option value="fermée">Fermée</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-green-600" />
                    Description de l'Offre
                  </h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Détails de l'Offre *
                    </label>
                    <textarea
                      value={newJob.description}
                      onChange={(e) =>
                        dispatch(setNewJob({ description: e.target.value }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                      rows="5"
                      placeholder="Décrivez les responsabilités, missions et autres informations importantes de l'offre..."
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold text-gray-800 flex items-center">
                      <CheckCircle2 className="w-5 h-5 mr-2 text-blue-600" />
                      Compétences Requises
                    </h4>
                    <button
                      onClick={() => dispatch(addRequirement())}
                      className="text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-3 py-2 rounded-lg transition-colors border border-blue-100 hover:border-blue-200"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Ajouter une Compétence
                    </button>
                  </div>

                  <div className="space-y-3">
                    {newJob.competences_requises.length === 0 && (
                      <div className="bg-white p-4 rounded-lg border border-dashed border-gray-300 text-center">
                        <MapPin className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">
                          Ajoutez au moins une compétence requise pour ce poste
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
                          placeholder="Ex: React.js, Python, Gestion..."
                        />
                        <button
                          onClick={() => dispatch(removeRequirement(index))}
                          className="text-red-600 hover:text-red-800 bg-red-50 p-2 rounded-lg hover:bg-red-100 transition-colors"
                          title="Supprimer cette compétence"
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
                  dispatch(setIsEditingJob({ isEditing: false, jobId: null }));
                  dispatch(resetNewJob());
                }}
                className="py-2 px-4 text-gray-700 bg-white hover:bg-gray-100 rounded-lg transition-colors flex justify-center items-center border border-gray-300"
                disabled={loading}
              >
                <XCircle className="w-5 h-5 mr-2" />
                Annuler
              </button>

              <button
                onClick={() =>
                  isEditingJob ? handleEditJob(editingJobId) : handleAddJob()
                }
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
                {isEditingJob ? "Mettre à Jour l'Offre" : "Publier l'Offre"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        {jobs.length === 0 ? (
          <div className="p-8 text-center">
            <Building className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-lg">
              Aucune offre d'emploi disponible
            </p>
            <p className="text-gray-400 mt-1">
              Cliquez sur "Nouvelle Offre" pour créer votre première offre
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  { id: "titre", label: "Titre" },
                  { id: "departement", label: "Département" },
                  { id: "localisation", label: "Localisation" },
                  { id: "date_creation", label: "Date de Création" },
                  { id: "statut", label: "Statut" },
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
                        job.statut === "ouverte"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {job.statut === "ouverte" ? "Ouverte" : "Fermée"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => handleEditClick(job)}
                        className="text-blue-600 hover:text-blue-800 bg-blue-50 p-2 rounded-lg transition-colors"
                        disabled={loading}
                        title="Modifier cette offre"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteJob(String(job.id))}
                        className="text-red-600 hover:text-red-800 bg-red-50 p-2 rounded-lg transition-colors"
                        disabled={loading}
                        title="Supprimer cette offre"
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
