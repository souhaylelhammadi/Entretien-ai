import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useDispatch } from "react-redux";
import { setUser } from "./store/authSlice";
import { authService } from "./services/authService";
import AuthGuard from "./components/AuthGuard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import RecruteurDashboard from "./pages/Recruteur/Dashboard";
import CandidatesSection from "./pages/Recruteur/components/CandidatesSection";
import OffresSection from "./pages/Recruteur/components/OffresSection";
import EntretiensSection from "./pages/Recruteur/components/EntretiensSection";
import ProfileRecruteur from "./pages/Recruteur/Profile";
import CandidatDashboard from "./pages/Candidat/Dashboard";
import MesCandidatures from "./pages/Candidat/MesCandidatures";
import ProfileCandidat from "./pages/Candidat/Profile";
import AdminDashboard from "./pages/Admin/Dashboard";
import GestionUsers from "./pages/Admin/GestionUsers";
import GestionRoles from "./pages/Admin/GestionRoles";
import Navbar from "./components/Navbar";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Interview from "./pages/Interview";
import PrivateRoute from "./components/PrivateRoute";
import Dashboard from "./pages/dashboard";
import MesInterviews from "./pages/mesinterview";

function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    // Initialiser les intercepteurs axios
    authService.setupAxiosInterceptors();
  }, []);

  useEffect(() => {
    if (authService.isAuthenticated()) {
      const userData = authService.getUser();
      dispatch(setUser(userData));
    }
  }, [dispatch]);

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <ToastContainer position="top-right" autoClose={3000} />
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            {/* Routes publiques */}
            <Route path="/" element={<Home />} />
            <Route
              path="/login"
              element={
                authService.isTokenValid() ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Login />
                )
              }
            />
            <Route
              path="/register"
              element={
                authService.isTokenValid() ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <Register />
                )
              }
            />

            {/* Routes protégées - Recruteur */}
            <Route
              path="/recruteur/dashboard"
              element={
                <AuthGuard>
                  <RecruteurDashboard />
                </AuthGuard>
              }
            />
            <Route
              path="/recruteur/candidates"
              element={
                <AuthGuard>
                  <CandidatesSection />
                </AuthGuard>
              }
            />
            <Route
              path="/recruteur/offres"
              element={
                <AuthGuard>
                  <OffresSection />
                </AuthGuard>
              }
            />
            <Route
              path="/recruteur/entretiens"
              element={
                <AuthGuard>
                  <EntretiensSection />
                </AuthGuard>
              }
            />
            <Route
              path="/recruteur/profile"
              element={
                <AuthGuard>
                  <ProfileRecruteur />
                </AuthGuard>
              }
            />

            {/* Routes protégées - Candidat */}
            <Route
              path="/candidat/dashboard"
              element={
                <AuthGuard>
                  <CandidatDashboard />
                </AuthGuard>
              }
            />
            <Route
              path="/candidat/candidatures"
              element={
                <AuthGuard>
                  <MesCandidatures />
                </AuthGuard>
              }
            />
            <Route
              path="/candidat/profile"
              element={
                <AuthGuard>
                  <ProfileCandidat />
                </AuthGuard>
              }
            />
            <Route
              path="/interview/:interviewId"
              element={
                <AuthGuard>
                  <Interview />
                </AuthGuard>
              }
            />

            {/* Routes protégées - Admin */}
            <Route
              path="/admin/dashboard"
              element={
                <AuthGuard>
                  <AdminDashboard />
                </AuthGuard>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AuthGuard>
                  <GestionUsers />
                </AuthGuard>
              }
            />
            <Route
              path="/admin/roles"
              element={
                <AuthGuard>
                  <GestionRoles />
                </AuthGuard>
              }
            />

            {/* Routes protégées */}
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/entretien/:interviewId"
              element={
                <PrivateRoute>
                  <Interview />
                </PrivateRoute>
              }
            />
            <Route
              path="/mesinterview"
              element={
                <PrivateRoute>
                  <MesInterviews />
                </PrivateRoute>
              }
            />

            {/* Redirection par défaut */}
            <Route
              path="/"
              element={
                <Navigate
                  to={authService.isAuthenticated() ? "/dashboard" : "/login"}
                  replace
                />
              }
            />

            {/* Route 404 */}
            <Route
              path="*"
              element={
                <div className="text-center py-12">
                  <h1 className="text-4xl font-bold text-gray-800">404</h1>
                  <p className="text-gray-600 mt-4">Page non trouvée</p>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
