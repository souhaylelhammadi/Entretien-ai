import { Routes, Route, useLocation, Outlet } from "react-router-dom";

import { useLayoutEffect } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useSelector } from "react-redux";
import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import Home from "../pages/Home";
import Layout from "../layout/Layout";
import Interview from "../pages/Interview";
import OffresEmploi from "../pages/OffresEmploi";
import DetailsOffreEmploi from "../pages/components/DetailsOffreEmploi";
import { Navigate } from "react-router-dom";
import DashboardRecrutement from "../pages/Recruteur/RecruiterDashboard";
import Mesinterview from "../pages/Mesinterview";
import Profile from "../layout/Navbar/profile";

function ProtectedRoute({ children, role }) {
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (role && user?.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}
const Router1 = () => {
  const location = useLocation();

  // Fait défiler la page vers le haut à chaque changement de route
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <Routes>
      {/* Route parente avec Layout */}
      <Route path="login" element={<Login />} />
      <Route path="recrutement" element={<DashboardRecrutement />} />

      <Route path="register" element={<Register />} />
      <Route path="Interview" element={<Interview />} />
      <Route path="/Interview/:id" element={<Interview />} />
      
      <Route path="/" element={<Layout />}>
        {/* Routes enfants <Route path="/" element={<Home />} />*/}
<Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
        <Route path="Mesinterview" element={<Mesinterview />} />
        <Route path="/offres" element={<OffresEmploi />} />
        <Route path="/offre/:id" element={<DetailsOffreEmploi />} />
      </Route>
    </Routes>
  );
};

export default Router1;
