import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store/store";
import RecruiterDashboard from "./Recruteur/RecruiterDashboard";

// Importez vos autres composants ici

function App() {
  return (
    <Provider store={store}>
      <Router>
        <Routes>
          <Route path="/recruiter/dashboard" element={<RecruiterDashboard />} />
          {/* Add other routes here */}
          
        </Routes>
      </Router>
    </Provider>
  );
}

export default App;
