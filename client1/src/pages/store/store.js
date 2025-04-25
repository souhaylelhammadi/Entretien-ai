import { configureStore } from "@reduxjs/toolkit";
import dashboardReducer from "./recruteur/dashboardSlice";
import jobsReducer from "./recruteur/addjobsSlice";
import candidatesReducer from "./recruteur/candidatesSlice";
import authReducer from "./auth/authSlice";

export const store = configureStore({
  reducer: {
    dashboard: dashboardReducer,
    jobs: jobsReducer,
    candidates: candidatesReducer,
    auth: authReducer,
  },
});
