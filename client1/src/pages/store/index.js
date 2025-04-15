import { configureStore } from "@reduxjs/toolkit";
import offresEmploiSlice from "./offresEmploiSlice"
import interviewReducer from "./interviewsSlice";
import acceptedOffersReducer from "./acceptedOffersSlice";
import dashboardReducer from "./recruteur/dashboardSlice";
import candidatesReducer from "./recruteur/dashcandidatesSlice";
import interviewsReducer from "./recruteur/candidatesinterviewsSlice";
import profieleReducer from "./recruteur/profileSlice";
import addjobsSlice from "./recruteur/addjobsSlice";
import authReducer from "./auth/authSlice";
export const store = configureStore({
  reducer: {
    offresEmploi: offresEmploiSlice,
    interview: interviewReducer,
    acceptedOffers: acceptedOffersReducer,

    dashboard: dashboardReducer,
    candidates: candidatesReducer,
    interviews: interviewsReducer,
    addjob: addjobsSlice,
    profile: profieleReducer,
    auth: authReducer,
  },
});
