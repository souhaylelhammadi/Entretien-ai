import axios from "axios";
import { API_URL } from "../config";

const TOKEN_KEY = "auth_token";
const USER_KEY = "user_data";
const TOKEN_TIMESTAMP_KEY = "token_timestamp";

class AuthService {
  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
    this.userData = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    this.tokenTimestamp = localStorage.getItem(TOKEN_TIMESTAMP_KEY);

    // Initialiser les intercepteurs
    this.setupAxiosInterceptors();
  }

  setToken(token) {
    if (!token) return;

    // Nettoyer le token si nécessaire
    if (token.startsWith("Bearer ")) {
      token = token.substring(7);
    }

    this.token = token;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_TIMESTAMP_KEY, Date.now().toString());
  }

  setUserData(userData) {
    if (!userData) return;

    this.userData = userData;
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  }

  getToken() {
    return this.token;
  }

  getUserData() {
    return this.userData;
  }

  isTokenValid() {
    if (!this.token) return false;

    try {
      // Vérifier si le token est présent dans le localStorage
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken || storedToken !== this.token) {
        this.logout();
        return false;
      }

      // Vérifier si les données utilisateur sont présentes
      const storedUserData = localStorage.getItem(USER_KEY);
      if (!storedUserData) {
        this.logout();
        return false;
      }

      // Vérifier l'âge du token
      const tokenTimestamp = localStorage.getItem(TOKEN_TIMESTAMP_KEY);
      if (!tokenTimestamp) {
        this.logout();
        return false;
      }

      const tokenAge = Date.now() - parseInt(tokenTimestamp);
      const tokenExpiration = 24 * 60 * 60 * 1000; // 24 heures en millisecondes

      if (tokenAge >= tokenExpiration) {
        // Tenter de rafraîchir le token
        this.refreshToken().catch(() => {
          this.logout();
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error("Erreur lors de la vérification du token:", error);
      this.logout();
      return false;
    }
  }

  async refreshToken() {
    try {
      const response = await axios.post(
        `${API_URL}/auth/refresh`,
        {},
        {
          headers: { Authorization: `Bearer ${this.token}` },
        }
      );

      if (response.data.token) {
        this.setToken(response.data.token);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Erreur lors du rafraîchissement du token:", error);
      return false;
    }
  }

  async checkAuth() {
    if (!this.token) return false;

    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (response.data.user) {
        this.setUserData(response.data.user);
        return true;
      }
      return false;
    } catch (error) {
      console.error(
        "Erreur lors de la vérification de l'authentification:",
        error
      );
      return false;
    }
  }

  logout() {
    this.token = null;
    this.userData = null;
    this.tokenTimestamp = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_TIMESTAMP_KEY);
  }

  // Configuration d'axios pour inclure le token dans toutes les requêtes
  setupAxiosInterceptors() {
    axios.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const success = await this.refreshToken();
            if (success) {
              originalRequest.headers.Authorization = `Bearer ${this.token}`;
              return axios(originalRequest);
            }
          } catch (refreshError) {
            console.error(
              "Erreur lors du rafraîchissement du token:",
              refreshError
            );
          }

          this.logout();
          window.location.href = "/login";
        }

        return Promise.reject(error);
      }
    );
  }
}

export const authService = new AuthService();
export default authService;
