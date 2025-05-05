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
 * Récupère le token depuis le localStorage et le nettoie
 * @returns {string|null} - Le token nettoyé ou null si introuvable/invalide
 */
export const getCleanToken = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  
  const cleanedToken = cleanToken(token);
  
  // Si le token a été modifié, mettre à jour le localStorage
  if (cleanedToken && cleanedToken !== token) {
    localStorage.setItem('token', cleanedToken);
  }
  
  return cleanedToken;
};

/**
 * Vérifie si un token est présent et valide
 * @returns {boolean} - true si le token est présent et valide, false sinon
 */
export const hasValidToken = () => {
  return !!getCleanToken();
};

/**
 * Supprime le token du localStorage
 */
export const removeToken = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}; 