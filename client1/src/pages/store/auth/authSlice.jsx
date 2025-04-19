import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Middleware to catch invalid actions
export const validateActionMiddleware = () => (next) => (action) => {
  if (!action || !action.type) {
    console.warn("Invalid action detected:", action);
    return; // Block invalid actions
  }
  console.log("Dispatching action:", action.type);
  return next(action);
};

// Utility for retrying failed requests
const retryRequest = async (fn, retries = 2, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1 || !err.code || err.code !== "ECONNABORTED") {
        throw err;
      }
      console.warn(`Retry ${i + 1}/${retries} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

// Async thunk to login user
export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      // Validate inputs
      if (!email || !password) {
        throw new Error("Email et mot de passe requis");
      }
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        throw new Error("Format d'email invalide");
      }

      console.log("Attempting login with:", { email });
      const request = () =>
        axios.post(
          `${API_URL}/api/auth/login`,
          { email, password },
          { timeout: 10000 }
        );

      const response = await retryRequest(request);
      console.log("Login response:", response.data);

      localStorage.setItem("token", response.data.token);
      return response.data;
    } catch (err) {
      console.error("Login error:", err.message, err.response?.data);
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

// Async thunk to register user
export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async (userData, { rejectWithValue }) => {
    try {
      // Validate inputs
      const requiredFields = [
        "firstName",
        "lastName",
        "email",
        "password",
        "role",
      ];
      if (!requiredFields.every((field) => userData[field])) {
        throw new Error("Tous les champs obligatoires doivent être remplis");
      }
      if (!/^\S+@\S+\.\S+$/.test(userData.email)) {
        throw new Error("Format d'email invalide");
      }
      if (userData.password.length < 8) {
        throw new Error("Le mot de passe doit contenir au moins 8 caractères");
      }
      if (
        !/[A-Z]/.test(userData.password) ||
        !/[0-9]/.test(userData.password)
      ) {
        throw new Error(
          "Le mot de passe doit inclure une majuscule et un chiffre"
        );
      }
      if (!["candidat", "recruteur"].includes(userData.role)) {
        throw new Error("Rôle invalide. Doit être 'candidat' ou 'recruteur'");
      }
      if (userData.role === "recruteur" && !userData.entreprise_id) {
        throw new Error(
          "Le nom de l'entreprise est requis pour les recruteurs"
        );
      }
      if (!userData.acceptTerms) {
        throw new Error("Vous devez accepter les conditions");
      }

      console.log("Attempting registration with:", userData);
      const request = () =>
        axios.post(`${API_URL}/api/auth/register`, userData, {
          timeout: 10000,
        });

      const response = await retryRequest(request);
      console.log("Register response:", response.data);

      localStorage.setItem("token", response.data.token);
      return response.data;
    } catch (err) {
      console.error("Register error:", err.message, err.response?.data);
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

// Async thunk to update user information
export const updateUser = createAsyncThunk(
  "auth/updateUser",
  async (userData, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const token = auth.token;
      if (!token) {
        throw new Error("Aucun jeton trouvé");
      }

      // Validate inputs
      if (!userData.firstName || !userData.lastName || !userData.email) {
        throw new Error("Tous les champs sont requis");
      }
      if (!/^\S+@\S+\.\S+$/.test(userData.email)) {
        throw new Error("Format d'email invalide");
      }

      console.log("Attempting to update user with:", userData);
      const request = () =>
        axios.put(`${API_URL}/api/auth/update`, userData, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        });

      const response = await retryRequest(request);
      console.log("Update user response:", response.data);

      return response.data.user;
    } catch (err) {
      console.error("Update user error:", err.message, err.response?.data);
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

// Async thunk to check authentication status
export const checkAuthStatus = createAsyncThunk(
  "auth/checkAuthStatus",
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Aucun jeton trouvé");
      }

      console.log("Checking auth status");
      const request = () =>
        axios.get(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        });

      const response = await retryRequest(request);
      console.log("Auth status response:", response.data);

      return response.data;
    } catch (err) {
      console.error(
        "Check auth status error:",
        err.message,
        err.response?.data
      );
      localStorage.removeItem("token");
      const message =
        err.response?.data?.message ||
        (err.code === "ECONNABORTED"
          ? "Délai d'attente dépassé. Vérifiez votre connexion."
          : err.message === "Network Error"
          ? "Erreur réseau. Vérifiez que le serveur est accessible."
          : err.message || "Échec de la vérification de l'authentification");
      return rejectWithValue(message);
    }
  }
);

// Async thunk to logout user
export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { rejectWithValue, getState }) => {
    try {
      const { auth } = getState();
      const token = auth.token;
      if (!token) {
        throw new Error("Aucun jeton trouvé");
      }

      console.log("Attempting logout");
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
      console.log("Logout response:", response.data);

      localStorage.removeItem("token");
      return response.data;
    } catch (err) {
      console.error("Logout error:", err.message, err.response?.data);
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

// Utility to reset auth state
const resetAuthState = (state) => ({
  ...state,
  user: null,
  token: null,
  isAuthenticated: false,
  role: "candidat",
  email: "",
  password: "",
  confirmPassword: "",
  firstName: "",
  lastName: "",
  companyName: "",
  acceptTerms: false,
  authError: state.authError || "",
});

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    token: null,
    isAuthenticated: false,
    role: "candidat",
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    companyName: "",
    acceptTerms: false,
    loading: false,
    authError: "",
  },
  reducers: {
    setEmail: (state, action) => {
      state.email = action.payload;
    },
    setPassword: (state, action) => {
      state.password = action.payload;
    },
    setConfirmPassword: (state, action) => {
      state.confirmPassword = action.payload;
    },
    setFirstName: (state, action) => {
      state.firstName = action.payload;
    },
    setLastName: (state, action) => {
      state.lastName = action.payload;
    },
    setCompanyName: (state, action) => {
      state.companyName = action.payload;
    },
    setRole: (state, action) => {
      const validRoles = ["candidat", "recruteur"];
      if (!validRoles.includes(action.payload)) {
        console.warn("Invalid role set attempt:", action.payload);
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
      state.password = "";
      state.confirmPassword = "";
      state.firstName = "";
      state.lastName = "";
      state.companyName = "";
      state.acceptTerms = false;
      state.authError = "";
    },
    logout: resetAuthState,
  },
  extraReducers: (builder) => {
    builder
      // Login User
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
      // Register User
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
      // Update User
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
      // Check Auth Status
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
      // Logout User
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
      // Handle invalid actions
      .addDefaultCase((state, action) => {
        if (!action || !action.type) {
          console.warn("Invalid action in authSlice:", action);
          return state;
        }
        return state;
      });
  },
});

export const {
  setEmail,
  setPassword,
  setConfirmPassword,
  setFirstName,
  setLastName,
  setCompanyName,
  setRole,
  setAcceptTerms,
  clearForm,
  logout,
} = authSlice.actions;

export default authSlice.reducer;
