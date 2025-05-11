import React from "react";
import HeroSection from "../components/HeroSection";
import FeaturesSectionDemo from "../components/section1";
import Pricing from "../components/pricing";
import LogoSlider from "../components/barlog";
import Section2 from "../components/section2";
import InterviewPrepSection from "../components/Section3";

const Home = () => {
  return (
    <div className="overflow-hidden bg-white">
      <HeroSection />
      <LogoSlider />
      
      <Section2 />
      <InterviewPrepSection  /> 
    </div>
  );
};

export default Home;
