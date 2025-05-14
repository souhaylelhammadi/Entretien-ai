/**
 * Utilitaires pour la gestion des tokens JWT
 */

/**
 * Nettoie et valide un token
 * @param {string} token - Le token à nettoyer et valider
 * @returns {string|null} - Le token nettoyé ou null si invalide
 */
export const cleanToken = (token) => {
  if (!token) return null;
  
  // S'assurer que c'est une chaîne de caractères
  if (typeof token !== 'string') {
    console.error("Token non valide (type incorrect):", typeof token);
    return null;
  }
  
  // Nettoyer le token
  let cleanedToken = token.trim();
  
  // Ajouter ou corriger le préfixe Bearer
  if (!cleanedToken.startsWith('Bearer ')) {
    if (cleanedToken.startsWith('Bearer')) {
      // Corriger l'espace manquant
      cleanedToken = 'Bearer ' + cleanedToken.substring(6);
    } else {
      // Ajouter le préfixe Bearer
      cleanedToken = 'Bearer ' + cleanedToken;
    }
  }
  
  return cleanedToken;
};

/**
 * Sauvegarde le token et les informations utilisateur dans le localStorage
 * @param {string} token - Le token à sauvegarder
 * @param {Object} userData - Les données utilisateur à sauvegarder
 */
export const saveToken = (token, userData) => {
  if (!token) {
    console.error("Tentative de sauvegarde d'un token invalide");
    return;
  }
  
  const cleanedToken = cleanToken(token);
  if (cleanedToken) {
    // Sauvegarder le token
    localStorage.setItem('token', cleanedToken);
    
    // Sauvegarder les données utilisateur
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
    }
    
    // Sauvegarder le timestamp
    localStorage.setItem('tokenTimestamp', Date.now().toString());
  }
};

/**
 * Récupère le token depuis le localStorage et le nettoie
 * @returns {string|null} - Le token nettoyé ou null si introuvable/invalide
 */
export const getCleanToken = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    
    const cleanedToken = cleanToken(token);
    
    // Si le token a été modifié, mettre à jour le localStorage
    if (cleanedToken && cleanedToken !== token) {
      localStorage.setItem('token', cleanedToken);
    }
    
    return cleanedToken;
  } catch (error) {
    console.error("Erreur lors de la récupération du token:", error);
    return null;
  }
};

/**
 * Récupère les données utilisateur depuis le localStorage
 * @returns {Object|null} - Les données utilisateur ou null si non trouvées
 */
export const getUserData = () => {
  try {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error("Erreur lors de la récupération des données utilisateur:", error);
    return null;
  }
};

/**
 * Vérifie si un token est présent et valide
 * @returns {boolean} - true si le token est présent et valide, false sinon
 */
export const hasValidToken = () => {
  try {
    const token = getCleanToken();
    if (!token) return false;

    const userData = getUserData();
    if (!userData) return false;

    // Vérifier si le token a été sauvegardé il y a moins de 24h
    const tokenTimestamp = localStorage.getItem('tokenTimestamp');
    if (tokenTimestamp) {
      const tokenAge = Date.now() - parseInt(tokenTimestamp);
      // Si le token a plus de 24h, le considérer comme expiré
      if (tokenAge > 24 * 60 * 60 * 1000) {
        removeToken();
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Erreur lors de la vérification du token:", error);
    return false;
  }
};

/**
 * Supprime le token et les données utilisateur du localStorage
 */
export const removeToken = () => {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('tokenTimestamp');
    localStorage.removeItem('user');
  } catch (error) {
    console.error("Erreur lors de la suppression du token:", error);
  }
}; 