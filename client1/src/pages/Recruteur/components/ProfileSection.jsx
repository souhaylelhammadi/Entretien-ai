// src/components/ProfileSection.jsx
import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  User,
  Building,
  Linkedin,
  Phone,
  Briefcase,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import logoutUser from "../../store/auth/authSlice";
import { updateProfileAsync } from "../../store/recruteur/profileSlice";

const ProfileSection = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { profile, loading, error } = useSelector((state) => state.profile);
  const { user, authError } = useSelector((state) => state.auth);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    
    nom: profile?.nom || user?.nom || "",
    email: profile?.email || user?.email || "admin@recrutement.ai",
    phone: profile?.phone || "",
    position: profile?.position || "",
    department: profile?.department || "",
    bio: profile?.bio || "",
    linkedin: profile?.linkedin || "",
  });

  // Update form data if profile changes
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
      });
    }
  }, [profile, user]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
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
      await dispatch(updateProfileAsync(formData)).unwrap();
      setIsEditing(false);
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Profil Recruteur
      </h2>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-500"></div>
        </div>
      ) : error || authError ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">
          Erreur: {error || authError}
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
                <>
                  
                  <input
                    type="text"
                    name="nom"
                    value={formData.nom}
                    onChange={handleInputChange}
                    className="text-lg font-semibold text-gray-800 border rounded px-2 py-1 w-full"
                    placeholder="Nom"
                  />
                </>
              ) : (
                <p className="text-lg font-semibold text-gray-800">
                  {formData.nom}
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
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="Ex: +33 6 12 34 56 78"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Profil LinkedIn
                    </label>
                    <input
                      type="url"
                      name="linkedin"
                      value={formData.linkedin}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      placeholder="https://www.linkedin.com/in/votre-profil"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  {(formData.position || formData.department) && (
                    <p className="text-gray-700 flex items-center">
                      <Briefcase className="w-4 h-4 mr-2 text-blue-500" />
                      {formData.position}
                      {formData.department && ` - ${formData.department}`}
                    </p>
                  )}

                  {formData.phone && (
                    <p className="text-gray-700 flex items-center">
                      <Phone className="w-4 h-4 mr-2 text-blue-500" />
                      {formData.phone}
                    </p>
                  )}

                  {formData.linkedin && (
                    <p className="text-gray-700 flex items-center">
                      <Linkedin className="w-4 h-4 mr-2 text-blue-500" />
                      <a
                        href={formData.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Profil LinkedIn
                      </a>
                    </p>
                  )}

                  {!formData.position &&
                    !formData.department &&
                    !formData.phone &&
                    !formData.linkedin && (
                      <p className="text-gray-500 italic">
                        Aucune information professionnelle fournie
                      </p>
                    )}
                </div>
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
