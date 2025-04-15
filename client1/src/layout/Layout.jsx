import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar/Nav";
const Layout = () => {
  

  return (
    <div>
    <Navbar/>
      {/* Contenu principal */}
      <main>
        {/* Affiche les routes enfants */}
        <Outlet />
      </main>
      
    </div>
  );
};

export default Layout;
