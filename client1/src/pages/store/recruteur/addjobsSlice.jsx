import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const addJob = createAsyncThunk(
  "addjob/addJob",
  async ({ jobData, token }, { rejectWithValue, dispatch }) => {
    try {
      // Logs détaillés pour le débogage
      console.log("=============== DÉBUT ADDJOBJOB THUNK ===============");
      console.log("Type de token:", typeof token);
      console.log(
        "Valeur du token (10 premiers car.):",
        token ? token.substring(0, 10) + "..." : "null/undefined"
      );

      if (!token || typeof token !== "string" || token.trim() === "") {
        console.error("Token invalide - Détails:", {
          estNull: token === null,
          estUndefined: token === undefined,
          longueur: token ? token.length : 0,
          estVide: token === "",
          type: typeof token,
        });
        throw new Error("Aucun jeton d'authentification valide fourni");
      }

      // Vérification et validation du format des données
      console.log("Structure de jobData:", Object.keys(jobData));
      console.log("Données complètes à envoyer:", JSON.stringify(jobData));

      // Vérification des champs obligatoires selon le backend
      const requiredFields = [
        "titre",
        "description",
        "localisation",
        "departement",
        "competences_requises",
        "entreprise_id",
        "recruteur_id",
      ];
      for (const field of requiredFields) {
        if (
          !jobData[field] ||
          (typeof jobData[field] === "string" && !jobData[field].trim())
        ) {
          console.error(`Champ obligatoire manquant: ${field}`);
          throw new Error(`Le champ ${field} est obligatoire`);
        }
      }

      // Vérification spécifique pour le tableau de compétences
      if (
        !Array.isArray(jobData.competences_requises) ||
        jobData.competences_requises.length === 0
      ) {
        console.error("Compétences requises manquantes");
        throw new Error("Au moins une compétence requise est nécessaire");
      }

      // Préparation du token pour la requête
      const formattedToken = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;
      console.log(
        "Token formaté (10 premiers car.):",
        formattedToken.substring(0, 16) + "..."
      );

      // Configuration et envoi de la requête
      console.log("Envoi de la requête à l'API...");
      const response = await fetch("http://localhost:5000/api/offres-emploi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: formattedToken,
        },
        body: JSON.stringify(jobData),
      });

      console.log("Statut de la réponse:", response.status);
      console.log("Statut texte:", response.statusText);

      if (response.status === 401) {
        console.error("Session expirée (401 Unauthorized)");
        dispatch({ type: "auth/logout" });
        throw new Error("Session expirée. Veuillez vous reconnecter.");
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erreur reçue du serveur:", errorData);
        throw new Error(
          errorData.message || errorData.error || "Échec de l'ajout de l'offre"
        );
      }

      const responseData = await response.json();
      console.log("Réponse du serveur:", responseData);
      console.log("=============== FIN ADDJOBJOB THUNK ===============");
      return responseData;
    } catch (err) {
      console.error("Erreur lors de l'ajout d'une offre:", err);
      console.error("Message d'erreur:", err.message);
      console.error("Stack d'erreur:", err.stack);
      console.log(
        "=============== FIN ADDJOBJOB THUNK (AVEC ERREUR) ==============="
      );
      return rejectWithValue(err.message);
    }
  }
);

export const editJob = createAsyncThunk(
  "addjob/editJob",
  async ({ jobId, jobData, token }, { rejectWithValue, dispatch }) => {
    try {
      console.log("=============== DÉBUT EDITJOB THUNK ===============");

      // Valider les paramètres
      if (!token || typeof token !== "string" || token.trim() === "") {
        throw new Error("Aucun jeton d'authentification valide fourni");
      }

      // Vérification et conversion de l'ID de l'offre
      if (jobId) {
        // Convertir jobId en chaîne si ce n'est pas déjà le cas
        jobId = String(jobId);
      }

      if (!jobId || jobId === "undefined" || jobId.trim() === "") {
        console.error("ID d'offre invalide:", jobId);
        throw new Error("Impossible de modifier l'offre: ID invalide");
      }

      console.log("Données à mettre à jour:", JSON.stringify(jobData));
      console.log("ID de l'offre:", jobId);
      console.log("Type de l'ID:", typeof jobId);
      console.log("Type de token:", typeof token);
      console.log("Token (10 premiers car.):", token.substring(0, 10) + "...");

      // Vérification des champs obligatoires selon le backend pour la mise à jour
      const requiredFieldsForUpdate = [
        "titre",
        "description",
        "localisation",
        "departement",
      ];
      for (const field of requiredFieldsForUpdate) {
        if (
          !jobData[field] ||
          (typeof jobData[field] === "string" && !jobData[field].trim())
        ) {
          console.error(
            `Champ obligatoire manquant pour la mise à jour: ${field}`
          );
          throw new Error(
            `Le champ ${field} est obligatoire pour la mise à jour`
          );
        }
      }

      // Vérification spécifique pour le tableau de compétences
      if (
        !Array.isArray(jobData.competences_requises) ||
        jobData.competences_requises.length === 0
      ) {
        console.error("Compétences requises manquantes");
        throw new Error("Au moins une compétence requise est nécessaire");
      }

      const formattedToken = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;

      console.log(
        `Envoi de la requête PUT à http://localhost:5000/api/offres-emploi/${jobId}`
      );

      const response = await fetch(
        `http://localhost:5000/api/offres-emploi/${jobId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: formattedToken,
          },
          body: JSON.stringify(jobData),
        }
      );

      console.log("Statut de la réponse:", response.status);
      console.log("Statut texte:", response.statusText);

      if (response.status === 401) {
        dispatch({ type: "auth/logout" });
        throw new Error("Session expirée. Veuillez vous reconnecter.");
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erreur reçue du serveur:", errorData);
        throw new Error(
          errorData.message ||
            errorData.error ||
            "Échec de la modification de l'offre"
        );
      }

      const responseData = await response.json();
      console.log("Réponse du serveur:", responseData);
      console.log("=============== FIN EDITJOB THUNK ===============");
      return responseData;
    } catch (err) {
      console.error("Erreur lors de la modification d'une offre:", err);
      console.error("Message d'erreur:", err.message);
      console.error("Stack d'erreur:", err.stack);
      console.log(
        "=============== FIN EDITJOB THUNK (AVEC ERREUR) ==============="
      );
      return rejectWithValue(err.message);
    }
  }
);

export const deleteJob = createAsyncThunk(
  "addjob/deleteJob",
  async ({ jobId, token }, { rejectWithValue, dispatch }) => {
    try {
      console.log("=============== DÉBUT DELETEJOB THUNK ===============");

      // Valider token
      if (!token || typeof token !== "string" || token.trim() === "") {
        throw new Error("Aucun jeton d'authentification valide fourni");
      }

      // Valider ID
      if (!jobId || typeof jobId !== "string" || jobId === "undefined") {
        console.error("ID d'offre invalide pour suppression:", jobId);
        throw new Error("Impossible de supprimer l'offre: ID invalide");
      }

      console.log("Suppression de l'offre ID:", jobId);

      const response = await fetch(
        `http://localhost:5000/api/offres-emploi/${jobId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: token.startsWith("Bearer ")
              ? token
              : `Bearer ${token}`,
          },
        }
      );
      if (response.status === 401) {
        dispatch({ type: "auth/logout" });
        throw new Error("Session expirée. Veuillez vous reconnecter.");
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message ||
            errorData.error ||
            "Échec de la suppression de l'offre"
        );
      }
      return jobId;
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

const addjobsSlice = createSlice({
  name: "addjob",
  initialState: {
    isAddingJob: false,
    isEditingJob: null,
    loading: false,
    newJob: {
      title: "",
      department: "",
      location: "",
      description: "",
      requirements: [],
      status: "open",
    },
    alert: { show: false, type: "", message: "" },
    sortField: "title",
    sortDirection: "asc",
  },
  reducers: {
    setIsAddingJob: (state, action) => {
      state.isAddingJob = action.payload;
    },
    setIsEditingJob: (state, action) => {
      const { jobId, jobData } = action.payload || {};

      // Vérifier et valider jobId
      if (jobId && typeof jobId === "string" && jobId !== "undefined") {
        state.isEditingJob = jobId;
        console.log("ID d'offre stocké pour modification:", jobId);
      } else {
        state.isEditingJob = null;
        console.log("Mode édition désactivé - ID invalide ou null:", jobId);
      }

      if (jobData) {
        state.newJob = {
          title: jobData.title || jobData.titre || "",
          department: jobData.department || jobData.departement || "",
          location: jobData.location || jobData.localisation || "",
          description: jobData.description || "",
          requirements:
            jobData.requirements || jobData.competences_requises || [],
          status: jobData.status || "open",
        };
      }
    },
    setNewJob: (state, action) => {
      state.newJob = { ...state.newJob, ...action.payload };
    },
    addRequirement: (state) => {
      state.newJob.requirements.push("");
    },
    removeRequirement: (state, action) => {
      state.newJob.requirements.splice(action.payload, 1);
    },
    updateRequirement: (state, action) => {
      const { index, value } = action.payload;
      state.newJob.requirements[index] = value;
    },
    setSort: (state, action) => {
      state.sortField = action.payload.field;
      state.sortDirection = action.payload.direction;
    },
    showAlert: (state, action) => {
      state.alert = { show: true, ...action.payload };
    },
    clearAlert: (state) => {
      state.alert = { show: false, type: "", message: "" };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addJob.pending, (state) => {
        state.loading = true;
      })
      .addCase(addJob.fulfilled, (state) => {
        state.isAddingJob = false;
        state.loading = false;
        state.newJob = {
          title: "",
          department: "",
          location: "",
          description: "",
          requirements: [],
          status: "open",
        };
      })
      .addCase(addJob.rejected, (state, action) => {
        state.loading = false;
        state.alert = {
          show: true,
          type: "error",
          message: action.payload,
        };
      })
      .addCase(editJob.pending, (state) => {
        state.loading = true;
      })
      .addCase(editJob.fulfilled, (state) => {
        state.isEditingJob = null;
        state.loading = false;
        state.newJob = {
          title: "",
          department: "",
          location: "",
          description: "",
          requirements: [],
          status: "open",
        };
      })
      .addCase(editJob.rejected, (state, action) => {
        state.loading = false;
        state.alert = {
          show: true,
          type: "error",
          message: action.payload,
        };
      })
      .addCase(deleteJob.pending, (state) => {
        state.loading = true;
      })
      .addCase(deleteJob.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(deleteJob.rejected, (state, action) => {
        state.loading = false;
        state.alert = {
          show: true,
          type: "error",
          message: action.payload,
        };
      });
  },
});

export const {
  setIsAddingJob,
  setIsEditingJob,
  setNewJob,
  addRequirement,
  removeRequirement,
  updateRequirement,
  setSort,
  showAlert,
  clearAlert,
} = addjobsSlice.actions;
export default addjobsSlice.reducer;
