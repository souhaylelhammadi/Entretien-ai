import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { BASE_URL } from "../../config";

// Thunk pour récupérer les offres acceptées
export const fetchAcceptedOffers = createAsyncThunk(
  "acceptedOffers/fetchAcceptedOffers",
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      console.log("État d'authentification:", auth);

      if (!auth || !auth.token) {
        console.log("Pas de token dans le state");
        throw new Error(
          "Vous devez être connecté pour accéder aux candidatures acceptées"
        );
      }

      const tokenObj = auth.token;
      console.log("Token object:", tokenObj);

      if (!tokenObj.value) {
        console.log("Pas de valeur dans le token");
        throw new Error("Token invalide");
      }

      const tokenValue = tokenObj.value.replace("Bearer ", "");
      console.log("Token value:", tokenValue);

      const response = await fetch(`${BASE_URL}/api/accepted-offers`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenValue}`,
        },
        credentials: "include",
        mode: "cors",
      });

      console.log("Response status:", response.status);

      const data = await response.json();
      console.log("Response data:", data);

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          throw new Error("Session expirée. Veuillez vous reconnecter.");
        }
        throw new Error(
          data.error || "Échec de la récupération des candidatures acceptées"
        );
      }
      return data.acceptedOffers || [];
    } catch (error) {
      console.error("fetchAcceptedOffers error:", error.message);
      return rejectWithValue(error.message);
    }
  }
);

// Thunk pour générer un entretien
export const generateInterview = createAsyncThunk(
  "acceptedOffers/generateInterview",
  async (applicationId, { getState, rejectWithValue }) => {
    try {
      const { auth, acceptedOffers } = getState();
      if (!auth || !auth.token) {
        throw new Error("Vous devez être connecté pour générer un entretien");
      }

      // Extraire l'ID utilisateur du token JWT
      const tokenValue = auth.token.value.replace("Bearer ", "");
      const tokenPayload = JSON.parse(atob(tokenValue.split(".")[1]));
      const userId = tokenPayload.sub;

      console.log("ID de candidature recherché:", applicationId);
      console.log(
        "Liste des candidatures:",
        JSON.stringify(acceptedOffers.candidatures, null, 2)
      );
      console.log("ID utilisateur du token:", userId);

      // Vérifier si la candidature existe dans la liste des offres acceptées
      const candidature = acceptedOffers.candidatures.find(
        (c) => c._id === applicationId
      );

      if (!candidature) {
        console.error("Candidature non trouvée dans le state");
        throw new Error("Cette candidature n'existe pas ou n'est pas acceptée");
      }

      console.log("Candidature trouvée:", JSON.stringify(candidature, null, 2));

      // Vérifier que nous avons toutes les données nécessaires
      if (!candidature._id || !candidature.offre_id) {
        console.error("Données de candidature incomplètes:", candidature);
        throw new Error("Données de candidature incomplètes");
      }

      // Mettre à jour le statut de la candidature
      const updatePayload = {
        status: "pending_interview",
        candidature_id: candidature._id,
        offre_id: candidature.offre_id,
        candidat_id: userId,
      };

      console.log("Payload de mise à jour:", updatePayload);

      const applicationResponse = await fetch(
        `${BASE_URL}/api/accepted-offers/${applicationId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenValue}`,
          },
          body: JSON.stringify(updatePayload),
          credentials: "include",
          mode: "cors",
        }
      );

      if (!applicationResponse.ok) {
        const errorData = await applicationResponse.json().catch(() => ({}));
        console.error("Erreur de mise à jour:", {
          status: applicationResponse.status,
          statusText: applicationResponse.statusText,
          errorData,
          candidature,
          userId,
          updatePayload,
        });
        throw new Error(
          `Impossible de mettre à jour le statut de la candidature: ${
            errorData.error || applicationResponse.statusText
          }`
        );
      }

      const applicationData = await applicationResponse.json();
      console.log("Réponse de mise à jour:", applicationData);

      if (!applicationData.offer) {
        throw new Error("Données de candidature invalides");
      }

      // Générer l'entretien
      const interviewPayload = {
        candidature_id: candidature._id,
        offre_id: candidature.offre_id,
        cv_text: candidature.cv_text || "",
        job_offer: candidature.jobDetails || {},
      };

      console.log("Payload de génération d'entretien:", interviewPayload);

      const response = await fetch(`${BASE_URL}/api/interviews/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenValue}`,
        },
        body: JSON.stringify(interviewPayload),
        credentials: "include",
        mode: "cors",
      });

      const data = await response.json();
      console.log("Réponse de génération d'entretien:", data);

      if (!response.ok) {
        throw new Error(data.error || "Échec de la génération de l'entretien");
      }

      // Créer l'enregistrement de l'entretien
      const interviewRecordPayload = {
        candidature_id: candidature._id,
        offre_id: candidature.offre_id,
        questions_id: data.questions_id,
        statut: "planifie",
      };

      console.log("Payload de création d'entretien:", interviewRecordPayload);

      const interviewResponse = await fetch(
        `${BASE_URL}/api/candidates/entretiens`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenValue}`,
          },
          body: JSON.stringify(interviewRecordPayload),
          credentials: "include",
          mode: "cors",
        }
      );

      const interviewData = await interviewResponse.json();
      console.log("Réponse de création d'entretien:", interviewData);

      if (!interviewResponse.ok) {
        throw new Error(
          interviewData.error || "Échec de la création de l'entretien"
        );
      }

      return {
        entretien_id: interviewData.entretien_id,
        candidature_id: candidature._id,
      };
    } catch (error) {
      console.error("generateInterview error:", error.message);
      return rejectWithValue(error.message);
    }
  }
);

// Thunk pour mettre à jour le statut d'une offre
export const updateOfferStatus = createAsyncThunk(
  "acceptedOffers/updateOfferStatus",
  async ({ applicationId, status }, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      if (!auth || !auth.token) {
        throw new Error(
          "Vous devez être connecté pour mettre à jour le statut"
        );
      }

      const tokenValue = auth.token.value.replace("Bearer ", "");
      const response = await fetch(
        `${BASE_URL}/api/accepted-offers/${applicationId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenValue}`,
          },
          body: JSON.stringify({ status }),
          credentials: "include",
          mode: "cors",
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Échec de la mise à jour du statut");
      }

      return data.offer;
    } catch (error) {
      console.error("updateOfferStatus error:", error.message);
      return rejectWithValue(error.message);
    }
  }
);

const acceptedOffersSlice = createSlice({
  name: "acceptedOffers",
  initialState: {
    candidatures: [],
    loading: false,
    error: null,
    generatingInterview: false,
    interviewError: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearInterviewError: (state) => {
      state.interviewError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Accepted Offers
      .addCase(fetchAcceptedOffers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAcceptedOffers.fulfilled, (state, action) => {
        state.loading = false;
        state.candidatures = action.payload;
      })
      .addCase(fetchAcceptedOffers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Generate Interview
      .addCase(generateInterview.pending, (state) => {
        state.generatingInterview = true;
        state.interviewError = null;
      })
      .addCase(generateInterview.fulfilled, (state, action) => {
        state.generatingInterview = false;
        // Mettre à jour le statut de la candidature dans la liste
        const index = state.candidatures.findIndex(
          (c) => c._id === action.payload.candidature_id
        );
        if (index !== -1) {
          state.candidatures[index].entretien_id = action.payload.entretien_id;
          state.candidatures[index].statut = "pending_interview";
        }
      })
      .addCase(generateInterview.rejected, (state, action) => {
        state.generatingInterview = false;
        state.interviewError = action.payload;
      })
      // Update Offer Status
      .addCase(updateOfferStatus.fulfilled, (state, action) => {
        const index = state.candidatures.findIndex(
          (c) => c._id === action.payload._id
        );
        if (index !== -1) {
          state.candidatures[index] = action.payload;
        }
      });
  },
});

export const { clearError, clearInterviewError } = acceptedOffersSlice.actions;
export default acceptedOffersSlice.reducer;
