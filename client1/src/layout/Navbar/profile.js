import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { updateUser, logoutUser } from "../../pages/store/auth/authSlice";
import { toast } from "react-toastify";
import {
  Camera,
  Edit,
  LogOut,
  Save,
  X,
  User,
  Mail,
  Shield,
  ChevronLeft,
  FileImage,
} from "lucide-react";

const Profile = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, user, loading } = useSelector((state) => state.auth);
  const fileInputRef = useRef(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // State for edit mode and form data
  const [isEditing, setIsEditing] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(user?.photoUrl || null);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    photoUrl: user?.photoUrl || "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [activeSection, setActiveSection] = useState("profile");

  // Update formData when user changes
  useEffect(() => {
    setFormData({
      firstName: user?.firstName || "",
      lastName: user?.lastName || "",
      email: user?.email || "",
      photoUrl: user?.photoUrl || "",
    });
    setProfilePhoto(user?.photoUrl || null);
  }, [user]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    if (!formData.firstName.trim()) {
      errors.firstName = "Le prénom est requis";
    }
    if (!formData.lastName.trim()) {
      errors.lastName = "Le nom est requis";
    }
    if (!formData.email.trim()) {
      errors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "L'email est invalide";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle photo upload
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validImageTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!validImageTypes.includes(file.type)) {
      toast.error(
        "Veuillez sélectionner une image valide (JPEG, PNG, GIF ou WEBP)"
      );
      return;
    }

    setIsUploadingPhoto(true);

    // Simulating upload to server
    const reader = new FileReader();
    reader.onload = (event) => {
      const imageUrl = event.target.result;
      setProfilePhoto(imageUrl);
      setFormData((prev) => ({ ...prev, photoUrl: imageUrl }));
      setIsUploadingPhoto(false);
      toast.success("Photo téléchargée avec succès");
    };
    reader.onerror = () => {
      setIsUploadingPhoto(false);
      toast.error("Erreur lors du téléchargement de la photo");
    };
    reader.readAsDataURL(file);
  };

  // Handle Google photo import
  const handleGooglePhotoImport = () => {
    // This would typically use the Google Photos API
    // For this example, we'll simulate the import process
    setIsUploadingPhoto(true);

    // Simulate API call delay
    setTimeout(() => {
      const mockGooglePhotoUrl = "/api/placeholder/400/400"; // Using placeholder for demo
      setProfilePhoto(mockGooglePhotoUrl);
      setFormData((prev) => ({ ...prev, photoUrl: mockGooglePhotoUrl }));
      setIsUploadingPhoto(false);
      toast.success("Photo importée depuis Google avec succès");
    }, 1500);
  };

  // Remove photo
  const handleRemovePhoto = () => {
    setProfilePhoto(null);
    setFormData((prev) => ({ ...prev, photoUrl: "" }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error("Veuillez corriger les erreurs dans le formulaire");
      return;
    }

    try {
      const result = await dispatch(
        updateUser({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          photoUrl: formData.photoUrl,
        })
      );
      if (updateUser.fulfilled.match(result)) {
        toast.success("Profil mis à jour avec succès");
        setIsEditing(false);
      } else {
        toast.error(result.payload || "Échec de la mise à jour du profil");
      }
    } catch (err) {
      toast.error("Erreur lors de la mise à jour du profil");
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      const result = await dispatch(logoutUser());
      if (logoutUser.fulfilled.match(result)) {
        toast.success("Déconnexion réussie");
        navigate("/");
      } else {
        toast.error(result.payload || "Échec de la déconnexion");
      }
    } catch (err) {
      toast.error("Erreur lors de la déconnexion");
    }
  };

  // Toggle edit mode
  const toggleEdit = () => {
    setIsEditing(!isEditing);
    setFormErrors({});
    if (isEditing) {
      setFormData({
        firstName: user?.firstName || "",
        lastName: user?.lastName || "",
        email: user?.email || "",
        photoUrl: user?.photoUrl || "",
      });
      setProfilePhoto(user?.photoUrl || null);
    }
  };

  // Trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  // Navigation back
  const handleBack = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="md:flex md:space-x-8">
          {/* Sidebar */}
          <div className="md:w-1/4">
            <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
              <div className="p-6 flex flex-col items-center">
                <div className="relative mb-4">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt="Profile"
                      className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-r from-blue-400 to-teal-500 flex items-center justify-center text-white text-3xl font-medium border-4 border-white shadow-lg">
                      {user?.firstName?.charAt(0) || ""}
                      {user?.lastName?.charAt(0) || ""}
                    </div>
                  )}

                  {isEditing && (
                    <div className="absolute bottom-0 right-0">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoChange}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        onClick={triggerFileInput}
                        className="bg-teal-500 text-white rounded-full p-2 shadow-md hover:bg-teal-600 transition-all"
                        disabled={isUploadingPhoto}
                      >
                        <Camera size={20} />
                      </button>
                    </div>
                  )}
                </div>

                <h2 className="text-xl font-bold text-gray-800">
                  {user?.firstName} {user?.lastName}
                </h2>
                <p className="text-gray-500 mt-1">{user?.email}</p>
                <p className="text-sm font-medium text-teal-600 mt-2 capitalize">
                  {user?.role || "Utilisateur"}
                </p>

                {isEditing && (
                  <div className="mt-4 flex flex-col space-y-2 w-full">
                    <button
                      onClick={handleGooglePhotoImport}
                      disabled={isUploadingPhoto}
                      className="w-full px-3 py-2 text-sm font-medium bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <FileImage size={16} />
                      <span>Importer depuis Google</span>
                    </button>
                    {profilePhoto && (
                      <button
                        onClick={handleRemovePhoto}
                        className="w-full px-3 py-2 text-sm font-medium bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-all duration-200 flex items-center justify-center gap-2"
                      >
                        <X size={16} />
                        <span>Supprimer la photo</span>
                      </button>
                    )}
                  </div>
                )}

                {isUploadingPhoto && (
                  <p className="mt-2 text-sm text-blue-600">
                    Chargement en cours...
                  </p>
                )}
              </div>

              <div className="border-t border-gray-200">
                <ul className="divide-y divide-gray-200">
                  <li>
                    <button
                      onClick={() => setActiveSection("profile")}
                      className={`w-full px-6 py-4 flex items-center text-left ${
                        activeSection === "profile"
                          ? "bg-teal-50 text-teal-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <User size={18} className="mr-3" />
                      <span>Informations personnelles</span>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveSection("security")}
                      className={`w-full px-6 py-4 flex items-center text-left ${
                        activeSection === "security"
                          ? "bg-teal-50 text-teal-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Shield size={18} className="mr-3" />
                      <span>Sécurité</span>
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveSection("notifications")}
                      className={`w-full px-6 py-4 flex items-center text-left ${
                        activeSection === "notifications"
                          ? "bg-teal-50 text-teal-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <Mail size={18} className="mr-3" />
                      <span>Notifications</span>
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="md:w-3/4">
            <div className="bg-white rounded-lg shadow-md">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">
                  {activeSection === "profile" && "Informations personnelles"}
                  {activeSection === "security" && "Paramètres de sécurité"}
                  {activeSection === "notifications" &&
                    "Préférences de notifications"}
                </h2>
                {!isEditing && activeSection === "profile" && (
                  <button
                    onClick={toggleEdit}
                    className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 transition-all duration-200 flex items-center gap-2"
                  >
                    <Edit size={16} />
                    <span>Modifier</span>
                  </button>
                )}
              </div>

              <div className="p-6">
                {activeSection === "profile" &&
                  (isEditing ? (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <label
                            htmlFor="firstName"
                            className="block mb-2 text-sm font-medium text-gray-700"
                          >
                            Prénom
                          </label>
                          <input
                            type="text"
                            name="firstName"
                            id="firstName"
                            value={formData.firstName}
                            onChange={handleInputChange}
                            className={`w-full p-3 border rounded-lg text-base ${
                              formErrors.firstName
                                ? "border-red-400"
                                : "border-gray-300"
                            } focus:ring-teal-500 focus:border-teal-500 bg-white transition-all duration-200`}
                            placeholder="Jean"
                          />
                          {formErrors.firstName && (
                            <p className="mt-2 text-sm text-red-500">
                              {formErrors.firstName}
                            </p>
                          )}
                        </div>
                        <div>
                          <label
                            htmlFor="lastName"
                            className="block mb-2 text-sm font-medium text-gray-700"
                          >
                            Nom
                          </label>
                          <input
                            type="text"
                            name="lastName"
                            id="lastName"
                            value={formData.lastName}
                            onChange={handleInputChange}
                            className={`w-full p-3 border rounded-lg text-base ${
                              formErrors.lastName
                                ? "border-red-400"
                                : "border-gray-300"
                            } focus:ring-teal-500 focus:border-teal-500 bg-white transition-all duration-200`}
                            placeholder="Dupont"
                          />
                          {formErrors.lastName && (
                            <p className="mt-2 text-sm text-red-500">
                              {formErrors.lastName}
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="email"
                          className="block mb-2 text-sm font-medium text-gray-700"
                        >
                          Email
                        </label>
                        <input
                          type="email"
                          name="email"
                          id="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className={`w-full p-3 border rounded-lg text-base ${
                            formErrors.email
                              ? "border-red-400"
                              : "border-gray-300"
                          } focus:ring-teal-500 focus:border-teal-500 bg-white transition-all duration-200`}
                          placeholder="jean.dupont@exemple.com"
                        />
                        {formErrors.email && (
                          <p className="mt-2 text-sm text-red-500">
                            {formErrors.email}
                          </p>
                        )}
                      </div>

                      <div className="flex justify-end space-x-3 pt-4">
                        <button
                          type="button"
                          onClick={toggleEdit}
                          className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-all duration-200 flex items-center gap-2"
                        >
                          <X size={16} />
                          <span>Annuler</span>
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className={`px-5 py-2.5 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 transition-all duration-200 flex items-center gap-2 ${
                            loading ? "opacity-70 cursor-not-allowed" : ""
                          }`}
                        >
                          <Save size={16} />
                          <span>
                            {loading ? "Enregistrement..." : "Enregistrer"}
                          </span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-8">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">
                            Prénom
                          </h3>
                          <p className="text-base text-gray-900">
                            {user?.firstName || "-"}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">
                            Nom
                          </h3>
                          <p className="text-base text-gray-900">
                            {user?.lastName || "-"}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">
                            Email
                          </h3>
                          <p className="text-base text-gray-900">
                            {user?.email || "-"}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">
                            Rôle
                          </h3>
                          <p className="text-base text-gray-900 capitalize">
                            {user?.role || "-"}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">
                            Membre depuis
                          </h3>
                          <p className="text-base text-gray-900">
                            {user?.createdAt
                              ? new Date(user.createdAt).toLocaleDateString(
                                  "fr-FR",
                                  {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                  }
                                )
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">
                            Dernière connexion
                          </h3>
                          <p className="text-base text-gray-900">
                            {user?.lastLogin
                              ? new Date(user.lastLogin).toLocaleDateString(
                                  "fr-FR",
                                  {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )
                              : "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                {activeSection === "security" && (
                  <div className="space-y-6">
                    <div className="border-b border-gray-200 pb-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Mot de passe
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Vous pouvez mettre à jour votre mot de passe à tout
                        moment pour garantir la sécurité de votre compte.
                      </p>
                      <button className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 transition-all duration-200">
                        Changer le mot de passe
                      </button>
                    </div>

                    <div className="border-b border-gray-200 pb-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Authentification à deux facteurs
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Ajoutez une couche de sécurité supplémentaire à votre
                        compte en activant l'authentification à deux facteurs.
                      </p>
                      <button className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-all duration-200">
                        Configurer l'authentification à deux facteurs
                      </button>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Sessions actives
                      </h3>
                      <p className="text-gray-600 mb-4">
                        Consultez et gérez vos sessions actives sur différents
                        appareils.
                      </p>
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-gray-800">
                              Cet appareil
                            </p>
                            <p className="text-sm text-gray-500">
                              Dernière activité : Aujourd'hui
                            </p>
                          </div>
                          <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                            Actif
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === "notifications" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Emails de notification
                        </h3>
                        <p className="text-sm text-gray-500">
                          Recevez des emails concernant votre activité
                        </p>
                      </div>
                      <div className="flex items-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            value=""
                            className="sr-only peer"
                            defaultChecked
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Nouveautés et mises à jour
                        </h3>
                        <p className="text-sm text-gray-500">
                          Soyez informé des nouvelles fonctionnalités
                        </p>
                      </div>
                      <div className="flex items-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            value=""
                            className="sr-only peer"
                            defaultChecked
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-gray-900">Rappels</h3>
                        <p className="text-sm text-gray-500">
                          Recevez des rappels sur les actions importantes
                        </p>
                      </div>
                      <div className="flex items-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            value=""
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                        </label>
                      </div>
                    </div>

                    <div className="pt-4">
                      <button className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 transition-all duration-200">
                        Enregistrer les préférences
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
