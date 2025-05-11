import axios from "axios";

const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Intercepteur pour ajouter le token à chaque requête
instance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error("Erreur dans l'intercepteur de requête:", error);
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les réponses
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("Erreur de réponse Axios:", {
      status: error.response?.status,
      data: error.response?.data,
      config: error.config,
    });
    return Promise.reject(error);
  }
);

export default instance;
