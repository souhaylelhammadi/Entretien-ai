// Configuration de l'API
export const BASE_URL = "http://localhost:5000";
export const API_BASE_URL = "http://localhost:5000";

// Configuration pour le développement
export const config = {
  apiUrl: "http://localhost:5000",
  wsUrl: "ws://localhost:5000",
  environment: "development",
};

// Configuration des routes
export const ROUTES = {
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  PROFILE: "/profile",
  OFFERS: "/offers",
  CANDIDATES: "/candidates",
};

// Configuration des statuts de candidature
export const CANDIDATE_STATUS = {
  PENDING: "En attente",
  IN_PROGRESS: "En cours",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
};

// Configuration des messages d'erreur
export const ERROR_MESSAGES = {
  AUTH_REQUIRED: "Veuillez vous connecter pour accéder à cette page",
  UNAUTHORIZED: "Accès non autorisé",
  SERVER_ERROR: "Une erreur est survenue sur le serveur",
  NETWORK_ERROR: "Erreur de connexion au serveur",
};
