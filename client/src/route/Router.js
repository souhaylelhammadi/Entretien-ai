import { Routes, Route, useLocation, Outlet } from "react-router-dom";

import { useLayoutEffect } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useSelector } from "react-redux";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import Home from "../pages/Home";
import Layout from "../layout/Layout";
import Interview from "../pages/entretienpourc";
import OffresEmploi from "../pages/OffresEmploi";
import DetailsOffreEmploi from "../pages/components/DetailsOffreEmploi";
import { Navigate } from "react-router-dom";
import DashboardRecrutement from "../pages/recruteur/RecruiterDashboard"; 
import Mesinterview from "../pages/Mesinterview";
import Profile from "../layout/Navbar/profile";
import Index from "../pages/homepage"



function ProtectedRoute({ children, role }) {
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && (!user || user.role !== role)) {
    console.log(
      "Accès refusé - Rôle requis:",
      role,
      "Rôle actuel:",
      user?.role
    );
    return <Navigate to="/" replace />;
  }

  return children;
}

function Router() {
  const location = useLocation();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <>
      <ToastContainer />
      <Routes>
        {/* */}

        <Route path="/" element={<Layout />}>
          {" "}<Route index element={<Index />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="offres" element={<OffresEmploi />} />
          <Route path="offres/:id" element={<DetailsOffreEmploi />} />
          <Route path="/entretienpourc/:interviewId" element={<Interview />} />
          {/* Routes protégées pour les candidats */}
          <Route
            path="mesinterview"
            element={
              <ProtectedRoute role="candidat">
                <Mesinterview />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile"
            element={
              <ProtectedRoute role="candidat">
                <Profile />
              </ProtectedRoute>
            }
          />
          {/* Routes protégées pour les recruteurs */}
          <Route
            path="recrutement/*"
            element={
              <ProtectedRoute role="recruteur">
                <DashboardRecrutement />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </>
  );
}

export default Router;
