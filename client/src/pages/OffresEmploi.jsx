import React, { useEffect } from "react";
import {
  Search,
  MapPin,
  Briefcase,
  Clock,
  Building,
  ChevronDown,
  Filter,
  Loader2,
  Frown,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  fetchOffresEmploi,
  setSearchTerm,
  setLocationFilter,
  setSecteurFilter,
  toggleFilterOpen,
} from "./store/offresEmploiSlice";

function OffresEmploi() {
  const dispatch = useDispatch();
  const location = useLocation();
  const offresEmploiState = useSelector((state) => state.offresEmploi) || {};
  const {
    filteredOffres = [],
    loading = false,
    error = null,
    searchTerm = "",
    locationFilter = "",
    secteurFilter = "",
    isFilterOpen = false,
  } = offresEmploiState;

  useEffect(() => {
    dispatch(fetchOffresEmploi());
    if (location.state?.message) {
     
      window.history.replaceState({}, document.title);
    }
  }, [dispatch, location.state]);

  useEffect(() => {
    filteredOffres.forEach((offre, index) => {
      console.log(`Offre ${index}:`, {
        id: offre.id,
        titre: offre.titre,
        date_creation: offre.date_creation,
        isValidDate: !isNaN(new Date(offre.date_creation)),
      });
    });
  }, [filteredOffres]);


  const formatDate = (dateString) => {
    if (!dateString) {
      console.warn("formatDate: No dateString provided");
      return "Date inconnue";
    }
    const date = new Date(dateString);
    if (isNaN(date)) {
      console.warn(`formatDate: Invalid dateString: ${dateString}`);
      return "Date inconnue";
    }
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    return diffInDays === 0
      ? "Aujourd’hui"
      : diffInDays === 1
      ? "Hier"
      : `Il y a ${diffInDays} jours`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="animate-spin h-12 w-12 text-indigo-600" />
          <p className="text-lg font-medium text-gray-700">
            Chargement des offres...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md">
          <Frown className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-3">
            Une erreur est survenue
          </h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => dispatch(fetchOffresEmploi())}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <header className="bg-gradient-to-r from-indigo-600 to-teal-600 text-white shadow-lg py-6 px-4 md:px-8 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <h1 className="text-3xl font-bold tracking-tight">Offres d’Emploi</h1>
          <div className="flex items-center w-full max-w-2xl relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un poste, une compétence ou une localisation"
              value={searchTerm}
              onChange={(e) => dispatch(setSearchTerm(e.target.value))}
              className="w-full pl-12 pr-4 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-gray-300 focus:ring-2 focus:ring-white focus:outline-none transition-all duration-300"
              aria-label="Rechercher des offres d'emploi"
            />
            <button
              onClick={() => dispatch(toggleFilterOpen())}
              className="ml-3 p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors duration-300 flex items-center"
              aria-expanded={isFilterOpen}
              aria-label="Toggle filters"
            >
              <Filter className="h-5 w-5 text-white" />
              <ChevronDown
                className={`h-4 w-4 ml-2 transition-transform duration-300 ${
                  isFilterOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </div>
        <div
          className={`max-w-7xl mx-auto mt-4 overflow-hidden transition-all duration-300 ease-in-out ${
            isFilterOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="location-filter"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Localisation
                </label>
                <input
                  id="location-filter"
                  type="text"
                  placeholder="Ville ou région"
                  value={locationFilter}
                  onChange={(e) => dispatch(setLocationFilter(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors duration-300"
                  aria-label="Filtrer par localisation"
                />
              </div>
              <div>
                <label
                  htmlFor="secteur-filter"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Secteur
                </label>
                <input
                  id="secteur-filter"
                  type="text"
                  placeholder="Secteur d’activité"
                  value={secteurFilter}
                  onChange={(e) => dispatch(setSecteurFilter(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors duration-300"
                  aria-label="Filtrer par secteur"
                />
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-10 px-4 md:px-8">
        {filteredOffres.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-xl font-semibold text-gray-800 mb-3">
              Aucune offre correspondante
            </h3>
            <p className="text-gray-600">
              Ajustez vos critères pour trouver des opportunités.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOffres.map((offre) => (
              <Link
                key={offre.id}
                to={`/offres/${offre.id}`}
                className="bg-white p-6 rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 hover:scale-[1.02] border border-gray-100 flex flex-col"
                aria-label={`Voir les détails de l'offre ${offre.titre}`}
              >
                <div className="flex items-start space-x-4 flex-1">
                  <Building className="h-10 w-10 text-indigo-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 hover:text-indigo-600 transition-colors duration-200 line-clamp-2">
                      {offre.titre}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1 font-medium">
                      {offre.entreprise || "Entreprise inconnue"}
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-gray-500">
                      <div className="flex items-center">
                        <MapPin className="h-5 w-5 mr-2 text-gray-400 flex-shrink-0" />
                        <span className="truncate">
                          {offre.localisation || "Non spécifiée"}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <Briefcase className="h-5 w-5 mr-2 text-gray-400 flex-shrink-0" />
                        <span>{offre.valide ? "Ouverte" : "Fermée"}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-5 w-5 mr-2 text-gray-400 flex-shrink-0" />
                        <span>{formatDate(offre.date_creation)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default OffresEmploi;
