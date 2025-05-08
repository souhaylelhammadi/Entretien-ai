import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./auth/authSlice";
import offresEmploiReducer from "./offresEmploiSlice";
import interviewReducer from "./interviewsSlice";
import acceptedOffersReducer from "./acceptedOffersSlice";
import dashboardReducer from "./recruteur/dashboardSlice";
import candidates from "./candidatesSlice";
import interviewsReducer from "./recruteur/interviewsSlice";
import profileReducer from "./recruteur/profileSlice";
import addjobsReducer from "./recruteur/addjobsSlice";
import jobsReducer from "./recruteur/jobsSlice";

const rootReducer = {
  auth: authReducer,
  offresEmploi: offresEmploiReducer,
  interview: interviewReducer,
  acceptedOffers: acceptedOffersReducer,
  dashboard: dashboardReducer,
  candidates: candidates,
  interviews: interviewsReducer,
  profile: profileReducer,
  addjob: addjobsReducer,
  jobs: jobsReducer,
};

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["offresEmploi/submitCandidature"],
        ignoredPaths: ["offresEmploi.cv", "offresEmploi.lettreMotivation"],
      },
    }),
  devTools: process.env.NODE_ENV !== "production",
});
