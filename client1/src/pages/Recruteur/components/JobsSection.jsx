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

  // Auto-dismiss alerts after 5 seconds
  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => {
        dispatch(clearAlert());
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, dispatch]);

  const prepareJobData = () => {
    // Filtrer les champs vides
    const competences = newJob.requirements.filter((req) => req.trim());

    return {
      // Utilisation des attributs exacts comme dans insert_data.py
      titre: newJob.title.trim(),
      description: newJob.description.trim(),
      localisation: newJob.location.trim(),
      departement: newJob.department.trim(),
      competences_requises: competences,

      // Champs pour le modèle Pydantic (conservés pour compatibilité)
      title: newJob.title.trim(),
      department: newJob.department.trim(),
      location: newJob.location.trim(),
      requirements: competences,
      status: "open",

      // Champs communs
      recruteur_id: user?._id || user?.id,
      entreprise_id: user?.entreprise_id || "",

      // Champs supplémentaires de la base de données
      questions_ids: [],
      candidature_ids: [],
      date_creation: new Date().toISOString(),
      date_maj: new Date().toISOString(),
    };
  };

  const validateJob = () => {
    if (
      !newJob.title ||
      !newJob.department ||
      !newJob.location ||
      !newJob.description ||
      newJob.requirements.length === 0 ||
      newJob.requirements.every((req) => !req.trim()) ||
      !["open", "closed"].includes(newJob.status)
    ) {
      dispatch(
        showAlert({
          type: "error",
          message:
            "Veuillez remplir tous les champs obligatoires (Titre, Département, Localisation, Description, au moins une compétence) et vérifiez que le statut est 'open' ou 'closed'",
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

      // Logs de débogage détaillés
      console.log("----------- DONNÉES DE L'OFFRE -----------");
      console.log("Données préparées:", jobData);
      console.log("Title/Titre:", jobData.title, jobData.titre);
      console.log("Recruteur ID:", jobData.recruteur_id);
      console.log("Entreprise ID:", jobData.entreprise_id);
      console.log("Token utilisé:", token);
      console.log("Type du token:", typeof token);
      console.log("----------------------------------------");

      // Vérifier si le token est nul ou vide
      if (!token) {
        console.error("Aucun token disponible dans le state!");
        const localToken = localStorage.getItem("token");
        console.log("Token du localStorage:", localToken);

        // Si aucun token n'est trouvé, essayer de récupérer le token via un autre moyen
        if (localToken) {
          console.log("Utilisation du token du localStorage");
          await dispatch(addJob({ jobData, token: localToken })).unwrap();
        } else {
          throw new Error("Veuillez vous reconnecter, session expirée");
        }
      } else {
        const result = await dispatch(addJob({ jobData, token })).unwrap();
        console.log("Résultat de l'ajout:", result);
      }

      dispatch(fetchInitialData({ page: 1, limit: 10, token }));
      dispatch(
        showAlert({
          type: "success",
          message: "Offre d'emploi ajoutée avec succès",
        })
      );
    } catch (error) {
      console.error("Erreur lors de l'ajout de l'offre:", error);
      dispatch(
        showAlert({
          type: "error",
          message: error.message || "Échec de l'ajout de l'offre",
        })
      );
    }
  };

  const handleEditJob = async (jobId) => {
    if (!validateJob()) return;
    try {
      // Vérifier que jobId est défini et valide - convertir en chaîne si nécessaire
      jobId = jobId ? String(jobId) : null;

      if (!jobId || jobId === "undefined") {
        console.error("ID de l'offre invalide:", jobId);
        dispatch(
          showAlert({
            type: "error",
            message: "Impossible de modifier l'offre: ID invalide",
          })
        );
        return;
      }

      const jobData = prepareJobData();

      // Logs pour débogage de la modification
      console.log("----------- MODIFICATION DE L'OFFRE -----------");
      console.log("ID de l'offre à modifier:", jobId);
      console.log("Type de l'ID:", typeof jobId);
      console.log("Données envoyées:", jobData);
      console.log("Recruteur ID:", jobData.recruteur_id);
      console.log("Entreprise ID:", jobData.entreprise_id);
      console.log("Token utilisé:", token);
      console.log("----------------------------------------");

      await dispatch(editJob({ jobId, jobData, token })).unwrap();
      dispatch(fetchInitialData({ page: 1, limit: 10, token }));
      dispatch(
        showAlert({
          type: "success",
          message: "Offre mise à jour avec succès",
        })
      );
    } catch (error) {
      console.error("Erreur lors de la modification:", error);
      dispatch(
        showAlert({
          type: "error",
          message: error.message || "Échec de la modification de l'offre",
        })
      );
    }
  };

  const handleDeleteJob = async (jobId) => {
    // Vérifier et convertir l'ID
    if (jobId) {
      jobId = String(jobId);
    }

    if (!jobId || jobId === "undefined" || jobId.trim() === "") {
      console.error("ID d'offre invalide pour suppression:", jobId);
      dispatch(
        showAlert({
          type: "error",
          message: "Impossible de supprimer l'offre: ID invalide",
        })
      );
      return;
    }

    if (!window.confirm("Are you sure you want to delete this job?")) return;

    try {
      console.log("Tentative de suppression de l'offre ID:", jobId);
      await dispatch(deleteJob({ jobId, token })).unwrap();
      dispatch(fetchInitialData({ page: 1, limit: 10, token }));
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

  const normalizeJobs = (jobs) => {
    return jobs.map((job) => ({
      _id: job._id,
      title: job.title || job.titre || "",
      department: job.department || job.departement || "",
      location: job.location || job.localisation || "",
      description: job.description || "",
      requirements: job.requirements || [],
      status: job.status || "open",
    }));
  };

  const sortedJobs = useMemo(() => {
    return [...normalizeJobs(jobs || [])].sort((a, b) => {
      const aValue = a[sortField] || "";
      const bValue = b[sortField] || "";
      const direction = sortDirection === "asc" ? 1 : -1;
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
          Gestion des offres d'emploi
        </h2>
        <button
          onClick={() => dispatch(setIsAddingJob(true))}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          disabled={loading}
        >
          <Plus className="w-5 h-5 mr-2" />
          Nouvelle offre
        </button>
      </div>

      {/* Modal pour ajouter/modifier une offre */}
      {(isAddingJob || isEditingJob) && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-10 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-screen overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                {isEditingJob ? (
                  <>
                    <Edit className="w-6 h-6 mr-3 text-blue-600" />
                    Modifier l'offre d'emploi
                  </>
                ) : (
                  <>
                    <Plus className="w-6 h-6 mr-3 text-blue-600" />
                    Nouvelle offre d'emploi
                  </>
                )}
              </h3>
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
                    Informations principales
                  </h4>

                  <div className="space-y-4">
                    <InputField
                      label="Titre du poste *"
                      value={newJob.title}
                      onChange={(e) =>
                        dispatch(setNewJob({ title: e.target.value }))
                      }
                      placeholder="Ex: Développeur Full Stack"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputField
                        label="Département *"
                        value={newJob.department}
                        onChange={(e) =>
                          dispatch(setNewJob({ department: e.target.value }))
                        }
                        placeholder="Ex: Informatique"
                      />
                      <InputField
                        label="Localisation *"
                        value={newJob.location}
                        onChange={(e) =>
                          dispatch(setNewJob({ location: e.target.value }))
                        }
                        placeholder="Ex: Paris"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-green-600" />
                    Description du poste
                  </h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Détails du poste *
                    </label>
                    <textarea
                      value={newJob.description}
                      onChange={(e) =>
                        dispatch(setNewJob({ description: e.target.value }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
                      rows="5"
                      placeholder="Décrivez les responsabilités, missions, et autres informations importantes du poste..."
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-5 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold text-gray-800 flex items-center">
                      <CheckCircle2 className="w-5 h-5 mr-2 text-blue-600" />
                      Les question qui doit etre questioner dans l'entretien
                    </h4>
                    <button
                      onClick={() => dispatch(addRequirement())}
                      className="text-blue-600 hover:text-blue-800 flex items-center bg-blue-50 px-3 py-2 rounded-lg transition-colors border border-blue-100 hover:border-blue-200"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Ajouter une question
                    </button>
                  </div>

                  <div className="space-y-3">
                    {newJob.requirements.length === 0 && (
                      <div className="bg-white p-4 rounded-lg border border-dashed border-gray-300 text-center">
                        <MapPin className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">
                          Ajoutez au moins une compétence requise pour ce poste
                        </p>
                      </div>
                    )}

                    {newJob.requirements.map((req, index) => (
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
                className="py-2 px-4 text-gray-700 bg-white hover:bg-gray-100 rounded-lg transition-colors flex justify-center items-center border border-gray-300"
                disabled={loading}
              >
                <XCircle className="w-5 h-5 mr-2" />
                Annuler
              </button>

              <button
                onClick={() => {
                  if (isEditingJob) {
                    console.log(
                      "Mode édition, type de isEditingJob:",
                      typeof isEditingJob
                    );
                    console.log("ID de l'offre à modifier:", isEditingJob);
                    // Convertir en chaîne si ce n'est pas déjà le cas
                    const idToEdit =
                      typeof isEditingJob === "string"
                        ? isEditingJob
                        : String(isEditingJob);
                    handleEditJob(idToEdit);
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
                {isEditingJob ? "Mettre à jour l'offre" : "Publier l'offre"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200">
        {sortedJobs.length === 0 ? (
          <div className="p-8 text-center">
            <Building className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-lg">
              Aucune offre d'emploi disponible
            </p>
            <p className="text-gray-400 mt-1">
              Cliquez sur "Nouvelle offre" pour créer votre première offre
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  { id: "title", label: "Titre" },
                  { id: "department", label: "Département" },
                  { id: "location", label: "Localisation" },
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
                <tr
                  key={job._id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building className="h-5 w-5 text-blue-500 mr-2" />
                      <span className="text-sm font-medium text-gray-900">
                        {job.title}
                        {job._id}
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
                      <MapPin className="h-5 w-5 text-green-500 mr-2" />
                      <span className="text-sm text-gray-600">
                        {job.location}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => {
                          // S'assurer que job._id est défini et convertir en chaîne si nécessaire
                          const jobId = job._id ? String(job._id) : null;

                          if (!jobId || jobId === "undefined") {
                            console.error("ID d'offre invalide:", jobId);
                            dispatch(
                              showAlert({
                                type: "error",
                                message:
                                  "Impossible de modifier l'offre: ID invalide",
                              })
                            );
                            return;
                          }

                          console.log(
                            "Début de modification de l'offre ID:",
                            jobId
                          );
                          dispatch(
                            setIsEditingJob({
                              jobId: jobId,
                              jobData: job,
                            })
                          );
                        }}
                        className="text-blue-600 hover:text-blue-800 bg-blue-50 p-2 rounded-lg transition-colors"
                        disabled={loading}
                        title="Modifier cette offre"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteJob(job._id)}
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
