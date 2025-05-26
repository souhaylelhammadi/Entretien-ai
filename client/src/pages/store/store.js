// Import des reducers
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./auth/authSlice";
import offresEmploiReducer from "./offresEmploiSlice";
import interviewReducer from "./entretienpourcSlice";
import acceptedOffersReducer from "./acceptedOffersSlice";
import dashboardReducer from "./recruteur/dashboardSlice";
import candidatesReducer from "./candidatesSlice";
import profileReducer from "./recruteur/profileSlice";
import addjobsReducer from "./recruteur/addjobsSlice";
import jobsReducer from "./recruteur/jobsSlice";
import entretiensReducer from "./recruteur/ent1slice";

// Configuration du root reducer
const rootReducer = {
  auth: authReducer,
  offresEmploi: offresEmploiReducer,
  interview: interviewReducer,
  acceptedOffers: acceptedOffersReducer,
  dashboard: dashboardReducer,
  candidates: candidatesReducer,
  profile: profileReducer,
  addjob: addjobsReducer,
  jobs: jobsReducer,
  entretiens: entretiensReducer,
};

// Configuration du store
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["offresEmploi/submitCandidature"],
        ignoredPaths: [
          "offresEmploi.cv",
          "offresEmploi.lettreMotivation",
          "interview.localStream",
          "interview.recordedBlob",
        ],
      },
    }),
  devTools: process.env.NODE_ENV !== "production",
});
