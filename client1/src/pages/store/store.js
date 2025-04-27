import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./auth/authSlice";
import offresEmploiReducer from "./offresEmploiSlice";
import interviewReducer from "./interviewsSlice";
import acceptedOffersReducer from "./acceptedOffersSlice";
import dashboardReducer from "./recruteur/dashboardSlice";
import candidatesReducer from "./recruteur/dashcandidatesSlice";
import interviewsReducer from "./recruteur/candidatesinterviewsSlice";
import profileReducer from "./recruteur/profileSlice";
import addjobsReducer from "./recruteur/addjobsSlice";
import { validateActionMiddleware } from "./auth/authSlice";

const reducer = {
  auth: authReducer,
  offresEmploi: offresEmploiReducer,
  interview: interviewReducer,
  acceptedOffers: acceptedOffersReducer,
  dashboard: dashboardReducer,
  candidates: candidatesReducer,
  interviews: interviewsReducer,
  profile: profileReducer,
  addjob: addjobsReducer,
};

export const store = configureStore({
  reducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["offresEmploi/submitCandidature"],
        ignoredPaths: ["offresEmploi.cv", "offresEmploi.lettreMotivation"],
      },
    }).concat(validateActionMiddleware),
  devTools: process.env.NODE_ENV !== "production",
});
