import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./auth/authSlice";
import foldersReducer from "./recruteur/foldersSlice";
import candidatesReducer from "./recruteur/candidatesSlice";
import jobsReducer from "./recruteur/jobsSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    folders: foldersReducer,
    candidates: candidatesReducer,
    jobs: jobsReducer,
  },
});

export default store;
