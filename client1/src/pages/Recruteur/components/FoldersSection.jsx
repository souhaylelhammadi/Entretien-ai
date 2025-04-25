import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  fetchFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  addOfferToFolder,
  removeOfferFromFolder,
  setIsCreatingFolder,
  setIsEditingFolder,
  setNewFolder,
  setSelectedFolder,
  clearFolderError,
} from "../../store/recruteur/foldersSlice";
import { fetchInitialData } from "../../store/recruteur/dashboardSlice";
import {
  Folder,
  FolderPlus,
  Edit,
  Trash2,
  Save,
  X,
  Plus,
  Briefcase,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const FoldersSection = () => {
  const dispatch = useDispatch();
  const {
    folders,
    isCreatingFolder,
    isEditingFolderId,
    loading,
    error,
    selectedFolderId,
    newFolder,
  } = useSelector((state) => state.folders);
  const { jobs } = useSelector((state) => state.dashboard);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [isAddingOfferToFolder, setIsAddingOfferToFolder] = useState(null);
  const [selectedOfferToAdd, setSelectedOfferToAdd] = useState("");
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });

  const showAlert = (alertData) => {
    setAlert({ show: true, ...alertData });
    setTimeout(() => {
      setAlert({ show: false, type: "", message: "" });
    }, 5000);
  };

  useEffect(() => {
    dispatch(fetchFolders());
    if (jobs.length === 0) {
      dispatch(fetchInitialData({ page: 1, limit: 100 })); // Load all jobs
    }
  }, [dispatch, jobs.length]);

  const handleCreateFolder = () => {
    if (!newFolder.name.trim()) {
      alert("Le nom du dossier est requis");
      return;
    }
    dispatch(createFolder(newFolder));
  };

  const handleUpdateFolder = () => {
    if (!newFolder.name.trim()) {
      alert("Le nom du dossier est requis");
      return;
    }
    dispatch(
      updateFolder({ folderId: isEditingFolderId, folderData: newFolder })
    );
  };

  const handleDeleteFolder = (folderId) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce dossier ?")) {
      dispatch(deleteFolder(folderId));
    }
  };

  const handleAddOfferToFolder = () => {
    if (!selectedOfferToAdd) {
      alert("Veuillez sélectionner une offre");
      return;
    }
    dispatch(
      addOfferToFolder({
        folderId: isAddingOfferToFolder,
        offerId: selectedOfferToAdd,
      })
    );
    setIsAddingOfferToFolder(null);
    setSelectedOfferToAdd("");

    showAlert({
      type: "success",
      message: "Offre ajoutée au dossier avec succès",
    });
  };

  const handleRemoveOfferFromFolder = (folderId, offerId) => {
    if (window.confirm("Retirer cette offre du dossier ?")) {
      dispatch(removeOfferFromFolder({ folderId, offerId }));

      showAlert({
        type: "success",
        message: "Offre retirée du dossier avec succès",
      });
    }
  };

  const toggleFolderExpand = (folderId) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  // Get job details by ID
  const getJobById = (jobId) => {
    return (
      jobs.find((job) => job._id === jobId || job.id === jobId) || {
        titre: "Offre inconnue",
        title: "Offre inconnue",
      }
    );
  };

  // Fonction pour obtenir les dossiers contenant une offre
  const getFoldersForJob = (jobId) => {
    return folders.filter((folder) => {
      // Vérifier si l'offre est dans le dossier, en tenant compte des deux formats d'ID possibles
      return folder.offres.some((offerId) => {
        // Vérification directe de l'ID
        if (offerId === jobId) return true;

        // Vérification en tenant compte des deux formats (id et _id)
        const job = jobs.find((j) => j._id === jobId || j.id === jobId);
        return job && (offerId === job.id || offerId === job._id);
      });
    });
  };

  if (error) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-800">Dossiers</h2>
        </div>
        <div className="bg-red-100 p-4 rounded-md mb-4">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => dispatch(clearFolderError())}
            className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      {/* Alerte de notification */}
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
                <CheckCircle className="h-5 w-5 mr-2" />
              ) : (
                <AlertCircle className="h-5 w-5 mr-2" />
              )}
              <span className="font-medium">{alert.message}</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Dossiers</h2>
        {!isCreatingFolder && !isEditingFolderId && (
          <button
            onClick={() => dispatch(setIsCreatingFolder(true))}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            <FolderPlus size={16} />
            Nouveau dossier
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {(isCreatingFolder || isEditingFolderId) && (
        <div className="mb-6 p-4 border border-gray-200 rounded-md">
          <h3 className="text-lg font-medium mb-4">
            {isCreatingFolder
              ? "Créer un nouveau dossier"
              : "Modifier le dossier"}
          </h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom du dossier *
            </label>
            <input
              type="text"
              value={newFolder.name}
              onChange={(e) => dispatch(setNewFolder({ name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Nom du dossier"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={newFolder.description}
              onChange={(e) =>
                dispatch(setNewFolder({ description: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Description du dossier"
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={
                isCreatingFolder ? handleCreateFolder : handleUpdateFolder
              }
              disabled={loading}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
            >
              <Save size={16} />
              {loading ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              onClick={() => {
                dispatch(setIsCreatingFolder(false));
                dispatch(setIsEditingFolder(null));
              }}
              className="flex items-center gap-2 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              <X size={16} />
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Folders List */}
      {folders.length === 0 && !loading ? (
        <div className="text-center py-8 text-gray-500">
          Aucun dossier trouvé. Créez votre premier dossier pour organiser vos
          offres d'emploi.
        </div>
      ) : (
        <div className="space-y-4">
          {folders.map((folder) => (
            <div
              key={folder._id}
              className={`border border-gray-200 rounded-md overflow-hidden ${
                selectedFolderId === folder._id
                  ? "border-blue-500 bg-blue-50"
                  : ""
              }`}
            >
              <div
                className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                onClick={() => {
                  dispatch(setSelectedFolder(folder._id));
                  toggleFolderExpand(folder._id);
                }}
              >
                <div className="flex items-center gap-3">
                  {expandedFolders[folder._id] ? (
                    <ChevronDown size={18} className="text-gray-500" />
                  ) : (
                    <ChevronRight size={18} className="text-gray-500" />
                  )}
                  {expandedFolders[folder._id] ? (
                    <FolderOpen size={20} className="text-yellow-500" />
                  ) : (
                    <Folder size={20} className="text-yellow-500" />
                  )}
                  <div>
                    <h3 className="font-medium text-gray-800">{folder.name}</h3>
                    {folder.description && (
                      <p className="text-sm text-gray-500 mt-1">
                        {folder.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {folder.offres.length} offre(s)
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsAddingOfferToFolder(folder._id);
                    }}
                    className="p-1 rounded hover:bg-gray-200"
                    title="Ajouter une offre"
                  >
                    <Plus size={18} className="text-blue-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch(setIsEditingFolder(folder._id));
                    }}
                    className="p-1 rounded hover:bg-gray-200"
                    title="Modifier"
                  >
                    <Edit size={18} className="text-gray-600" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFolder(folder._id);
                    }}
                    className="p-1 rounded hover:bg-gray-200"
                    title="Supprimer"
                  >
                    <Trash2 size={18} className="text-red-600" />
                  </button>
                </div>
              </div>

              {/* Add offer form */}
              {isAddingOfferToFolder === folder._id && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  <h4 className="text-sm font-medium mb-2">
                    Ajouter une offre
                  </h4>
                  <div className="flex gap-2">
                    <select
                      value={selectedOfferToAdd}
                      onChange={(e) => setSelectedOfferToAdd(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Sélectionner une offre</option>
                      {jobs
                        .filter(
                          (job) =>
                            !folder.offres.includes(job._id) &&
                            !folder.offres.includes(job.id)
                        )
                        .map((job) => (
                          <option
                            key={job._id || job.id}
                            value={job._id || job.id}
                          >
                            {job.titre || job.title}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={handleAddOfferToFolder}
                      className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                      Ajouter
                    </button>
                    <button
                      onClick={() => setIsAddingOfferToFolder(null)}
                      className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {/* Folder contents */}
              {expandedFolders[folder._id] && (
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                  {folder.offres.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      Aucune offre dans ce dossier
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {folder.offres.map((offerId) => {
                        const job = getJobById(offerId);
                        return (
                          <li
                            key={offerId}
                            className="flex justify-between items-center p-2 bg-white rounded border border-gray-200"
                          >
                            <div className="flex items-center gap-2">
                              <Briefcase size={16} className="text-blue-600" />
                              <span>{job.titre || job.title}</span>
                            </div>
                            <button
                              onClick={() =>
                                handleRemoveOfferFromFolder(folder._id, offerId)
                              }
                              className="p-1 rounded hover:bg-gray-200"
                              title="Retirer"
                            >
                              <X size={16} className="text-red-600" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};

export default FoldersSection;
