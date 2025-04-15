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
import { Link } from "react-router-dom";
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
  }, [dispatch]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
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
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="flex flex-col items-center">
          <Loader2 className="animate-spin h-10 w-10 text-blue-600 mb-3" />
          <p className="text-gray-600 font-medium">Chargement en cours...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-sm">
          <Frown className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Une erreur est survenue
          </h3>
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={() => dispatch(fetchOffresEmploi())}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 mt-16">
      <header className="bg-white shadow-sm py-4 px-6 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">
            Offres d’emploi
          </h1>
          <div className="flex items-center w-full max-w-xl relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un poste, une compétence ou une localisation"
              value={searchTerm}
              onChange={(e) => dispatch(setSearchTerm(e.target.value))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-700 placeholder-gray-400 shadow-sm"
            />
            <button
              onClick={() => dispatch(toggleFilterOpen())}
              className="ml-2 p-2 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors flex items-center"
            >
              <Filter className="h-5 w-5 text-gray-600" />
              <ChevronDown
                className={`h-4 w-4 ml-1 transition-transform ${
                  isFilterOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </div>
        {isFilterOpen && (
          <div className="max-w-7xl mx-auto mt-4 bg-white p-4 rounded-md shadow-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Localisation
                </label>
                <input
                  type="text"
                  placeholder="Ville ou région"
                  value={locationFilter}
                  onChange={(e) => dispatch(setLocationFilter(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Secteur
                </label>
                <input
                  type="text"
                  placeholder="Secteur d’activité"
                  value={secteurFilter}
                  onChange={(e) => dispatch(setSecteurFilter(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}
      </header>
      <main className="max-w-7xl mx-auto py-8">
        {filteredOffres.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm text-center">
            <svg
              className="mx-auto h-10 w-10 text-gray-400 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune offre correspondante
            </h3>
            <p className="text-gray-500">
              Ajustez vos critères pour trouver des opportunités.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOffres.map((offre) => (
              <Link
                key={offre.id}
                to={`/offre/${offre.id}`}
                className="bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 flex flex-col h-full"
              >
                <div className="flex items-start space-x-4 flex-1">
                  <Building className="h-8 w-8 text-blue-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors line-clamp-2">
                      {offre.titre}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {offre.entreprise}
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-gray-500">
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span className="truncate">{offre.localisation}</span>
                      </div>
                      <div className="flex items-center">
                        <Briefcase className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span>{offre.valide ? "Ouverte" : "Fermée"}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span>{formatDate(offre.createdAt)}</span>
                      </div>
                    </div>
                    {offre.competences_requises.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {offre.competences_requises
                          .slice(0, 3)
                          .map((competence, index) => (
                            <span
                              key={index}
                              className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full whitespace-nowrap"
                            >
                              {competence}
                            </span>
                          ))}
                        {offre.competences_requises.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{offre.competences_requises.length - 3}
                          </span>
                        )}
                      </div>
                    )}
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
