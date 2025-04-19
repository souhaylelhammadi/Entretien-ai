// src/components/ProfileSection.jsx
import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import logoutUser, { logout  } from "../../store/auth/authSlice"; // Import both logout actions
import { updateProfileAsync } from "../../store/recruteur/profileSlice";

const ProfileSection = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { profile, loading, error } = useSelector((state) => state.profile);
  const { user, authError } = useSelector((state) => state.auth); // Added authError

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: profile?.firstName || user?.firstName || "Admin",
    lastName: profile?.lastName || user?.lastName || "",
    email: profile?.email || user?.email || "admin@recrutement.ai",
  });

  // Handle logout
  const handleLogout = async () => {
    try {
      await dispatch(logoutUser()).unwrap();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
      // Fallback to client-side logout
      dispatch(logout());
      navigate("/login");
    }
  };

  // Handle edit toggle
  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    if (isEditing) {
      setFormData({
        firstName: profile?.firstName || user?.firstName || "Admin",
        lastName: profile?.lastName || user?.lastName || "",
        email: profile?.email || user?.email || "admin@recrutement.ai",
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
        Profil Utilisateur
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
          <div className="flex items-center space-x-4 border-b border-gray-100 pb-4">
            <div className="p-2 bg-blue-50 rounded-full">
              <User className="w-10 h-10 text-blue-600" />
            </div>
            <div>
              {isEditing ? (
                <>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    className="text-lg font-semibold text-gray-800 border rounded px-2 py-1 mb-2 w-full"
                  />
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    className="text-lg font-semibold text-gray-800 border rounded px-2 py-1 w-full"
                  />
                </>
              ) : (
                <p className="text-lg font-semibold text-gray-800">
                  {formData.firstName} {formData.lastName}
                </p>
              )}
              {isEditing ? (
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="text-sm text-gray-500 border rounded px-2 py-1 w-full"
                />
              ) : (
                <p className="text-sm text-gray-500">{formData.email}</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-md font-medium text-gray-700 mb-2">
                Informations
              </h3>
              <div className="space-y-2 text-sm">
                <p className="text-gray-600">
                  <span className="font-medium">Rôle:</span>{" "}
                  {profile?.role || user?.role || "Administrateur"}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Date d'inscription:</span>{" "}
                  {profile?.createdAt || user?.createdAt || "01/04/2025"}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Dernière connexion:</span>{" "}
                  {profile?.lastLogin || new Date().toLocaleDateString()}
                </p>
              </div>
            </div>

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
        </div>
      )}
    </div>
  );
};

export default ProfileSection;
