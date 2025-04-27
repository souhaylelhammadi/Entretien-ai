import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Middleware pour valider les actions Redux
export const validateActionMiddleware = () => (next) => (action) => {
  if (!action || !action.type) {
    console.warn("Action invalide détectée:", action);
    return;
  }
  console.log("Dispatch action:", action.type);
  return next(action);
};

// Fonction pour réessayer les requêtes en cas d'échec (timeout ou erreur réseau)
const retryRequest = async (fn, retries = 2, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1 || !err.code || err.code !== "ECONNABORTED") {
        throw err;
      }
      console.warn(`Tentative ${i + 1}/${retries} après ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Nettoyer le jeton (supprimer "Bearer " si présent)
const cleanToken = (token) => {
  if (!token) return null;
  return token.startsWith("Bearer ") ? token.substring(7) : token;
};

// Thunk pour la connexion
export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async ({ email, mot_de_passe }, { rejectWithValue }) => {
    try {
      if (!email || !mot_de_passe) {
        throw new Error("Email et mot de passe requis");
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw new Error("Format d'email invalide");
      }

      console.log("Tentative de connexion avec:", { email });
      const request = () =>
        axios.post(
          `${API_URL}/api/auth/login`,
          { email, mot_de_passe },
          { timeout: 10000 }
        );

      const response = await retryRequest(request);
      console.log("Réponse de connexion:", response.data);

      const token = cleanToken(response.data.token);
      if (!token || token.split(".").length !== 3) {
        throw new Error("Jeton reçu invalide");
      }
      console.log(
        "Jeton reçu (premiers caractères):",
        token.substring(0, 10) + "..."
      );

      localStorage.setItem("token", token);
      console.log("Jeton stocké dans localStorage:", token);

      return {
        ...response.data,
        token: token,
      };
    } catch (err) {
      console.error("Erreur de connexion:", err.message, err.response?.data);
      const message =
        err.response?.data?.message ||
        (err.code === "ECONNABORTED"
          ? "Délai d'attente dépassé. Vérifiez votre connexion."
          : err.message === "Network Error"
          ? "Erreur réseau. Vérifiez que le serveur est accessible."
          : err.message || "Échec de la connexion");
      return rejectWithValue(message);
    }
  }
);

// Thunk pour l'inscription
export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async (userData, { rejectWithValue }) => {
    try {
      const requiredFields = [
        "nom",
        "email",
        "mot_de_passe",
        "telephone",
        "role",
      ];
      if (!requiredFields.every((field) => userData[field])) {
        throw new Error("Tous les champs obligatoires doivent être remplis");
      }
      if (!/^\S+@\S+\.\S+$/.test(userData.email)) {
        throw new Error("Format d'email invalide");
      }
      if (userData.mot_de_passe.length < 8) {
        throw new Error("Le mot de passe doit contenir au moins 8 caractères");
      }
      if (
        !/[A-Z]/.test(userData.mot_de_passe) ||
        !/[0-9]/.test(userData.mot_de_passe)
      ) {
        throw new Error(
          "Le mot de passe doit inclure une majuscule et un chiffre"
        );
      }
      if (!["candidat", "recruteur"].includes(userData.role)) {
        throw new Error("Rôle invalide. Doit être 'candidat' ou 'recruteur'");
      }
      if (userData.role === "recruteur" && !userData.entreprise_id) {
        throw new Error("L'ID de l'entreprise est requis pour les recruteurs");
      }
      if (!userData.acceptTerms) {
        throw new Error("Vous devez accepter les conditions");
      }

      console.log("Tentative d'inscription avec:", userData);
      const request = () =>
        axios.post(`${API_URL}/api/auth/register`, userData, {
          timeout: 10000,
        });

      const response = await retryRequest(request);
      console.log("Réponse d'inscription:", response.data);

      const token = cleanToken(response.data.token);
      if (!token || token.split(".").length !== 3) {
        throw new Error("Jeton reçu invalide");
      }

      localStorage.setItem("token", token);
      return response.data;
    } catch (err) {
      console.error("Erreur d'inscription:", err.message, err.response?.data);
      const message =
        err.response?.data?.message ||
        (err.code === "ECONNABORTED"
          ? "Délai d'attente dépassé. Vérifiez votre connexion."
          : err.message === "Network Error"
          ? "Erreur réseau. Vérifiez que le serveur est accessible."
          : err.message || "Échec de l'inscription");
      return rejectWithValue(message);
    }
  }
);

// Thunk pour la mise à jour du profil utilisateur
export const updateUser = createAsyncThunk(
  "auth/updateUser",
  async (userData, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const token = auth.token;
      if (!token) {
        throw new Error("Aucun jeton trouvé");
      }
      if (token.split(".").length !== 3) {
        localStorage.removeItem("token");
        throw new Error("Jeton malformé");
      }

      if (!userData.nom || !userData.email || !userData.telephone) {
        throw new Error("Tous les champs sont requis");
      }
      if (!/^\S+@\S+\.\S+$/.test(userData.email)) {
        throw new Error("Format d'email invalide");
      }

      console.log("Tentative de mise à jour de l'utilisateur avec:", userData);
      const request = () =>
        axios.put(`${API_URL}/api/auth/update`, userData, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        });

      const response = await retryRequest(request);
      console.log("Réponse de mise à jour:", response.data);

      return response.data.user;
    } catch (err) {
      console.error("Erreur de mise à jour:", err.message, err.response?.data);
      const message =
        err.response?.data?.message ||
        (err.code === "ECONNABORTED"
          ? "Délai d'attente dépassé. Vérifiez votre connexion."
          : err.message === "Network Error"
          ? "Erreur réseau. Vérifiez que le serveur est accessible."
          : err.message || "Échec de la mise à jour du profil");
      return rejectWithValue(message);
    }
  }
);

// Thunk pour vérifier l'état d'authentification
export const checkAuthStatus = createAsyncThunk(
  "auth/checkAuthStatus",
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Aucun jeton trouvé");
      }
      if (token.split(".").length !== 3) {
        localStorage.removeItem("token");
        throw new Error("Jeton malformé");
      }

      console.log(
        "Vérification du jeton (premiers caractères):",
        token.substring(0, 10) + "..."
      );

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      const response = await retryRequest(() =>
        axios.get(`${API_URL}/api/auth/me`, config)
      );
      console.log("Réponse de vérification d'authentification:", response.data);

      return {
        ...response.data,
        token: token,
      };
    } catch (err) {
      console.error(
        "Erreur de vérification d'authentification:",
        err.message,
        err.response?.data
      );

      if (err.response?.status === 401 || err.message === "Jeton malformé") {
        console.log(
          "Suppression du jeton en raison d'échec d'authentification"
        );
        localStorage.removeItem("token");
      }

      const message =
        err.response?.data?.message ||
        err.message ||
        "Échec de la vérification de l'authentification";
      return rejectWithValue(message);
    }
  }
);

// Thunk pour la déconnexion
export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const token = auth.token;
      if (!token) {
        throw new Error("Aucun jeton trouvé");
      }
      if (token.split(".").length !== 3) {
        localStorage.removeItem("token");
        throw new Error("Jeton malformé");
      }

      console.log("Tentative de déconnexion");
      const request = () =>
        axios.post(
          `${API_URL}/api/auth/logout`,
          {},
          {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
          }
        );

      const response = await retryRequest(request);
      console.log("Réponse de déconnexion:", response.data);

      localStorage.removeItem("token");
      return response.data;
    } catch (err) {
      console.error("Erreur de déconnexion:", err.message, err.response?.data);
      localStorage.removeItem("token");
      const message =
        err.response?.data?.message ||
        (err.code === "ECONNABORTED"
          ? "Délai d'attente dépassé. Vérifiez votre connexion."
          : err.message === "Network Error"
          ? "Erreur réseau. Vérifiez que le serveur est accessible."
          : err.message || "Échec de la déconnexion");
      return rejectWithValue(message);
    }
  }
);

// Création du slice Redux
const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    token: null,
    isAuthenticated: false,
    role: "candidat",
    email: "",
    mot_de_passe: "",
    confirmMotDePasse: "",
    nom: "",
    telephone: "",
    nomEntreprise: "",
    acceptTerms: false,
    loading: false,
    authError: "",
  },
  reducers: {
    setEmail: (state, action) => {
      state.email = action.payload;
    },
    setMotDePasse: (state, action) => {
      state.mot_de_passe = action.payload;
    },
    setConfirmMotDePasse: (state, action) => {
      state.confirmMotDePasse = action.payload;
    },
    setNom: (state, action) => {
      state.nom = action.payload;
    },
    setTelephone: (state, action) => {
      state.telephone = action.payload;
    },
    setNomEntreprise: (state, action) => {
      state.nomEntreprise = action.payload;
    },
    setRole: (state, action) => {
      const validRoles = ["candidat", "recruteur"];
      if (!validRoles.includes(action.payload)) {
        console.warn(
          "Tentative de définition d'un rôle invalide:",
          action.payload
        );
        state.authError = "Rôle invalide. Doit être 'candidat' ou 'recruteur'";
      } else {
        state.role = action.payload;
        state.authError = "";
      }
    },
    setAcceptTerms: (state, action) => {
      state.acceptTerms = action.payload;
    },
    clearForm: (state) => {
      state.email = "";
      state.mot_de_passe = "";
      state.confirmMotDePasse = "";
      state.nom = "";
      state.telephone = "";
      state.nomEntreprise = "";
      state.acceptTerms = false;
      state.authError = "";
    },
    resetAuthState: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.role = "candidat";
      state.email = "";
      state.mot_de_passe = "";
      state.confirmMotDePasse = "";
      state.nom = "";
      state.telephone = "";
      state.nomEntreprise = "";
      state.acceptTerms = false;
      state.authError = "";
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Connexion
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.authError = "";
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.authError = "";
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.authError = action.payload;
      })
      // Inscription
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.authError = "";
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.authError = "";
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.authError = action.payload;
      })
      // Mise à jour du profil
      .addCase(updateUser.pending, (state) => {
        state.loading = true;
        state.authError = "";
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
        state.authError = "";
      })
      .addCase(updateUser.rejected, (state, action) => {
        state.loading = false;
        state.authError = action.payload;
      })
      // Vérification de l'état d'authentification
      .addCase(checkAuthStatus.pending, (state) => {
        state.loading = true;
        state.authError = "";
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
        state.authError = "";
      })
      .addCase(checkAuthStatus.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.authError = action.payload;
      })
      // Déconnexion
      .addCase(logoutUser.pending, (state) => {
        state.loading = true;
        state.authError = "";
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.authError = "";
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.authError = action.payload;
      })
      // Gestion des cas par défaut pour éviter les erreurs silencieuses
      .addDefaultCase((state, action) => {
        if (!action || !action.type) {
          console.warn("Action invalide reçue:", action);
        }
      });
  },
});

// Export des actions
export const {
  setEmail,
  setMotDePasse,
  setConfirmMotDePasse,
  setNom,
  setTelephone,
  setNomEntreprise,
  setRole,
  setAcceptTerms,
  clearForm,
  resetAuthState,
} = authSlice.actions;

// Export du réducteur
export default authSlice.reducer;
