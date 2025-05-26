import Hero from "../components/version/Hero";
import Features from "../components/version/Features";
import InterviewProcess from "../components/version/InterviewProcess";
import VideoDemo from "../components/version/VideoDemo";
import Testimonials from "../components/version/Testimonials";
import "./global.css"; 
const Index = () => {
  return (
    <div className="min-h-screen">
      <Hero />
      <Features />
      <InterviewProcess />
      <VideoDemo />
      <Testimonials />
    </div>
  );
};

export default Index;
