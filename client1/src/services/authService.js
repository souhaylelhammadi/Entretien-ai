import axios from "axios";

const API_URL = "http://localhost:5000/api/auth";

const authService = {
  login: async (credentials) => {
    try {
      const response = await axios.post(`${API_URL}/login`, credentials);
      const { token, user } = response.data;

      // Stocker le token dans le localStorage avec le préfixe Bearer
      localStorage.setItem("token", `Bearer ${token}`);

      // Stocker les informations utilisateur
      localStorage.setItem("user", JSON.stringify(user));

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  register: async (userData) => {
    try {
      const response = await axios.post(`${API_URL}/register`, userData);
      const { token, user } = response.data;

      // Stocker le token dans le localStorage avec le préfixe Bearer
      localStorage.setItem("token", `Bearer ${token}`);

      // Stocker les informations utilisateur
      localStorage.setItem("user", JSON.stringify(user));

      return response.data;
    } catch (error) {
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  getCurrentUser: () => {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  },

  getAuthHeader: () => {
    const token = localStorage.getItem("token");
    return token ? { Authorization: token } : {};
  },

  isAuthenticated: () => {
    return !!localStorage.getItem("token");
  },
};

export default authService;
