import logo from './logo.svg';
import './App.css';
import Router1 from './route/Router';
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import checkAuth  from "./pages/store/auth/authSlice";
function App() {
   const dispatch = useDispatch();
   
  return (
    <div >
     <Router1 />
    </div>
  );
}

export default App;
