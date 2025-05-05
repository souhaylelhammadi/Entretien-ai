import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import {
  cleanToken,
  getCleanToken,
  removeToken,
} from "../../../utils/tokenUtils";

const API_URL = "http://localhost:5000/api/auth";

// Middleware pour valider les actions Redux
export const validateActionMiddleware = () => (next) => (action) => {
  if (!action || !action.type) {
    console.warn("Action invalide détectée:", action);
    return;
  }
  return next(action);
};

// Thunk pour la connexion
export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_URL}/login`, {
        email: credentials.email,
        mot_de_passe: credentials.mot_de_passe,
      });

      const { token, user } = response.data;
      localStorage.setItem("token", `Bearer ${token}`);
      localStorage.setItem("user", JSON.stringify(user));

      return {
        token: {
          value: `Bearer ${token}`,
          role: user.role,
          email: user.email,
        },
        user,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Erreur lors de la connexion"
      );
    }
  }
);

// Thunk pour l'inscription
export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async (userData, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_URL}/register`, {
        email: userData.email,
        mot_de_passe: userData.mot_de_passe,
        nom: userData.nom,
        telephone: userData.telephone,
        role: userData.role,
        ...(userData.role === "recruteur" && {
          nomEntreprise: userData.nomEntreprise,
        }),
      });

      const { token, user } = response.data;
      localStorage.setItem("token", `Bearer ${token}`);
      localStorage.setItem("user", JSON.stringify(user));

      return {
        token: {
          value: `Bearer ${token}`,
          role: user.role,
          email: user.email,
        },
        user,
      };
    } catch (error) {
      return rejectWithValue(
        error.response?.data?.message || "Erreur lors de l'inscription"
      );
    }
  }
);

// Thunk pour la mise à jour du profil utilisateur
export const updateUser = createAsyncThunk(
  "auth/updateUser",
  async (userData, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      let token = auth.token?.value;

      // Nettoyer et valider le token
      token = cleanToken(token);
      if (!token) {
        throw new Error("Aucun jeton valide trouvé");
      }

      if (!userData.nom || !userData.email || !userData.telephone) {
        throw new Error("Tous les champs sont requis");
      }
      if (!/^\S+@\S+\.\S+$/.test(userData.email)) {
        throw new Error("Format d'email invalide");
      }

      const response = await axios.put(`${API_URL}/update`, userData, {
        headers: { Authorization: token },
        timeout: 10000,
      });

      return response.data.user;
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        "Échec de la mise à jour du profil";
      return rejectWithValue(message);
    }
  }
);

// Thunk pour vérifier l'état d'authentification
export const checkAuthStatus = createAsyncThunk(
  "auth/checkAuthStatus",
  async (_, { rejectWithValue }) => {
    try {
      // Utiliser getCleanToken qui gère automatiquement le nettoyage et la mise à jour du localStorage
      const token = getCleanToken();
      if (!token) {
        return null;
      }

      const response = await axios.get(`${API_URL}/me`, {
        headers: { Authorization: token },
      });

      const user = response.data.user;
      return {
        user,
        token: {
          value: token,
          role: user.role,
          email: user.email,
        },
      };
    } catch (error) {
      if (
        error.response &&
        (error.response.status === 401 || error.response.status === 403)
      ) {
        // Si le token est expiré ou invalide, nettoyer le local storage
        removeToken();
      }

      return rejectWithValue(
        error.response?.data?.message || "Erreur lors de la vérification"
      );
    }
  }
);

// Thunk pour la déconnexion
export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { rejectWithValue }) => {
    try {
      const token = getCleanToken();
      if (!token) {
        throw new Error("Aucun jeton trouvé");
      }

      await axios.post(
        `${API_URL}/logout`,
        {},
        {
          headers: { Authorization: token },
          timeout: 10000,
        }
      );

      removeToken();
      return { message: "Déconnexion réussie" };
    } catch (error) {
      removeToken();
      const message =
        error.response?.data?.message ||
        error.message ||
        "Échec de la déconnexion";
      return rejectWithValue(message);
    }
  }
);

// Création du slice Redux
const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    token: {
      value: null,
      role: "candidat",
      email: "",
      mot_de_passe: "",
    },
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
      state.token.email = action.payload;
    },
    setMotDePasse: (state, action) => {
      state.mot_de_passe = action.payload;
      state.token.mot_de_passe = action.payload;
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
    setDescriptionEntreprise: (state, action) => {
      state.entreprise.description = action.payload;
    },
    setSecteurActivite: (state, action) => {
      state.entreprise.secteurActivite = action.payload;
    },
    setTailleEntreprise: (state, action) => {
      state.entreprise.taille = action.payload;
    },
    setRole: (state, action) => {
      const validRoles = ["candidat", "recruteur"];
      if (validRoles.includes(action.payload)) {
        state.role = action.payload;
      } else {
        state.authError = "Rôle invalide. Doit être 'candidat' ou 'recruteur'";
      }
    },
    setAcceptTerms: (state, action) => {
      state.acceptTerms = action.payload;
    },
    setAuthError: (state, action) => {
      state.authError = action.payload;
    },
    clearForm: (state) => {
      state.token.email = "";
      state.token.mot_de_passe = "";
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
      state.token = {
        value: null,
        role: "candidat",
        email: "",
        mot_de_passe: "",
      };
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
    clearError: (state) => {
      state.authError = "";
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
        state.isAuthenticated = false;
        state.user = null;
        state.token.value = null;
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
        if (action.payload) {
          state.user = action.payload.user;
          state.token = action.payload.token;
          state.isAuthenticated = true;
        }
        state.authError = "";
      })
      .addCase(checkAuthStatus.rejected, (state, action) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.user = null;
        state.token.value = null;
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
        state.token = {
          value: null,
          role: "candidat",
          email: "",
          mot_de_passe: "",
        };
        state.isAuthenticated = false;
        state.authError = "";
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.token = {
          value: null,
          role: "candidat",
          email: "",
          mot_de_passe: "",
        };
        state.isAuthenticated = false;
        state.authError = action.payload;
      });
  },
});

export const {
  setEmail,
  setMotDePasse,
  setConfirmMotDePasse,
  setNom,
  setTelephone,
  setNomEntreprise,
  setRole,
  setAcceptTerms,
  setAuthError,
  clearForm,
  resetAuthState,
  clearError,
} = authSlice.actions;

export default authSlice.reducer;
