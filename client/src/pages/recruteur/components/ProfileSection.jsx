import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  User,
  Building,
  Linkedin,
  Phone,
  Briefcase,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { logoutUser } from "../../store/auth/authSlice";
import { updateProfileAsync } from "../../store/recruteur/profileSlice";

const ProfileSection = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { profile, loading, error } = useSelector((state) => state.profile);
  const { user, authError } = useSelector((state) => state.auth);

  const [isEditing, setIsEditing] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [formData, setFormData] = useState({
    nom: "",
    email: "admin@recrutement.ai",
    phone: "",
    position: "",
    department: "",
    bio: "",
    linkedin: "",
    entreprise: "",
    secteur_activite: "",
    description_entreprise: "",
    taille_entreprise: "",
  });

  // Update form data if profile or user changes
  useEffect(() => {
    if (profile || user) {
      setFormData({
        nom: profile?.nom || user?.nom || "",
        email: profile?.email || user?.email || "admin@recrutement.ai",
        phone: profile?.phone || "",
        position: profile?.position || "",
        department: profile?.department || "",
        bio: profile?.bio || "",
        linkedin: profile?.linkedin || "",
        entreprise: profile?.entreprise || "",
        secteur_activite: profile?.secteur_activite || "",
        description_entreprise: profile?.description_entreprise || "",
        taille_entreprise: profile?.taille_entreprise || "",
      });
    }
  }, [profile, user]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      localStorage.removeItem("userId");
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Handle edit toggle
  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    if (isEditing) {
      setFormData({
        nom: profile?.nom || user?.nom || "",
        email: profile?.email || user?.email || "admin@recrutement.ai",
        phone: profile?.phone || "",
        position: profile?.position || "",
        department: profile?.department || "",
        bio: profile?.bio || "",
        linkedin: profile?.linkedin || "",
        entreprise: profile?.entreprise || "",
        secteur_activite: profile?.secteur_activite || "",
        description_entreprise: profile?.description_entreprise || "",
        taille_entreprise: profile?.taille_entreprise || "",
      });
    }
  };

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle profile update
  const handleSave = async () => {
    try {
      console.log("Saving profile data:", formData);

      // Vérification des champs obligatoires pour un recruteur
      if (user.role === "recruteur") {
        const requiredFields = {
          entreprise: "Nom de l'entreprise",
          secteur_activite: "Secteur d'activité",
          description_entreprise: "Description de l'entreprise",
          taille_entreprise: "Taille de l'entreprise",
        };

        const missingFields = Object.entries(requiredFields)
          .filter(([field]) => !formData[field]?.trim())
          .map(([_, label]) => label);

        if (missingFields.length > 0) {
          setAlert({
            show: true,
            type: "error",
            message: `Champs obligatoires manquants :\n• ${missingFields.join("\n• ")}`,
          });
          return;
        }
      }

      const response = await dispatch(updateProfileAsync(formData)).unwrap();
      console.log("Profile update response:", response);

      setAlert({
        show: true,
        type: "success",
        message: "Profil mis à jour avec succès",
      });

      setIsEditing(false);
    } catch (err) {
      console.error("Update error:", err);
      setAlert({
        show: true,
        type: "error",
        message: err.message || "Erreur lors de la mise à jour du profil",
      });
    }
  };

  // Clear alert after 5 seconds
  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => {
        setAlert({ show: false, type: "", message: "" });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [alert.show]);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm">
      {alert.show && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center space-x-3 ${
            alert.type === "success"
              ? "bg-green-100 text-green-800 border border-green-200"
              : "bg-red-100 text-red-800 border border-red-200"
          }`}
        >
          {alert.type === "success" ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <AlertCircle className="h-5 w-5" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium whitespace-pre-line">
              {alert.message}
            </p>
          </div>
          <button
            onClick={() => setAlert({ show: false, type: "", message: "" })}
            className="p-1 hover:bg-opacity-20 rounded-full"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <h2 className="text-2xl font-bold text-gray-900 mb-6">Profil Recruteur</h2>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500"></div>
        </div>
      ) : error || authError ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">
          Erreur: {error || authError}
          {error?.includes("Session expirée") && (
            <button
              onClick={handleLogout}
              className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Se reconnecter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Profile Header */}
          <div className="flex items-center space-x-4 border-b border-gray-100 pb-4">
            <div className="p-2 bg-blue-50 rounded-full">
              <User className="w-10 h-10 text-blue-600" />
            </div>
            <div className="flex-1">
              {isEditing ? (
                <input
                  type="text"
                  name="nom"
                  value={formData.nom}
                  onChange={handleInputChange}
                  className="text-lg font-semibold text-gray-800 border rounded px-2 py-1 w-full"
                  placeholder="Nom"
                />
              ) : (
                <p className="text-lg font-semibold text-gray-800">
                  {formData.nom || "Non spécifié"}
                </p>
              )}
              <p className="text-sm text-gray-500">{formData.email}</p>
              {profile?.entreprise_name && (
                <div className="flex items-center mt-1 text-sm text-gray-500">
                  <Building className="w-4 h-4 mr-1 text-blue-500" />
                  {profile.entreprise_name}
                </div>
              )}
            </div>
          </div>

          {/* Professional Information */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h3 className="text-md font-medium text-gray-700 mb-3 flex items-center">
              <Briefcase className="w-5 h-5 mr-2 text-blue-600" />
              Informations Professionnelles
            </h3>

            <div className="space-y-4">
              {isEditing ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Nom de l'entreprise *
                      </label>
                      <input
                        type="text"
                        name="entreprise"
                        value={formData.entreprise}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Ex: Tech Corp"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Secteur d'activité *
                      </label>
                      <input
                        type="text"
                        name="secteur_activite"
                        value={formData.secteur_activite}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Ex: Informatique"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Description de l'entreprise *
                    </label>
                    <textarea
                      name="description_entreprise"
                      value={formData.description_entreprise}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      rows="3"
                      placeholder="Décrivez votre entreprise..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Taille de l'entreprise *
                    </label>
                    <select
                      name="taille_entreprise"
                      value={formData.taille_entreprise}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      required
                    >
                      <option value="">Sélectionnez une taille</option>
                      <option value="1-10">1-10 employés</option>
                      <option value="11-50">11-50 employés</option>
                      <option value="51-200">51-200 employés</option>
                      <option value="201-500">201-500 employés</option>
                      <option value="500+">Plus de 500 employés</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Poste
                      </label>
                      <input
                        type="text"
                        name="position"
                        value={formData.position}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Ex: Responsable RH"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Département
                      </label>
                      <input
                        type="text"
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Ex: Ressources Humaines"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {user.entreprise ? (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Entreprise</p>
                          <p className="text-sm font-medium text-gray-900">
                            {user.entreprise}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">
                            Secteur d'activité
                          </p>
                          <p className="text-sm font-medium text-gray-900">
                            {user.secteur_activite || "Non spécifié"}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Description</p>
                        <p className="text-sm font-medium text-gray-900">
                          {user.description_entreprise || "Non spécifiée"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Taille</p>
                        <p className="text-sm font-medium text-gray-900">
                          {user.taille_entreprise || "Non spécifiée"}
                        </p>
                      </div>
                      {user.position && (
                        <div>
                          <p className="text-sm text-gray-500">Poste</p>
                          <p className="text-sm font-medium text-gray-900">
                            {user.position}
                          </p>
                        </div>
                      )}
                      {user.department && (
                        <div>
                          <p className="text-sm text-gray-500">Département</p>
                          <p className="text-sm font-medium text-gray-900">
                            {user.department}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      Aucune information professionnelle fournie
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Biography */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h3 className="text-md font-medium text-gray-700 mb-3 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-blue-600" />
              Biographie
            </h3>

            {isEditing ? (
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows="4"
                placeholder="Parlez de vous et de votre expérience professionnelle..."
              />
            ) : (
              <div className="text-gray-700 text-sm">
                {formData.bio ? (
                  <p>{formData.bio}</p>
                ) : (
                  <p className="text-gray-500 italic">
                    Aucune biographie fournie
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Account Information */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h3 className="text-md font-medium text-gray-700 mb-3">
              Information du compte
            </h3>
            <div className="space-y-2 text-sm">
              <p className="text-gray-600">
                <span className="font-medium">Rôle:</span>{" "}
                {profile?.role || user?.role || "Recruteur"}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Date d'inscription:</span>{" "}
                {profile?.createdAt || user?.createdAt || "01/01/2023"}
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Dernière connexion:</span>{" "}
                {profile?.lastLogin || new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
                >
                  Enregistrer
                </button>
                <button
                  onClick={handleEditToggle}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors w-full sm:w-auto"
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleEditToggle}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors w-full sm:w-auto"
                >
                  Modifier le profil
                </button>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors w-full sm:w-auto"
                >
                  Déconnexion
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileSection;