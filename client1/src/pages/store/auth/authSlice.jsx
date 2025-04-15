import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Async thunk to login a user
export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email,
        password,
      });
      localStorage.setItem("token", response.data.token);
      return {
        user: response.data.user,
        token: response.data.token,
        role: response.data.user?.role || "user",
      };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Échec de la connexion. Vérifiez vos identifiants.";
      return rejectWithValue(message);
    }
  }
);

// Async thunk to register a user
export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async (userData, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${API_URL}/api/auth/register`,
        userData
      );
      localStorage.setItem("token", response.data.token);
      return {
        user: response.data.user,
        token: response.data.token,
        role: response.data.user?.role || "user",
      };
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Échec de l’inscription. Vérifiez vos données.";
      return rejectWithValue(message);
    }
  }
);

// Async thunk to logout a user
export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Aucun jeton trouvé");
      await axios.post(
        `${API_URL}/api/auth/logout`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      localStorage.removeItem("token");
      return { message: "Déconnexion réussie" };
    } catch (err) {
      localStorage.removeItem("token");
      return rejectWithValue(
        err.response?.data?.message || "Échec de la déconnexion"
      );
    }
  }
);

// Async thunk to check token and restore session on app load
export const checkAuthStatus = createAsyncThunk(
  "auth/checkAuthStatus",
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Aucun jeton trouvé");

      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return {
        user: response.data.user,
        token,
        role: response.data.user?.role || "user",
      };
    } catch (err) {
      localStorage.removeItem("token");
      return rejectWithValue("Session invalide ou expirée");
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    token: null,
    isAuthenticated: false,
    role: "user",
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
      state.role = action.payload;
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
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.role = "user";
      state.email = "";
      state.password = "";
      state.confirmPassword = "";
      state.firstName = "";
      state.lastName = "";
      state.companyName = "";
      state.acceptTerms = false;
      state.authError = "";
      localStorage.removeItem("token");
    },
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
        state.role = action.payload.role;
        state.isAuthenticated = true;
        state.email = "";
        state.password = "";
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.authError = action.payload;
        state.isAuthenticated = false;
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
        state.role = action.payload.role;
        state.isAuthenticated = true;
        state.email = "";
        state.password = "";
        state.confirmPassword = "";
        state.firstName = "";
        state.lastName = "";
        state.companyName = "";
        state.acceptTerms = false;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.authError = action.payload;
        state.isAuthenticated = false;
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
        state.role = "user";
        state.email = "";
        state.password = "";
        state.confirmPassword = "";
        state.firstName = "";
        state.lastName = "";
        state.companyName = "";
        state.acceptTerms = false;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.loading = false;
        state.authError = action.payload;
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.role = "user";
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
        state.role = action.payload.role;
        state.isAuthenticated = true;
      })
      .addCase(checkAuthStatus.rejected, (state, action) => {
        state.loading = false;
        state.authError = action.payload;
        state.isAuthenticated = false;
        state.user = null;
        state.token = null;
        state.role = "user";
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
